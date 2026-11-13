// Motor puro de Preço, Volume e Mix (PVM) — replica a lógica da planilha de PVM.

export type Metrica = "Quantidade" | "Receita";
export type NivelPVM = "unidade" | "categoria" | "produto";

export interface RegistroPVM {
  unidade: string;
  categoria: string;
  produto: string;
  metrica: Metrica;
  mes: string; // "AAAA-MM"
  valor: number;
}

export interface FiltrosPVM { unidades: string[]; categorias: string[]; produtos: string[] }
export const SEM_FILTROS: FiltrosPVM = { unidades: [], categorias: [], produtos: [] };

export type StatusItem = "normal" | "novo" | "descontinuado" | "sem-volume";

export interface ItemPVM {
  item: string;
  q0: number; q1: number; r0: number; r1: number;
  mix0: number; mix1: number; p0: number; p1: number;
  dQ: number; dR: number; dP: number; dMix: number;
  volume: number; preco: number; mix: number; total: number;
  status: StatusItem;
}

export interface TotaisPVM {
  q0: number; q1: number; r0: number; r1: number;
  p0: number; p1: number; dQ: number; dR: number;
  volume: number; preco: number; mix: number; total: number;
}

export interface ResultadoPVM {
  nivel: NivelPVM;
  base: string[];
  atual: string[];
  itens: ItemPVM[];
  total: TotaisPVM;
  diferenca: number; // (Volume + Preço + Mix) − (R1 − R0)
  conciliado: boolean;
}

export class ErroPVM extends Error {}

export const TOLERANCIA_CONCILIACAO = 0.01;

const CAMPO: Record<NivelPVM, keyof RegistroPVM> = { unidade: "unidade", categoria: "categoria", produto: "produto" };

export function aplicarFiltros(registros: RegistroPVM[], f: FiltrosPVM): RegistroPVM[] {
  return registros.filter(r =>
    (!f.unidades.length || f.unidades.includes(r.unidade)) &&
    (!f.categorias.length || f.categorias.includes(r.categoria)) &&
    (!f.produtos.length || f.produtos.includes(r.produto)));
}

export function mesesDisponiveis(registros: RegistroPVM[]): string[] {
  return [...new Set(registros.map(r => r.mes))].sort();
}

export interface OpcoesPVM { base: string[]; atual: string[]; nivel: NivelPVM; filtros?: FiltrosPVM }

/** Calcula o PVM. Lança ErroPVM quando um mês não tem dados ou não há volume no período base/atual. */
export function calcularPVM(todos: RegistroPVM[], o: OpcoesPVM): ResultadoPVM {
  if (!o.base.length || !o.atual.length) throw new ErroPVM("Selecione o período base e o período atual.");
  const registros = aplicarFiltros(todos, o.filtros ?? SEM_FILTROS);
  const comDados = new Set(registros.map(r => r.mes));
  const faltando = [...o.base, ...o.atual].filter(m => !comDados.has(m));
  if (faltando.length) throw new ErroPVM(`Sem dados para ${[...new Set(faltando)].join(", ")} com os filtros atuais.`);
  const base = new Set(o.base);
  const atual = new Set(o.atual);
  const campo = CAMPO[o.nivel];

  // Passo 1: agregação (SOMASES)
  const agg = new Map<string, { q0: number; q1: number; r0: number; r1: number }>();
  for (const r of registros) {
    const emBase = base.has(r.mes), emAtual = atual.has(r.mes);
    if (!emBase && !emAtual) continue;
    const k = String(r[campo]);
    const a = agg.get(k) ?? { q0: 0, q1: 0, r0: 0, r1: 0 };
    if (r.metrica === "Quantidade") { if (emBase) a.q0 += r.valor; if (emAtual) a.q1 += r.valor; }
    else { if (emBase) a.r0 += r.valor; if (emAtual) a.r1 += r.valor; }
    agg.set(k, a);
  }
  let Q0 = 0, Q1 = 0, R0 = 0, R1 = 0;
  for (const a of agg.values()) { Q0 += a.q0; Q1 += a.q1; R0 += a.r0; R1 += a.r1; }
  if (Q0 === 0) throw new ErroPVM("Não há quantidade no período base: o preço médio não pode ser calculado.");
  if (Q1 === 0) throw new ErroPVM("Não há quantidade no período atual: o preço médio não pode ser calculado.");
  const P0 = R0 / Q0;
  const P1 = R1 / Q1;

  // Passos 2 e 3: indicadores e efeitos por item
  const itens: ItemPVM[] = [...agg.entries()].map(([item, a]) => {
    const status: StatusItem = a.q0 === 0 && a.q1 === 0 ? "sem-volume" : a.q0 === 0 ? "novo" : a.q1 === 0 ? "descontinuado" : "normal";
    const mix0 = a.q0 / Q0;
    const mix1 = a.q1 / Q1;
    const p0 = a.q0 !== 0 ? a.r0 / a.q0 : P0;
    const p1 = a.q1 !== 0 ? a.r1 / a.q1 : P1;
    const dQ = a.q1 - a.q0, dR = a.r1 - a.r0, dP = p1 - p0, dMix = mix1 - mix0;
    const volume = dQ * P0;
    const preco = dP * a.q1;
    const mix = dMix * (p0 - P0) * Q1;
    return { item, ...a, mix0, mix1, p0, p1, dQ, dR, dP, dMix, volume, preco, mix, total: volume + preco + mix, status };
  }).sort((x, y) => x.item.localeCompare(y.item, "pt-BR"));

  const soma = (k: "volume" | "preco" | "mix") => itens.reduce((s, i) => s + i[k], 0);
  const volume = soma("volume"), preco = soma("preco"), mix = soma("mix");
  const total = volume + preco + mix;
  const diferenca = total - (R1 - R0);
  return {
    nivel: o.nivel, base: [...o.base], atual: [...o.atual], itens,
    total: { q0: Q0, q1: Q1, r0: R0, r1: R1, p0: P0, p1: P1, dQ: Q1 - Q0, dR: R1 - R0, volume, preco, mix, total },
    diferenca, conciliado: Math.abs(diferenca) < TOLERANCIA_CONCILIACAO,
  };
}

/** Calcula com segurança (retorna a mensagem de erro em vez de lançar). */
export function tentarPVM(registros: RegistroPVM[], o: OpcoesPVM): { ok: true; r: ResultadoPVM } | { ok: false; erro: string } {
  try { return { ok: true, r: calcularPVM(registros, o) }; }
  catch (e) { return { ok: false, erro: e instanceof Error ? e.message : "Não foi possível calcular." }; }
}

export interface TransicaoPVM { base: string; atual: string; resultado: ResultadoPVM | null; erro: string | null }

/** Modo "Mês a mês": cada mês contra o anterior. */
export function pvmMesAMes(registros: RegistroPVM[], meses: string[], nivel: NivelPVM, filtros?: FiltrosPVM): TransicaoPVM[] {
  return meses.slice(1).map((m, i) => {
    const t = tentarPVM(registros, { base: [meses[i]], atual: [m], nivel, filtros });
    return { base: meses[i], atual: m, resultado: t.ok ? t.r : null, erro: t.ok ? null : t.erro };
  });
}

/** Intervalo fechado de meses disponíveis (para o modo "Acumulado"). */
export function intervalo(meses: string[], de: string, ate: string): string[] {
  const [a, b] = de <= ate ? [de, ate] : [ate, de];
  return meses.filter(m => m >= a && m <= b);
}
