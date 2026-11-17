// Motor puro do Simples Nacional: RBT12, faixa, alíquota efetiva, partilha, teto do ISS e DAS por tipo de receita.
// Precisão total nos cálculos; arredondamento só na exibição.
import {
  COLUNAS_ANEXO, EXCLUSOES_COLUNA, LIMITES_FAIXA, ORDEM_TRIBUTOS, SUBLIMITE, TETO_ISS, TETO_SIMPLES, TRIBUTOS_ANEXO,
  type AnexoId, type ColunaReceita, type FaixaTabela, type TabelaAnexo, type TabelasSimples, type Tributo,
} from "./tabelas";

export type MesReceita = Partial<Record<ColunaReceita, number>>;

export interface DadosCalculo {
  ano: number;
  anexos: AnexoId[];
  inicioAtividade: boolean;
  /** "AAAA-MM" do primeiro mês de atividade. */
  mesInicio: string | null;
  /** Receita bruta total de jan a dez do ano anterior (empresa toda). */
  anoAnterior: number[];
  receitas: Partial<Record<AnexoId, MesReceita[]>>;
  /** RBT12 digitado manualmente (sobrescreve o calculado). */
  rbt12Manual: (number | null)[];
}

export type OrigemRbt12 = "calculado" | "manual" | "proporcional" | "primeiro-mes" | "sem-atividade";
export interface Rbt12Mes { valor: number; origem: OrigemRbt12; mesesAtividade?: number }

export type Alerta = { nivel: "erro" | "aviso" | "info"; texto: string };

export interface ResultadoMes {
  mes: number; // 0..11
  receitaTotal: number;
  receitas: Record<ColunaReceita, number>;
  rbt12: number;
  origemRbt12: OrigemRbt12;
  /** 1..6; 7 = acima do teto; 0 = sem RBT12. */
  faixa: number;
  calculado: boolean;
  aliqNominal: number; // fração
  deducao: number;
  ae: number; // fração
  /** Partilha efetiva (fração) já com teto do ISS e sublimite aplicados. */
  partilha: Partial<Record<Tributo, number>>;
  issLimitado: boolean;
  sublimite: boolean;
  impostoPorColuna: Record<ColunaReceita, number>;
  tributos: Record<Tributo, number>;
  totalDas: number;
  impostoSemSegregacao: number;
  alertas: Alerta[];
}

const zeroColunas = (): Record<ColunaReceita, number> => ({ integral: 0, st: 0, mono: 0, stMono: 0, semRet: 0, comRet: 0 });
const zeroTributos = (): Record<Tributo, number> => ({ CPP: 0, IRPJ: 0, CSLL: 0, COFINS: 0, PIS: 0, ICMS: 0, IPI: 0, ISS: 0 });
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const fmtR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function receitaAnexoMes(d: DadosCalculo, anexo: AnexoId, mes: number): number {
  const m = d.receitas[anexo]?.[mes];
  if (!m) return 0;
  return COLUNAS_ANEXO[anexo].reduce((s, c) => s + num(m[c]), 0);
}

/** Receita total do mês (todos os anexos da empresa). */
export function receitaEmpresaMes(d: DadosCalculo, mes: number): number {
  return d.anexos.reduce((s, a) => s + receitaAnexoMes(d, a, mes), 0);
}

/** Receita pelo índice absoluto de mês (ano*12 + mês). Fora da janela conhecida = 0. */
export function receitaAbsoluta(d: DadosCalculo, abs: number): number {
  const ano = Math.floor(abs / 12);
  const mes = abs - ano * 12;
  if (ano === d.ano - 1) return num(d.anoAnterior[mes]);
  if (ano === d.ano) return receitaEmpresaMes(d, mes);
  return 0;
}

export function parseMesAno(s: string | null | undefined): { ano: number; mes: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const mes = Number(m[2]) - 1;
  if (mes < 0 || mes > 11) return null;
  return { ano: Number(m[1]), mes };
}

