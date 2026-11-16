export type EstudoId = "nova-linha" | "comprar-alugar" | "maquina-leasing" | "equipe-terceirizar";

export type FormatoValor = "brl" | "pct" | "anos" | "x" | "num" | "texto";

export type EstiloLinha = "calc" | "subtotal" | "total" | "acumulado";

/** Linha do demonstrativo: valores[0] = Ano 0; null aparece como "–". */
export interface LinhaDemo {
  rotulo: string;
  valores: Array<number | null>;
  estilo?: EstiloLinha;
}

export interface BlocoDemo {
  titulo: string;
  linhas: LinhaDemo[];
}

export interface Kpi {
  id: string;
  rotulo: string;
  valor: number | null;
  formato: FormatoValor;
  /** true = bom (verde), false = ruim (vermelho), undefined = neutro */
  ok?: boolean;
  dica?: string;
  textoNulo?: string;
  destaque?: boolean;
}

export type NivelParecer = "verde" | "amarelo" | "vermelho" | "info";

export interface Parecer {
  nivel: NivelParecer;
  titulo: string;
  texto: string;
}

export interface RelatorioEstudo {
  anos: number;
  blocos: BlocoDemo[];
  kpis: Kpi[];
  parecer: Parecer;
}

export type TipoCampo = "brl" | "pct" | "int" | "bool";

export interface CampoPremissa<P = Record<string, unknown>> {
  chave: keyof P & string;
  rotulo: string;
  tipo: TipoCampo;
  grupo: string;
  min?: number;
  max?: number;
  ajuda?: string;
  visivel?: (p: P) => boolean;
}

export const HORIZONTE_MIN = 3;
export const HORIZONTE_MAX = 10;
export const HORIZONTE_PADRAO = 5;

export function horizonteValido(n: number): number {
  if (!Number.isFinite(n)) return HORIZONTE_PADRAO;
  return Math.min(HORIZONTE_MAX, Math.max(HORIZONTE_MIN, Math.round(n)));
}

/** Array de N+1 posições (Ano 0..N). */
export function anosArray<T>(n: number, fn: (t: number) => T): T[] {
  return Array.from({ length: n + 1 }, (_, t) => fn(t));
}

export const somenteAnos = (v: number[]): Array<number | null> => v.map((x, t) => (t === 0 ? null : x));

export function acumular(v: number[]): number[] {
  let s = 0;
  return v.map((x) => (s += x));
}
