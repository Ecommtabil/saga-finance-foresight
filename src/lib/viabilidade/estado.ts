// Estado local (navegador) dos Estudos de Viabilidade. Chaves "saga.*" acompanham o projeto ativo.
import { formatBRL, formatNumero, formatPct, formatAnos } from "@/lib/finance";
import { ESTUDOS, type DefinicaoEstudo, type PremissasPorEstudo } from "./estudos";
import type { CampoPremissa, EstudoId, FormatoValor, RelatorioEstudo } from "./tipos";

export const CHAVE_ESTUDO = (id: EstudoId) => `saga.viabilidade.estudo.${id}`;
export const CHAVE_CABECALHO = "saga.viabilidade.cabecalho";
export const CHAVE_CENARIOS = "saga.viabilidade.cenarios";

export interface CabecalhoEstudo {
  cliente: string;
  cnpj: string;
  responsavel: string;
  dataBase: string; // AAAA-MM-DD
}

export const CABECALHO_VAZIO: CabecalhoEstudo = { cliente: "", cnpj: "", responsavel: "", dataBase: "" };

export interface Cenario<K extends EstudoId = EstudoId> {
  id: string;
  nome: string;
  estudo: K;
  premissas: PremissasPorEstudo[K];
  cabecalho: CabecalhoEstudo;
  criadoEm: string;
}

export function lerCenarios(): Cenario[] {
  try {
    const raw = localStorage.getItem(CHAVE_CENARIOS);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? (v as Cenario[]).filter((c) => c && c.id && c.estudo in ESTUDOS) : [];
  } catch {
    return [];
  }
}

export function gravarCenarios(lista: Cenario[]): boolean {
  try {
    localStorage.setItem(CHAVE_CENARIOS, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

const novoId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(16).slice(2)}`);

export function salvarCenario<K extends EstudoId>(nome: string, estudo: K, premissas: PremissasPorEstudo[K], cabecalho: CabecalhoEstudo): Cenario<K> | null {
  const c: Cenario<K> = { id: novoId(), nome: nome.trim() || "Cenário", estudo, premissas, cabecalho, criadoEm: new Date().toISOString() };
  return gravarCenarios([c as Cenario, ...lerCenarios()]) ? c : null;
}

export function duplicarCenario(id: string): boolean {
  const lista = lerCenarios();
  const c = lista.find((x) => x.id === id);
  if (!c) return false;
  const copia: Cenario = { ...c, id: novoId(), nome: `${c.nome} (cópia)`, criadoEm: new Date().toISOString() };
  return gravarCenarios([copia, ...lista]);
}

export function excluirCenario(id: string): boolean {
  return gravarCenarios(lerCenarios().filter((x) => x.id !== id));
}

/** Coloca o cenário como estado atual do estudo (a página do estudo lê ao abrir). */
export function carregarCenarioNoEstudo(c: Cenario): boolean {
  try {
    localStorage.setItem(CHAVE_ESTUDO(c.estudo), JSON.stringify(c.premissas));
    localStorage.setItem(CHAVE_CABECALHO, JSON.stringify({ ...CABECALHO_VAZIO, ...c.cabecalho }));
    return true;
  } catch {
    return false;
  }
}

// ---------- Formatação ----------
export function formatarValor(v: number | null, formato: FormatoValor, textoNulo = "–"): string {
  if (v === null || !Number.isFinite(v)) return textoNulo;
  switch (formato) {
    case "brl": return formatBRL(v);
    case "pct": return formatPct(v);
    case "anos": return formatAnos(v);
    case "x": return formatNumero(v, 2);
    default: return formatNumero(v, 0);
  }
}

export function formatarPremissa<P>(campo: CampoPremissa<P>, valor: unknown): string {
  if (campo.tipo === "bool") return valor ? "Sim" : "Não";
  const n = typeof valor === "number" ? valor : Number(valor);
  if (!Number.isFinite(n)) return "–";
  if (campo.tipo === "brl") return formatBRL(n);
  if (campo.tipo === "pct") return formatPct(n);
  return formatNumero(n, 0);
}

export function camposVisiveis<K extends EstudoId>(id: K, p: PremissasPorEstudo[K]): CampoPremissa<PremissasPorEstudo[K]>[] {
  const campos = ESTUDOS[id].campos as CampoPremissa<PremissasPorEstudo[K]>[];
  return campos.filter((c) => !c.visivel || c.visivel(p));
}

export function formatarCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function dataBR(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

export function nomeArquivo(def: DefinicaoEstudo, cab: CabecalhoEstudo, ext: string): string {
  const limpar = (s: string) => s.trim().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_").slice(0, 60);
  return `Ecommtabil_Viabilidade_${limpar(def.titulo)}${cab.cliente ? `_${limpar(cab.cliente)}` : ""}.${ext}`;
}

/** Parágrafo executivo para e-mail/WhatsApp. */
export function resumoExecutivo(def: DefinicaoEstudo, cab: CabecalhoEstudo, rel: RelatorioEstudo): string {
  const quem = cab.cliente ? `${cab.cliente}${cab.cnpj ? ` (CNPJ ${cab.cnpj})` : ""}` : "Cliente";
  const data = cab.dataBase ? `, data-base ${dataBR(cab.dataBase)}` : "";
  const kpis = rel.kpis.map((k) => `${k.rotulo}: ${formatarValor(k.valor, k.formato, k.textoNulo)}`).join("; ");
  const resp = cab.responsavel ? `\nResponsável técnico: ${cab.responsavel}.` : "";
  return `Estudo de viabilidade — ${def.titulo}\n${quem}${data}, horizonte de ${rel.anos} anos.\n\nParecer: ${rel.parecer.titulo}. ${rel.parecer.texto}\n\nIndicadores: ${kpis}.${resp}\n\nEcommtabil – Contabilidade e Consultoria`;
}