/**
 * RBT12 de um mês pelo índice absoluto (ano*12 + mês): soma dos 12 meses anteriores (empresa toda),
 * com início de atividade (art. 18, §2º) e RBT12 manual (só dentro do ano da empresa).
 * `receita` permite trocar a fonte de receita (ex.: prévia do mês corrente na projeção).
 */
export function rbt12ParaMes(d: DadosCalculo, abs: number, receita: (abs: number) => number = (a) => receitaAbsoluta(d, a)): Rbt12Mes {
  if (Math.floor(abs / 12) === d.ano) {
    const manual = d.rbt12Manual[abs - d.ano * 12];
    if (typeof manual === "number" && Number.isFinite(manual)) return { valor: manual, origem: "manual" };
  }
  const inicio = d.inicioAtividade ? parseMesAno(d.mesInicio) ?? { ano: d.ano, mes: 0 } : null;
  if (inicio) {
    const n = abs - (inicio.ano * 12 + inicio.mes); // meses de atividade antes do PA
    if (n < 0) return { valor: 0, origem: "sem-atividade", mesesAtividade: 0 };
    if (n === 0) return { valor: receita(abs) * 12, origem: "primeiro-mes", mesesAtividade: 0 };
    if (n < 12) {
      let soma = 0;
      for (let k = 1; k <= n; k++) soma += receita(abs - k);
      return { valor: (soma / n) * 12, origem: "proporcional", mesesAtividade: n };
    }
  }
  let soma = 0;
  for (let k = 1; k <= 12; k++) soma += receita(abs - k);
  return { valor: soma, origem: "calculado" };
}

/** RBT12 de cada mês do ano da empresa. */
export function calcularRbt12(d: DadosCalculo): Rbt12Mes[] {
  return Array.from({ length: 12 }, (_, mes) => rbt12ParaMes(d, d.ano * 12 + mes));
}

/** Faixa pelo RBT12: 1..6; 7 acima do teto; 0 sem RBT12. */
export function faixaPorRbt12(rbt12: number): number {
  if (!(rbt12 > 0)) return 0;
  const i = LIMITES_FAIXA.findIndex((lim) => rbt12 <= lim);
  return i === -1 ? 7 : i + 1;
}

export function aliquotaEfetiva(rbt12: number, faixa: FaixaTabela): number {
  if (!(rbt12 > 0)) return 0;
  return (rbt12 * (faixa.aliquota / 100) - faixa.deducao) / rbt12;
}

/**
 * Partilha efetiva (fração). Faixa 6: ICMS/ISS fora do DAS (recolhidos por fora).
 * Anexos III/IV/V: se AE × %ISS > 5%, o ISS fica em 5% e a diferença vai proporcionalmente aos tributos federais.
 */
export function partilhaEfetiva(anexo: AnexoId, faixaNum: number, faixa: FaixaTabela, ae: number): { partilha: Partial<Record<Tributo, number>>; issLimitado: boolean } {
  const p: Partial<Record<Tributo, number>> = {};
  for (const t of TRIBUTOS_ANEXO[anexo]) p[t] = num(faixa.partilha[t]) / 100;
  if (faixaNum === 6) {
    if (p.ICMS !== undefined) p.ICMS = 0;
    if (p.ISS !== undefined) p.ISS = 0;
  }
  let issLimitado = false;
  const iss = p.ISS ?? 0;
  if ((anexo === "III" || anexo === "IV" || anexo === "V") && ae > 0 && ae * iss > TETO_ISS + 1e-12) {
    const novo = TETO_ISS / ae;
    const excedente = iss - novo;
    const federais = TRIBUTOS_ANEXO[anexo].filter((t) => t !== "ISS" && (p[t] ?? 0) > 0);
    const soma = federais.reduce((s, t) => s + (p[t] ?? 0), 0);
    if (soma > 0) {
      for (const t of federais) p[t] = (p[t] ?? 0) + excedente * ((p[t] ?? 0) / soma);
      p.ISS = novo;
      issLimitado = true;
    }
  }
  return { partilha: p, issLimitado };
}

