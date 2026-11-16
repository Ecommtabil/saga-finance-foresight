import { bissecao, caue, formatBRL, npv } from "@/lib/finance";
import { anosArray, horizonteValido, type CampoPremissa, type Parecer, type RelatorioEstudo } from "./tipos";

/** 12 salários + 13º + 1/3 de férias. */
export const FATOR_ANUAL_FOLHA = 13.3333;

export type Favorece = "interno" | "terceirizado" | "neutro";
export interface RiscoQualitativo { id: string; texto: string; favorece: Favorece }

export interface PremissasEquipe {
  tma: number;
  aliquota: number;
  qtd: number;
  salario: number;
  fatorEncargos: number;
  custoTD: number;
  capex: number;
  vidaUtil: number;
  reajSalarial: number;
  mensalidade: number;
  reajContrato: number;
  horizonte: number;
  riscos: RiscoQualitativo[];
}

export const RISCOS_PADRAO: RiscoQualitativo[] = [
  { id: "passivo", texto: "Passivo trabalhista", favorece: "terceirizado" },
  { id: "turnover", texto: "Turnover", favorece: "terceirizado" },
  { id: "dependencia", texto: "Dependência do fornecedor", favorece: "interno" },
  { id: "qualidade", texto: "Controle de qualidade", favorece: "interno" },
  { id: "subsidiaria", texto: "Responsabilidade subsidiária", favorece: "interno" },
];

export const PADRAO_EQUIPE: PremissasEquipe = {
  tma: 0.12, aliquota: 0.34, qtd: 5, salario: 4500, fatorEncargos: 0.7, custoTD: 15000, capex: 25000,
  vidaUtil: 5, reajSalarial: 0.05, mensalidade: 38000, reajContrato: 0.05, horizonte: 5, riscos: RISCOS_PADRAO,
};

export const CAMPOS_EQUIPE: CampoPremissa<PremissasEquipe>[] = [
  { chave: "tma", rotulo: "TMA a.a.", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "aliquota", rotulo: "Alíquota IRPJ + CSLL", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "horizonte", rotulo: "Horizonte de análise (anos)", tipo: "int", grupo: "Taxas e horizonte", min: 3, max: 10 },
  { chave: "qtd", rotulo: "Quantidade de funcionários", tipo: "int", grupo: "Equipe interna", min: 0, max: 500 },
  { chave: "salario", rotulo: "Salário nominal médio mensal", tipo: "brl", grupo: "Equipe interna" },
  { chave: "fatorEncargos", rotulo: "Fator de encargos e benefícios sobre a folha", tipo: "pct", grupo: "Equipe interna" },
  { chave: "custoTD", rotulo: "Custo anual de T&D, gestão e outros", tipo: "brl", grupo: "Equipe interna" },
  { chave: "capex", rotulo: "CAPEX inicial em equipamentos", tipo: "brl", grupo: "Equipe interna" },
  { chave: "vidaUtil", rotulo: "Vida útil do CAPEX (anos)", tipo: "int", grupo: "Equipe interna", min: 1, max: 50 },
  { chave: "reajSalarial", rotulo: "Reajuste salarial anual (dissídio)", tipo: "pct", grupo: "Equipe interna" },
  { chave: "mensalidade", rotulo: "Mensalidade total da prestadora", tipo: "brl", grupo: "Terceirizado" },
  { chave: "reajContrato", rotulo: "Reajuste anual do contrato", tipo: "pct", grupo: "Terceirizado" },
];

export function calcularEquipe(p: PremissasEquipe) {
  const N = horizonteValido(p.horizonte);
  const vida = Math.max(1, Math.round(p.vidaUtil));
  const capex = anosArray(N, (t) => (t === 0 ? -p.capex : 0));
  // Correção: o salário também é reajustado (dissídio), não só o contrato terceirizado
  const folha = anosArray(N, (t) => (t === 0 ? 0 : p.qtd * p.salario * Math.pow(1 + p.reajSalarial, t - 1) * FATOR_ANUAL_FOLHA));
  // Correção: encargos incidem sobre 13,33 salários (inclui 13º e férias)
  const encargos = anosArray(N, (t) => (t === 0 ? 0 : folha[t] * p.fatorEncargos + p.custoTD));
  const depreciacao = anosArray(N, (t) => (t >= 1 && t <= vida ? p.capex / vida : 0));
  const benefInterno = anosArray(N, (t) => (t === 0 ? 0 : (folha[t] + encargos[t] + depreciacao[t]) * p.aliquota));
  const fluxoInterno = anosArray(N, (t) => capex[t] - folha[t] - encargos[t] + benefInterno[t]);

  const fatura = anosArray(N, (t) => (t === 0 ? 0 : p.mensalidade * 12 * Math.pow(1 + p.reajContrato, t - 1)));
  const benefTerc = fatura.map((f) => f * p.aliquota);
  const fluxoTerc = fatura.map((f, t) => -f + benefTerc[t]);

  const vplInterno = npv(p.tma, fluxoInterno);
  const vplTerc = npv(p.tma, fluxoTerc);
  const custoAno1 = folha[1] + encargos[1];
  return {
    N, capex, folha, encargos, depreciacao, benefInterno, fluxoInterno, fatura, benefTerc, fluxoTerc,
    diferenca: fluxoInterno.map((x, t) => x - fluxoTerc[t]),
    vplInterno, vplTerc, caueInterno: caue(p.tma, N, vplInterno), caueTerc: caue(p.tma, N, vplTerc),
    custoMensalPorFuncionario: p.qtd > 0 ? custoAno1 / p.qtd / 12 : null,
  };
}

