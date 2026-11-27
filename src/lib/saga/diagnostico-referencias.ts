import { avaliarIndicador } from "./diagnostico-score";

export const INDICADORES_DIAGNOSTICO = [
  { id: "mBruta", titulo: "Margem Bruta", grupo: "Lucratividade", percentual: true, maiorMelhor: true, bom: 0.4, atencao: 0.2 },
  { id: "mEbitda", titulo: "Margem EBITDA", grupo: "Lucratividade", percentual: true, maiorMelhor: true, bom: 0.15, atencao: 0.08 },
  { id: "mOp", titulo: "Margem Operacional", grupo: "Lucratividade", percentual: true, maiorMelhor: true, bom: 0.1, atencao: 0.04 },
  { id: "mLiq", titulo: "Margem Líquida", grupo: "Lucratividade", percentual: true, maiorMelhor: true, bom: 0.08, atencao: 0.03 },
  { id: "roe", titulo: "ROE", grupo: "Gestão", percentual: true, maiorMelhor: true, bom: 0.15, atencao: 0.08 },
  { id: "roa", titulo: "ROA", grupo: "Gestão", percentual: true, maiorMelhor: true, bom: 0.08, atencao: 0.04 },
  { id: "roic", titulo: "ROIC", grupo: "Gestão", percentual: true, maiorMelhor: true, bom: 0.12, atencao: 0.06 },
  { id: "giroAtivo", titulo: "Giro do Ativo", grupo: "Gestão", percentual: false, maiorMelhor: true, bom: 1, atencao: 0.5 },
  { id: "divPL", titulo: "Dívida / PL", grupo: "Endividamento", percentual: false, maiorMelhor: false, bom: 0.5, atencao: 1 },
  { id: "divAtivo", titulo: "Dívida / Ativo", grupo: "Endividamento", percentual: true, maiorMelhor: false, bom: 0.3, atencao: 0.5 },
  { id: "cobJuros", titulo: "Cobertura de Juros", grupo: "Endividamento", percentual: false, maiorMelhor: true, bom: 3, atencao: 1.5 },
  { id: "liqCorr", titulo: "Liquidez Corrente", grupo: "Endividamento", percentual: false, maiorMelhor: true, bom: 1.5, atencao: 1 },
] as const;

export type IndicadorId = typeof INDICADORES_DIAGNOSTICO[number]["id"];
export type LimitesDiagnostico = { bom: number; atencao: number };
export type ReferenciasDiagnostico = Record<IndicadorId, LimitesDiagnostico>;

export function referenciasPadrao(): ReferenciasDiagnostico {
  return Object.fromEntries(INDICADORES_DIAGNOSTICO.map((i) =>
    [i.id, { bom: i.bom, atencao: i.atencao }])) as ReferenciasDiagnostico;
}

export function validarLimites(id: IndicadorId, limites: LimitesDiagnostico): string | null {
  const indicador = INDICADORES_DIAGNOSTICO.find((i) => i.id === id);
  if (!Number.isFinite(limites.bom) || !Number.isFinite(limites.atencao))
    return "Preencha os dois limites com números válidos.";
  if (!indicador || (indicador.maiorMelhor ? limites.bom <= limites.atencao : limites.bom >= limites.atencao))
    return indicador?.maiorMelhor
      ? "O limite saudável deve ser maior que o limite de atenção."
      : "O limite saudável deve ser menor que o limite de atenção.";
  return null;
}

/** Dados legados, incompletos ou inválidos nunca deixam um indicador sem referência. */
export function normalizarReferencias(valor: unknown): ReferenciasDiagnostico {
  const referencias = referenciasPadrao();
  if (!valor || typeof valor !== "object") return referencias;
  for (const i of INDICADORES_DIAGNOSTICO) {
    const candidato: unknown = (valor as Record<string, unknown>)[i.id];
    if (!candidato || typeof candidato !== "object") continue;
    const { bom, atencao } = candidato as Record<string, unknown>;
    if (typeof bom === "number" && typeof atencao === "number" && !validarLimites(i.id, { bom, atencao }))
      referencias[i.id] = { bom, atencao };
  }
  return referencias;
}

export function avaliarReferencia(valor: number, id: IndicadorId, referencias: ReferenciasDiagnostico) {
  const indicador = INDICADORES_DIAGNOSTICO.find((i) => i.id === id);
  const { bom, atencao } = referencias[id];
  return avaliarIndicador(valor, bom, atencao, indicador?.maiorMelhor);
}

export function textoReferencia(id: IndicadorId, referencias: ReferenciasDiagnostico): string {
  const indicador = INDICADORES_DIAGNOSTICO.find((i) => i.id === id);
  const { bom, atencao } = referencias[id];
  const formatar = (v: number) => `${(indicador?.percentual ? v * 100 : v).toLocaleString("pt-BR", { maximumFractionDigits: 4 })}${indicador?.percentual ? "%" : "x"}`;
  return indicador?.maiorMelhor
    ? `Crítico < ${formatar(atencao)} • Atenção ≥ ${formatar(atencao)} e < ${formatar(bom)} • Saudável ≥ ${formatar(bom)}`
    : `Saudável ≤ ${formatar(bom)} • Atenção > ${formatar(bom)} e ≤ ${formatar(atencao)} • Crítico > ${formatar(atencao)}`;
}

export function converterLimite(texto: string, percentual: boolean): number {
  const limpo = texto.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(limpo)) return NaN;
  return Number(limpo) / (percentual ? 100 : 1);
}