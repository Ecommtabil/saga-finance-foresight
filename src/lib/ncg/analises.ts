import { resultadoDasPremissas, diasTexto } from "./apresentacao";
import { diasDoPeriodo, type PremissasNCG } from "./premissas";
import type { ResultadoNCG } from "./engine";

export interface AnaliseNCG {
  id: string; empresa: string; cnpj: string; premissas: PremissasNCG;
  resultados: ResultadoNCG; criadoEm: string; atualizadoEm: string;
}
export const CHAVE_ANALISES = "saga.ncg.analises";
export function periodoNCG(p: PremissasNCG) {
  const data = (v: string) => v ? v.split("-").reverse().join("/") : "Não informada";
  return p.dataInicial && p.dataFinal ? `${data(p.dataInicial)} a ${data(p.dataFinal)} (${diasTexto(diasDoPeriodo(p))})` : `${diasTexto(diasDoPeriodo(p))} · datas não informadas`;
}
export function criarAnalise(empresa: string, cnpj: string, premissas: PremissasNCG, id: string, agora: string, anterior?: AnaliseNCG): AnaliseNCG {
  if (!empresa.trim()) throw new Error("Informe o nome da empresa antes de salvar.");
  if (diasDoPeriodo(premissas) <= 0) throw new Error("Informe um período válido antes de salvar.");
  return { id, empresa: empresa.trim(), cnpj: cnpj.trim(), premissas: structuredClone(premissas), resultados: resultadoDasPremissas(premissas), criadoEm: anterior?.criadoEm ?? agora, atualizadoEm: agora };
}
export function salvarNaLista(lista: AnaliseNCG[], analise: AnaliseNCG) {
  return [analise, ...lista.filter(a => a.id !== analise.id)];
}
export function duplicarAnalise(a: AnaliseNCG, id: string, agora: string): AnaliseNCG {
  return criarAnalise(a.empresa, a.cnpj, a.premissas, id, agora);
}
const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
export function buscarAnalises(lista: AnaliseNCG[], busca: string) {
  return lista.filter(a => normalizar(a.empresa).includes(normalizar(busca)));
}
export function mesmaEmpresa(a: AnaliseNCG, b: AnaliseNCG) {
  const ca = a.cnpj.replace(/\D/g, ""); const cb = b.cnpj.replace(/\D/g, "");
  return ca && cb ? ca === cb : normalizar(a.empresa) === normalizar(b.empresa);
}
export function compararAnalises(lista: AnaliseNCG[]) {
  return [...lista].sort((a, b) => (a.premissas.dataInicial || a.criadoEm).localeCompare(b.premissas.dataInicial || b.criadoEm))
    .map((a, i) => {
      const r = resultadoDasPremissas(a.premissas);
      return { id: a.id, periodo: `${i + 1}. ${periodoNCG(a.premissas)}`, pmr: r.prazos.pmr, pme: r.prazos.pme, pmp: r.prazos.pmp, ncg: r.ncg.total };
    });
}