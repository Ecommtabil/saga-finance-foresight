import { calcularNCG } from "./engine";
import { entradasDasPremissas } from "./apresentacao";
import type { PremissasNCG } from "./premissas";

export interface AlavancasNCG { pmr: number; pme: number; pmp: number; vendas: number }
export const SIMULACAO_NEUTRA: AlavancasNCG = { pmr: 0, pme: 0, pmp: 0, vendas: 0 };
const limitar = (v: number, limite: number) => Math.min(limite, Math.max(-limite, Number.isFinite(v) ? v : 0));

/** Adapts average balances to target terms, then delegates all NCG calculations to the engine. */
export function simularNCG(p: PremissasNCG, alavancas: AlavancasNCG) {
  const entradas = entradasDasPremissas(p);
  const atual = calcularNCG(entradas);
  const fator = 1 + limitar(alavancas.vendas, 50) / 100;
  const prazos = {
    pmr: Math.max(0, atual.prazos.pmr + limitar(alavancas.pmr, 30)),
    pme: Math.max(0, atual.prazos.pme + limitar(alavancas.pme, 30)),
    pmp: Math.max(0, atual.prazos.pmp + limitar(alavancas.pmp, 30)),
  };
  const bases = { vendasDia: atual.bases.vendasDia * fator, cmvDia: atual.bases.cmvDia * fator, comprasDia: atual.bases.comprasDia * fator };
  const simulada = calcularNCG({
    ...entradas,
    vendas: entradas.vendas * fator, cmv: entradas.cmv * fator, compras: entradas.compras * fator,
    clientesMedio: bases.vendasDia * prazos.pmr,
    estoquesMedio: bases.cmvDia * prazos.pme,
    fornecedoresMedio: bases.comprasDia * prazos.pmp,
  });
  return { atual, simulada, prazos, impactoDia: { pmr: bases.vendasDia, pme: bases.cmvDia, pmp: bases.comprasDia }, variacao: simulada.ncg.total - atual.ncg.total };
}