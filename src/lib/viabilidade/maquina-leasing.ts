import { bissecao, caue, formatBRL, npv } from "@/lib/finance";
import { anosArray, horizonteValido, type CampoPremissa, type Parecer, type RelatorioEstudo } from "./tipos";

export interface PremissasMaquina {
  tma: number;
  aliquota: number;
  preco: number;
  manutencao: number;
  vidaUtil: number;
  venda: number;
  leasingMensal: number;
  manutInclusa: boolean;
  manutLeasing: number;
  horizonte: number;
}

export const PADRAO_MAQUINA: PremissasMaquina = {
  tma: 0.12, aliquota: 0.34, preco: 180000, manutencao: 12000, vidaUtil: 5, venda: 30000,
  leasingMensal: 4200, manutInclusa: true, manutLeasing: 0, horizonte: 5,
};

export const CAMPOS_MAQUINA: CampoPremissa<PremissasMaquina>[] = [
  { chave: "tma", rotulo: "TMA a.a.", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "aliquota", rotulo: "Alíquota IRPJ + CSLL", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "horizonte", rotulo: "Horizonte de análise (anos)", tipo: "int", grupo: "Taxas e horizonte", min: 3, max: 10 },
  { chave: "preco", rotulo: "Preço de aquisição", tipo: "brl", grupo: "Compra" },
  { chave: "manutencao", rotulo: "Manutenção + seguro anual", tipo: "brl", grupo: "Compra" },
  { chave: "vidaUtil", rotulo: "Vida útil para depreciação fiscal (anos)", tipo: "int", grupo: "Compra", min: 1, max: 50 },
  { chave: "venda", rotulo: "Valor de venda no fim do horizonte", tipo: "brl", grupo: "Compra" },
  { chave: "leasingMensal", rotulo: "Contraprestação mensal", tipo: "brl", grupo: "Leasing" },
  { chave: "manutInclusa", rotulo: "Manutenção inclusa no contrato?", tipo: "bool", grupo: "Leasing" },
  { chave: "manutLeasing", rotulo: "Manutenção anual por conta da empresa no leasing", tipo: "brl", grupo: "Leasing", visivel: (p) => !p.manutInclusa },
];

export function calcularMaquina(p: PremissasMaquina) {
  const N = horizonteValido(p.horizonte);
  const vida = Math.max(1, Math.round(p.vidaUtil));
  const depAnual = (p.preco - p.venda) / vida;
  const depreciacao = anosArray(N, (t) => (t >= 1 && t <= vida ? depAnual : 0));
  const depAcum = depreciacao.reduce((a, b) => a + b, 0);
  const valorContabil = p.preco - depAcum;
  const capex = anosArray(N, (t) => (t === 0 ? -p.preco : 0));
  const manut = anosArray(N, (t) => (t === 0 ? 0 : -p.manutencao));
  const benefCompra = anosArray(N, (t) => (t === 0 ? 0 : (depreciacao[t] + p.manutencao) * p.aliquota));
  const venda = anosArray(N, (t) => (t === N ? p.venda : 0));
  // IR sobre ganho (negativo) ou crédito sobre perda (positivo) na venda
  const irVenda = anosArray(N, (t) => (t === N ? -(p.venda - valorContabil) * p.aliquota : 0));
  const fluxoCompra = anosArray(N, (t) => capex[t] + manut[t] + benefCompra[t] + venda[t] + irVenda[t]);

  const manutPropria = p.manutInclusa ? 0 : p.manutLeasing;
  const contraprestacoes = anosArray(N, (t) => (t === 0 ? 0 : -p.leasingMensal * 12));
  const manutLeasing = anosArray(N, (t) => (t === 0 ? 0 : -manutPropria));
  const benefLeasing = anosArray(N, (t) => (t === 0 ? 0 : (p.leasingMensal * 12 + manutPropria) * p.aliquota));
  const fluxoLeasing = anosArray(N, (t) => contraprestacoes[t] + manutLeasing[t] + benefLeasing[t]);

  const vplCompra = npv(p.tma, fluxoCompra);
  const vplLeasing = npv(p.tma, fluxoLeasing);
  return {
    N, depreciacao, valorContabil, capex, manut, benefCompra, venda, irVenda, fluxoCompra,
    contraprestacoes, manutLeasing, benefLeasing, fluxoLeasing,
    diferenca: fluxoCompra.map((c, t) => c - fluxoLeasing[t]),
    vplCompra, vplLeasing, caueCompra: caue(p.tma, N, vplCompra), caueLeasing: caue(p.tma, N, vplLeasing),
  };
}

export type ResultadoMaquina = ReturnType<typeof calcularMaquina>;

/** Mensalidade de leasing que iguala os VPLs das duas opções. */
export function mensalidadeEquilibrio(p: PremissasMaquina): number | null {
  const vplCompra = calcularMaquina(p).vplCompra;
  const f = (m: number) => calcularMaquina({ ...p, leasingMensal: m }).vplLeasing - vplCompra;
  return bissecao(f, 0, Math.max(1, p.preco, p.leasingMensal) * 10, 1e-12);
}

