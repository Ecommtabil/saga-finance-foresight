export type TipoConta = "receita" | "custo" | "despesa" | "outros";

export const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export interface LinhaOrcamento {
  id: string;
  grupo: string;
  conta: string;
  tipo: TipoConta;
  orcado: number[]; // 12 meses
  realizado: (number | null)[]; // 12 meses, null = ainda não realizado
}

export type MetodoForecast = "orcado" | "runrate" | "tendencia" | "sazonal";

export interface ConfigForecast {
  metodo: MetodoForecast;
  ajustePct: number; // ajuste manual aplicado ao previsto (%)
  janelaRolling: number; // meses do rolling forecast (ex.: 12)
  crescimentoRollingPct: number; // crescimento a.a. aplicado ao rolling
}

export interface Orcamento {
  id: string;
  nome: string;
  ano: number;
  moeda: string;
  criadoEm: string;
  linhas: LinhaOrcamento[];
  config: ConfigForecast;
}

export const CONFIG_PADRAO: ConfigForecast = {
  metodo: "sazonal",
  ajustePct: 0,
  janelaRolling: 12,
  crescimentoRollingPct: 0,
};

export const TIPO_LABEL: Record<TipoConta, string> = {
  receita: "Receita",
  custo: "Custo",
  despesa: "Despesa",
  outros: "Outros",
};

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function zeros12(): number[] {
  return Array.from({ length: 12 }, () => 0);
}

export function nulls12(): (number | null)[] {
  return Array.from({ length: 12 }, () => null);
}