export function calcularMesAnexo(anexo: AnexoId, mes: number, receitasMes: MesReceita | undefined, rbt: Rbt12Mes, tabela: TabelaAnexo, inicioAtividade: boolean): ResultadoMes {
  const receitas = zeroColunas();
  for (const c of COLUNAS_ANEXO[anexo]) receitas[c] = Math.max(0, num(receitasMes?.[c]));
  const receitaTotal = COLUNAS_ANEXO[anexo].reduce((s, c) => s + receitas[c], 0);
  const rbt12 = rbt.valor;
  const faixa = faixaPorRbt12(rbt12);
  const alertas: Alerta[] = [];
  const base: ResultadoMes = {
    mes, receitaTotal, receitas, rbt12, origemRbt12: rbt.origem, faixa, calculado: false,
    aliqNominal: 0, deducao: 0, ae: 0, partilha: {}, issLimitado: false, sublimite: false,
    impostoPorColuna: zeroColunas(), tributos: zeroTributos(), totalDas: 0, impostoSemSegregacao: 0, alertas,
  };
  if (faixa === 0) {
    if (receitaTotal > 0 && !inicioAtividade) alertas.push({ nivel: "erro", texto: "Há receita no mês, mas o RBT12 está zerado. Informe o RBT12." });
    else if (receitaTotal > 0) alertas.push({ nivel: "erro", texto: "Informe o RBT12." });
    return base;
  }
  if (faixa === 7) {
    alertas.push({ nivel: "erro", texto: `Excedeu o limite do Simples Nacional (RBT12 ${fmtR(rbt12)} acima de ${fmtR(TETO_SIMPLES)}).` });
    return base;
  }
  const f = tabela[faixa - 1];
  const ae = aliquotaEfetiva(rbt12, f);
  const { partilha, issLimitado } = partilhaEfetiva(anexo, faixa, f, ae);
  const impostoPorColuna = zeroColunas();
  const tributos = zeroTributos();
  for (const c of COLUNAS_ANEXO[anexo]) {
    const r = receitas[c];
    if (!r) continue;
    const excl = EXCLUSOES_COLUNA[c];
    for (const t of TRIBUTOS_ANEXO[anexo]) {
      if (excl.includes(t)) continue;
      const v = r * ae * (partilha[t] ?? 0);
      tributos[t] += v;
      impostoPorColuna[c] += v;
    }
  }
  const totalDas = COLUNAS_ANEXO[anexo].reduce((s, c) => s + impostoPorColuna[c], 0);
  // Sem segregação: toda a receita tributada integralmente (com a mesma regra de faixa 6 / teto do ISS).
  const somaPartilha = TRIBUTOS_ANEXO[anexo].reduce((s, t) => s + (partilha[t] ?? 0), 0);
  const impostoSemSegregacao = receitaTotal * ae * somaPartilha;

  const sublimite = faixa === 6 && rbt12 > SUBLIMITE;
  if (sublimite) alertas.push({ nivel: "aviso", texto: `Acima do sublimite de R$ 3,6 milhões: ${anexo === "I" || anexo === "II" ? "ICMS" : "ISS"} recolhido fora do DAS.` });
  if (issLimitado) alertas.push({ nivel: "info", texto: "ISS limitado a 5% efetivo; a diferença foi transferida aos tributos federais." });
  const limite = LIMITES_FAIXA[faixa - 1];
  if (rbt12 > 0.9 * TETO_SIMPLES) alertas.push({ nivel: "aviso", texto: `RBT12 em ${((rbt12 / TETO_SIMPLES) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do teto de R$ 4,8 milhões.` });
  else if (faixa < 6 && rbt12 > 0.9 * limite) alertas.push({ nivel: "aviso", texto: `RBT12 em ${((rbt12 / limite) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% do limite da faixa ${faixa} (${fmtR(limite)}).` });

  return { ...base, calculado: true, aliqNominal: f.aliquota / 100, deducao: f.deducao, ae, partilha, issLimitado, sublimite, impostoPorColuna, tributos, totalDas, impostoSemSegregacao };
}

