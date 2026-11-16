import { bissecao, caue, formatAnos, formatBRL, irr, npv } from "@/lib/finance";
import { acumular, anosArray, horizonteValido, type CampoPremissa, type Parecer, type RelatorioEstudo } from "./tipos";

export interface PremissasComprarAlugar {
  tma: number;
  aliquota: number;
  valor: number;
  pctTerreno: number;
  pctManutencao: number;
  taxaDepreciacao: number;
  revenda: number;
  tributarGanho: boolean;
  aluguelMensal: number;
  reajAluguel: number;
  horizonte: number;
}

export const PADRAO_COMPRAR_ALUGAR: PremissasComprarAlugar = {
  tma: 0.12, aliquota: 0.34, valor: 1000000, pctTerreno: 0, pctManutencao: 0.02, taxaDepreciacao: 0.05,
  revenda: 1200000, tributarGanho: true, aluguelMensal: 8000, reajAluguel: 0.05, horizonte: 5,
};

export const CAMPOS_COMPRAR_ALUGAR: CampoPremissa<PremissasComprarAlugar>[] = [
  { chave: "tma", rotulo: "TMA a.a.", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "aliquota", rotulo: "Alíquota IRPJ + CSLL", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "horizonte", rotulo: "Horizonte de análise (anos)", tipo: "int", grupo: "Taxas e horizonte", min: 3, max: 10 },
  { chave: "valor", rotulo: "Valor de aquisição", tipo: "brl", grupo: "Comprar" },
  { chave: "pctTerreno", rotulo: "Parcela referente a terreno (não depreciável)", tipo: "pct", grupo: "Comprar" },
  { chave: "pctManutencao", rotulo: "Manutenção + IPTU anual (% do valor)", tipo: "pct", grupo: "Comprar" },
  { chave: "taxaDepreciacao", rotulo: "Taxa de depreciação anual", tipo: "pct", grupo: "Comprar", ajuda: "5% equivale a 20 anos." },
  { chave: "revenda", rotulo: "Valor de revenda no fim do horizonte", tipo: "brl", grupo: "Comprar" },
  { chave: "tributarGanho", rotulo: "Tributar ganho de capital na revenda?", tipo: "bool", grupo: "Comprar" },
  { chave: "aluguelMensal", rotulo: "Aluguel mensal", tipo: "brl", grupo: "Alugar" },
  { chave: "reajAluguel", rotulo: "Reajuste anual do aluguel", tipo: "pct", grupo: "Alugar" },
];

export function calcularComprarAlugar(p: PremissasComprarAlugar) {
  const N = horizonteValido(p.horizonte);
  const baseDepreciavel = p.valor * (1 - p.pctTerreno);
  const manutAnual = p.valor * p.pctManutencao;
  let acum = 0;
  const depreciacao = anosArray(N, (t) => {
    if (t === 0) return 0;
    const d = Math.max(0, Math.min(baseDepreciavel * p.taxaDepreciacao, baseDepreciavel - acum));
    acum += d;
    return d;
  });
  const valorContabil = p.valor - acum;
  const ganho = p.revenda - valorContabil;
  const irGanho = p.tributarGanho ? Math.max(0, ganho) * p.aliquota : 0;

  const aquisicao = anosArray(N, (t) => (t === 0 ? -p.valor : 0));
  const manutencao = anosArray(N, (t) => (t === 0 ? 0 : -manutAnual));
  // Correção: a manutenção também gera benefício fiscal (a planilha original só considerava o do aluguel)
  const benefManut = manutencao.map((m) => -m * p.aliquota);
  const benefDep = depreciacao.map((d) => d * p.aliquota);
  const revenda = anosArray(N, (t) => (t === N ? p.revenda : 0));
  // Correção: o ganho de capital na revenda é tributado
  const irRevenda = anosArray(N, (t) => (t === N ? -irGanho : 0));
  const fluxoComprar = anosArray(N, (t) => aquisicao[t] + manutencao[t] + benefManut[t] + benefDep[t] + revenda[t] + irRevenda[t]);

  const aluguel = anosArray(N, (t) => (t === 0 ? 0 : -p.aluguelMensal * 12 * Math.pow(1 + p.reajAluguel, t - 1)));
  const benefAluguel = aluguel.map((a) => -a * p.aliquota);
  const fluxoAlugar = aluguel.map((a, t) => a + benefAluguel[t]);
  const incremental = fluxoComprar.map((c, t) => c - fluxoAlugar[t]);

  const vplComprar = npv(p.tma, fluxoComprar);
  const vplAlugar = npv(p.tma, fluxoAlugar);
  const vplIncremental = npv(p.tma, incremental);
  return {
    N, depreciacao, valorContabil, ganho, irGanho, aquisicao, manutencao, benefManut, benefDep, revenda, irRevenda,
    fluxoComprar, aluguel, benefAluguel, fluxoAlugar, incremental, acumuladoIncremental: acumular(incremental),
    vplComprar, vplAlugar, vplIncremental, tirIncremental: irr(incremental),
    caueComprar: caue(p.tma, N, vplComprar), caueAlugar: caue(p.tma, N, vplAlugar),
  };
}

export type ResultadoComprarAlugar = ReturnType<typeof calcularComprarAlugar>;