export type ResultadoEquipe = ReturnType<typeof calcularEquipe>;

/** Mensalidade da terceirizada que iguala os VPLs (ponto de inflexão). */
export function pontoInflexao(p: PremissasEquipe): number | null {
  const vplInterno = calcularEquipe(p).vplInterno;
  const f = (m: number) => calcularEquipe({ ...p, mensalidade: m }).vplTerc - vplInterno;
  return bissecao(f, 0, Math.max(1, p.mensalidade, p.salario * Math.max(1, p.qtd)) * 20, 1e-12);
}

/** VPL interno x terceirizado de 1 a 15 funcionários (terceirizado constante). */
export function tabelaFuncionarios(p: PremissasEquipe, ate = 15) {
  const vplTerc = calcularEquipe(p).vplTerc;
  return Array.from({ length: ate }, (_, i) => {
    const qtd = i + 1;
    const vplInterno = calcularEquipe({ ...p, qtd }).vplInterno;
    return { qtd, vplInterno, vplTerc, melhor: vplInterno > vplTerc ? ("interno" as const) : ("terceirizado" as const) };
  });
}

export function curvaMensalidadeTerc(p: PremissasEquipe, passos = 13) {
  const vplInterno = calcularEquipe(p).vplInterno;
  return Array.from({ length: passos }, (_, i) => {
    const v = -0.3 + (0.6 * i) / (passos - 1);
    const m = p.mensalidade * (1 + v);
    return { variacao: v, mensalidade: m, vplInterno, vplTerc: calcularEquipe({ ...p, mensalidade: m }).vplTerc };
  });
}

export function parecerEquipe(r: ResultadoEquipe, inflexao: number | null): Parecer {
  const dif = formatBRL(Math.abs(r.vplInterno - r.vplTerc));
  const anual = formatBRL(Math.abs(r.caueInterno - r.caueTerc));
  const inflTxt = inflexao === null ? "Não foi encontrado ponto de inflexão." : `A terceirização compensa enquanto a mensalidade for menor que ${formatBRL(inflexao)}.`;
  if (r.vplInterno > r.vplTerc) {
    return { nivel: "info", titulo: "RECOMENDA-SE EQUIPE INTERNA", texto: `A equipe interna custa ${dif} a menos em valor presente (${anual} por ano em custo equivalente). ${inflTxt}` };
  }
  return { nivel: "info", titulo: "RECOMENDA-SE TERCEIRIZAR (menor custo/risco)", texto: `Terceirizar custa ${dif} a menos em valor presente (${anual} por ano em custo equivalente). ${inflTxt}` };
}

export function relatorioEquipe(p: PremissasEquipe): RelatorioEstudo {
  const r = calcularEquipe(p);
  const infl = pontoInflexao(p);
  const neg = (v: number[]) => v.map((x) => -x);
  const melhorInterno = r.vplInterno > r.vplTerc;
  return {
    anos: r.N,
    blocos: [
      {
        titulo: "Equipe interna",
        linhas: [
          { rotulo: "(−) CAPEX", valores: r.capex, estilo: "calc" },
          { rotulo: "(−) Salários + 13º + 1/3 de férias", valores: neg(r.folha), estilo: "calc" },
          { rotulo: "(−) Encargos, benefícios e T&D", valores: neg(r.encargos), estilo: "calc" },
          { rotulo: "(+) Benefício fiscal (folha + encargos + depreciação)", valores: r.benefInterno, estilo: "calc" },
          { rotulo: "(=) Fluxo líquido equipe interna", valores: r.fluxoInterno, estilo: "total" },
        ],
      },
      {
        titulo: "Terceirizado",
        linhas: [
          { rotulo: "(−) Fatura anual", valores: neg(r.fatura), estilo: "calc" },
          { rotulo: "(+) Benefício fiscal", valores: r.benefTerc, estilo: "calc" },
          { rotulo: "(=) Fluxo líquido terceirização", valores: r.fluxoTerc, estilo: "total" },
        ],
      },
      { titulo: "Diferença (Interno − Terceirizado)", linhas: [{ rotulo: "(=) Diferença anual", valores: r.diferenca, estilo: "subtotal" }] },
    ],
    kpis: [
      { id: "vplInterno", rotulo: "VPL custo líquido — Interno", valor: r.vplInterno, formato: "brl", ok: melhorInterno, destaque: true },
      { id: "vplTerc", rotulo: "VPL custo líquido — Terceirizado", valor: r.vplTerc, formato: "brl", ok: !melhorInterno, destaque: true },
      { id: "caueInterno", rotulo: "CAUE Interno", valor: r.caueInterno, formato: "brl" },
      { id: "caueTerc", rotulo: "CAUE Terceirizado", valor: r.caueTerc, formato: "brl" },
      { id: "custoFunc", rotulo: "Custo mensal por funcionário interno", valor: r.custoMensalPorFuncionario, formato: "brl", textoNulo: "–", dica: "Salários + encargos + T&D do Ano 1 ÷ funcionários ÷ 12 (antes do benefício fiscal)." },
      { id: "inflexao", rotulo: "Ponto de inflexão (mensalidade)", valor: infl, formato: "brl", textoNulo: "Sem inflexão", dica: "Mensalidade da terceirizada que iguala os VPLs." },
    ],
    parecer: parecerEquipe(r, infl),
  };
}