export interface TotaisAnexo {
  receitaTotal: number;
  receitas: Record<ColunaReceita, number>;
  impostoPorColuna: Record<ColunaReceita, number>;
  tributos: Record<Tributo, number>;
  totalDas: number;
  impostoSemSegregacao: number;
}

export interface ResultadoEmpresa {
  rbt12: Rbt12Mes[];
  anexos: Partial<Record<AnexoId, { meses: ResultadoMes[]; totais: TotaisAnexo }>>;
  consolidado: {
    faturamento: number;
    das: number;
    /** Média das alíquotas efetivas ponderada pela receita. */
    aeMediaPonderada: number;
    /** DAS pago ÷ faturamento. */
    aliquotaPaga: number;
    economia: number;
    porTributo: Record<Tributo, number>;
    dasMensal: Array<{ mes: number; total: number } & Partial<Record<AnexoId, number>>>;
    receitaMensal: number[];
  };
  alertasGerais: Alerta[];
}

export function calcularEmpresa(d: DadosCalculo, tabelas: TabelasSimples): ResultadoEmpresa {
  const rbt12 = calcularRbt12(d);
  const anexos: ResultadoEmpresa["anexos"] = {};
  const porTributo = zeroTributos();
  const dasMensal: ResultadoEmpresa["consolidado"]["dasMensal"] = Array.from({ length: 12 }, (_, mes) => ({ mes, total: 0 }));
  let faturamento = 0, das = 0, semSeg = 0, aePond = 0;
  for (const a of d.anexos) {
    const meses = Array.from({ length: 12 }, (_, m) => calcularMesAnexo(a, m, d.receitas[a]?.[m], rbt12[m], tabelas[a], d.inicioAtividade));
    const totais: TotaisAnexo = { receitaTotal: 0, receitas: zeroColunas(), impostoPorColuna: zeroColunas(), tributos: zeroTributos(), totalDas: 0, impostoSemSegregacao: 0 };
    for (const r of meses) {
      totais.receitaTotal += r.receitaTotal;
      totais.totalDas += r.totalDas;
      totais.impostoSemSegregacao += r.impostoSemSegregacao;
      for (const c of COLUNAS_ANEXO[a]) { totais.receitas[c] += r.receitas[c]; totais.impostoPorColuna[c] += r.impostoPorColuna[c]; }
      for (const t of ORDEM_TRIBUTOS) totais.tributos[t] += r.tributos[t];
      dasMensal[r.mes][a] = r.totalDas;
      dasMensal[r.mes].total += r.totalDas;
      if (r.calculado) aePond += r.ae * r.receitaTotal;
    }
    for (const t of ORDEM_TRIBUTOS) porTributo[t] += totais.tributos[t];
    faturamento += totais.receitaTotal;
    das += totais.totalDas;
    semSeg += totais.impostoSemSegregacao;
    anexos[a] = { meses, totais };
  }
  const alertasGerais: Alerta[] = [];
  const excedeu = rbt12.findIndex((r) => r.valor > TETO_SIMPLES);
  if (excedeu >= 0) alertasGerais.push({ nivel: "erro", texto: `Excedeu o limite do Simples Nacional a partir de ${NOMES_MES[excedeu]}.` });
  return {
    rbt12,
    anexos,
    consolidado: {
      faturamento, das,
      aeMediaPonderada: faturamento > 0 ? aePond / faturamento : 0,
      aliquotaPaga: faturamento > 0 ? das / faturamento : 0,
      economia: semSeg - das,
      porTributo, dasMensal,
      receitaMensal: Array.from({ length: 12 }, (_, m) => receitaEmpresaMes(d, m)),
    },
    alertasGerais,
  };
}

export const NOMES_MES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
export const MES_CURTO = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** Cor do badge da faixa: verde 1–2, amarelo 3–4, laranja 5, vermelho 6 ou acima do teto. */
export function corFaixa(faixa: number): "verde" | "amarelo" | "laranja" | "vermelho" | "neutro" {
  if (faixa <= 0) return "neutro";
  if (faixa <= 2) return "verde";
  if (faixa <= 4) return "amarelo";
  if (faixa === 5) return "laranja";
  return "vermelho";
}