/** Valor de revenda que zera o VPL incremental (bisseção). null se não houver empate em [0, 50× valor]. */
export function revendaEmpate(p: PremissasComprarAlugar): number | null {
  const f = (rev: number) => calcularComprarAlugar({ ...p, revenda: rev }).vplIncremental;
  return bissecao(f, 0, Math.max(1, p.valor) * 50, 1e-12);
}

export function parecerComprarAlugar(p: PremissasComprarAlugar, r: ResultadoComprarAlugar, empate: number | null): Parecer {
  const dif = formatBRL(Math.abs(r.vplIncremental));
  const empTxt = empate === null
    ? "Não há valor de revenda que iguale as duas opções no horizonte analisado."
    : `A compra empata com o aluguel com revenda de ${formatBRL(empate)} ao fim de ${formatAnos(r.N).replace(",0", "")}.`;
  if (r.vplIncremental > 0) {
    return {
      nivel: "verde",
      titulo: "RECOMENDA-SE COMPRAR (gera economia no longo prazo)",
      texto: `Comprar gera ${dif} a mais que alugar em valor presente (VPL incremental à TMA). ${empTxt} Abaixo desse valor de revenda, alugar passa a ser melhor.`,
    };
  }
  return {
    nivel: "info",
    titulo: "RECOMENDA-SE ALUGAR (preserva caixa)",
    texto: `Comprar custa ${dif} a mais que alugar em valor presente, considerando benefício fiscal e IR sobre o ganho na revenda. ${empTxt}`,
  };
}

/** VPL incremental variando a revenda de −30% a +30%. */
export function curvaRevenda(p: PremissasComprarAlugar, passos = 13) {
  return Array.from({ length: passos }, (_, i) => {
    const v = -0.3 + (0.6 * i) / (passos - 1);
    const rev = p.revenda * (1 + v);
    return { variacao: v, revenda: rev, vpl: calcularComprarAlugar({ ...p, revenda: rev }).vplIncremental };
  });
}

export function relatorioComprarAlugar(p: PremissasComprarAlugar): RelatorioEstudo {
  const r = calcularComprarAlugar(p);
  const empate = revendaEmpate(p);
  return {
    anos: r.N,
    blocos: [
      {
        titulo: "Opção COMPRAR",
        linhas: [
          { rotulo: "(−) Aquisição", valores: r.aquisicao, estilo: "calc" },
          { rotulo: "(−) Manutenção e IPTU", valores: r.manutencao, estilo: "calc" },
          { rotulo: "(+) Benefício fiscal da manutenção", valores: r.benefManut, estilo: "calc" },
          { rotulo: "(+) Benefício fiscal da depreciação", valores: r.benefDep, estilo: "calc" },
          { rotulo: "(+) Revenda", valores: r.revenda, estilo: "calc" },
          { rotulo: "(−) IR sobre ganho de capital", valores: r.irRevenda, estilo: "calc" },
          { rotulo: "(=) Fluxo líquido COMPRAR", valores: r.fluxoComprar, estilo: "total" },
        ],
      },
      {
        titulo: "Opção ALUGAR",
        linhas: [
          { rotulo: "(−) Aluguel anual", valores: r.aluguel, estilo: "calc" },
          { rotulo: "(+) Benefício fiscal do aluguel", valores: r.benefAluguel, estilo: "calc" },
          { rotulo: "(=) Fluxo líquido ALUGAR", valores: r.fluxoAlugar, estilo: "total" },
        ],
      },
      {
        titulo: "Fluxo incremental (Comprar − Alugar)",
        linhas: [
          { rotulo: "(=) Fluxo incremental", valores: r.incremental, estilo: "total" },
          { rotulo: "Incremental acumulado", valores: r.acumuladoIncremental, estilo: "acumulado" },
        ],
      },
    ],
    kpis: [
      { id: "vplIncremental", rotulo: "VPL incremental", valor: r.vplIncremental, formato: "brl", ok: r.vplIncremental > 0, destaque: true, dica: "VPL(Comprar) − VPL(Alugar). Positivo favorece comprar." },
      { id: "vplComprar", rotulo: "VPL Comprar", valor: r.vplComprar, formato: "brl" },
      { id: "vplAlugar", rotulo: "VPL Alugar", valor: r.vplAlugar, formato: "brl" },
      { id: "tirIncremental", rotulo: "TIR do fluxo incremental", valor: r.tirIncremental, formato: "pct", textoNulo: "Não calculável", ok: r.tirIncremental === null ? undefined : r.tirIncremental > p.tma, dica: "Retorno do capital adicional imobilizado na compra." },
      { id: "caueComprar", rotulo: "CAUE Comprar", valor: r.caueComprar, formato: "brl", dica: "Custo anual equivalente da opção comprar." },
      { id: "caueAlugar", rotulo: "CAUE Alugar", valor: r.caueAlugar, formato: "brl", dica: "Custo anual equivalente da opção alugar." },
      { id: "revendaEmpate", rotulo: "Revenda mínima para empatar", valor: empate, formato: "brl", textoNulo: "Sem empate", dica: "Valor de revenda que zera o VPL incremental." },
    ],
    parecer: parecerComprarAlugar(p, r, empate),
  };
}