export function curvaMensalidade(p: PremissasMaquina, passos = 13) {
  return Array.from({ length: passos }, (_, i) => {
    const v = -0.3 + (0.6 * i) / (passos - 1);
    const m = p.leasingMensal * (1 + v);
    const r = calcularMaquina({ ...p, leasingMensal: m });
    return { variacao: v, mensalidade: m, diferenca: r.vplCompra - r.vplLeasing };
  });
}

export function parecerMaquina(r: ResultadoMaquina, equilibrio: number | null): Parecer {
  const economiaAno = formatBRL(Math.abs(r.caueCompra - r.caueLeasing));
  const economiaVpl = formatBRL(Math.abs(r.vplCompra - r.vplLeasing));
  const eqTxt = equilibrio === null ? "Não foi encontrada mensalidade de equilíbrio." : `A mensalidade de leasing de equilíbrio é ${formatBRL(equilibrio)}.`;
  if (r.vplCompra > r.vplLeasing) {
    return {
      nivel: "info",
      titulo: "COMPRAR A MÁQUINA (menor custo descontado)",
      texto: `A compra economiza ${economiaAno} por ano em custo anual equivalente (${economiaVpl} em valor presente). ${eqTxt} Leasings abaixo desse valor passam a compensar.`,
    };
  }
  return {
    nivel: "info",
    titulo: "LEASING (menor custo descontado)",
    texto: `O leasing economiza ${economiaAno} por ano em custo anual equivalente (${economiaVpl} em valor presente). ${eqTxt} Acima desse valor, comprar a máquina passa a compensar.`,
  };
}

export function relatorioMaquina(p: PremissasMaquina): RelatorioEstudo {
  const r = calcularMaquina(p);
  const eq = mensalidadeEquilibrio(p);
  const linhasLeasing = [
    { rotulo: "(−) Contraprestações anualizadas", valores: r.contraprestacoes, estilo: "calc" as const },
    ...(p.manutInclusa ? [] : [{ rotulo: "(−) Manutenção própria", valores: r.manutLeasing, estilo: "calc" as const }]),
    { rotulo: "(+) Benefício fiscal", valores: r.benefLeasing, estilo: "calc" as const },
    { rotulo: "(=) Fluxo líquido leasing", valores: r.fluxoLeasing, estilo: "total" as const },
  ];
  const melhorCompra = r.vplCompra > r.vplLeasing;
  return {
    anos: r.N,
    blocos: [
      {
        titulo: "Máquina própria (Compra)",
        linhas: [
          { rotulo: "(−) CAPEX", valores: r.capex, estilo: "calc" },
          { rotulo: "(−) Manutenção e seguro", valores: r.manut, estilo: "calc" },
          { rotulo: "(+) Benefício fiscal (depreciação + manutenção)", valores: r.benefCompra, estilo: "calc" },
          { rotulo: "(+) Venda do equipamento", valores: r.venda, estilo: "calc" },
          { rotulo: "(−/+) IR sobre ganho/perda na venda", valores: r.irVenda, estilo: "calc" },
          { rotulo: "(=) Fluxo líquido máquina própria", valores: r.fluxoCompra, estilo: "total" },
        ],
      },
      { titulo: "Leasing", linhas: linhasLeasing },
      { titulo: "Diferença (Compra − Leasing)", linhas: [{ rotulo: "(=) Diferença anual", valores: r.diferenca, estilo: "subtotal" }] },
    ],
    kpis: [
      { id: "vplCompra", rotulo: "VPL custo líquido — Compra", valor: r.vplCompra, formato: "brl", ok: melhorCompra, destaque: true, dica: "Valores negativos representam custo." },
      { id: "vplLeasing", rotulo: "VPL custo líquido — Leasing", valor: r.vplLeasing, formato: "brl", ok: !melhorCompra, destaque: true },
      { id: "caueCompra", rotulo: "CAUE Compra", valor: r.caueCompra, formato: "brl", dica: "Custo anual uniforme equivalente." },
      { id: "caueLeasing", rotulo: "CAUE Leasing", valor: r.caueLeasing, formato: "brl" },
      { id: "economiaVpl", rotulo: "Economia da melhor opção (VPL)", valor: Math.abs(r.vplCompra - r.vplLeasing), formato: "brl" },
      { id: "economiaAno", rotulo: "Economia da melhor opção (R$/ano)", valor: Math.abs(r.caueCompra - r.caueLeasing), formato: "brl" },
      { id: "equilibrio", rotulo: "Mensalidade de leasing de equilíbrio", valor: eq, formato: "brl", textoNulo: "Sem equilíbrio", dica: "Mensalidade que iguala os dois VPLs." },
    ],
    parecer: parecerMaquina(r, eq),
  };
}
