import type { PremissasPOB } from "./premissas";

export interface CenarioOrcamento {
  id: string;
  nome: string;
  ano: number;
  moeda: string;
  criadoEm: string;
  atualizadoEm: string;
  premissas?: PremissasPOB;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const MESES_POB = [
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
