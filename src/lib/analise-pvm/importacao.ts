// Leitura da base PVM (formato longo) a partir de uma matriz de células (Excel/CSV) — sem dependência de navegador.
import { lerMes, lerNumero } from "@/lib/volatilidade/dados";
import type { Metrica, RegistroPVM } from "@/lib/pvm";

export const COLUNAS_PVM = ["Unidade", "Categoria", "Produto", "Métrica", "Mês", "Valor"] as const;
export const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export const normalizar = (v: unknown) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export interface Cabecalho { linha: number; colunas: number[] } // índice de cada coluna obrigatória

export function acharCabecalho(matriz: unknown[][], maxLinhas = 60): Cabecalho | null {
  const alvo = COLUNAS_PVM.map(normalizar);
  for (let r = 0; r < Math.min(matriz.length, maxLinhas); r++) {
    const linha = (matriz[r] ?? []).map(normalizar);
    const colunas = alvo.map(a => linha.indexOf(a));
    if (colunas.every(c => c >= 0)) return { linha: r, colunas };
  }
  return null;
}

/** Nome do mês (Janeiro…), data, serial do Excel, "01/2026", "jan/26" → "AAAA-MM". */
export function lerMesPVM(v: unknown, anoPadrao: number): string | null {
  if (typeof v === "string") {
    const n = normalizar(v);
    const i = MESES_PT.findIndex(m => normalizar(m) === n || normalizar(m).slice(0, 3) === n);
    if (i >= 0) return `${anoPadrao}-${String(i + 1).padStart(2, "0")}`;
  }
  return lerMes(v);
}

export function lerMetrica(v: unknown): Metrica | null {
  const n = normalizar(v);
  if (["quantidade", "qtd", "qtde", "volume", "quantidades"].includes(n)) return "Quantidade";
  if (["receita", "receitas", "faturamento", "valor"].includes(n)) return "Receita";
  return null;
}

export interface ResumoImportacao {
  aba: string;
  linhaCabecalho: number; // 1-based
  linhasLidas: number;
  unidades: string[];
  categorias: string[];
  produtos: string[];
  meses: string[];
  avisos: string[];
  semPar: string[]; // Produto+Unidade+Mês com só uma das métricas
}

export interface ResultadoLeitura { registros: RegistroPVM[]; resumo: ResumoImportacao }

export function lerMatrizPVM(matriz: unknown[][], aba: string, anoPadrao: number): ResultadoLeitura | null {
  const cab = acharCabecalho(matriz);
  if (!cab) return null;
  const [cU, cC, cP, cM, cMes, cV] = cab.colunas;
  const registros: RegistroPVM[] = [];
  const avisos: string[] = [];
  let linhasLidas = 0;
  for (let r = cab.linha + 1; r < matriz.length; r++) {
    const l = matriz[r] ?? [];
    const celulas = [l[cU], l[cC], l[cP], l[cM], l[cMes], l[cV]];
    if (celulas.every(c => c === null || c === undefined || String(c).trim() === "")) continue;
    linhasLidas++;
    const n = r + 1;
    const metrica = lerMetrica(l[cM]);
    if (!metrica) { avisos.push(`Linha ${n}: métrica "${String(l[cM] ?? "")}" não reconhecida (use Quantidade ou Receita) — ignorada.`); continue; }
    const mes = lerMesPVM(l[cMes], anoPadrao);
    if (!mes) { avisos.push(`Linha ${n}: mês "${String(l[cMes] ?? "")}" não reconhecido — ignorada.`); continue; }
    const valor = lerNumero(l[cV]);
    if (valor === null) { avisos.push(`Linha ${n}: valor não numérico ("${String(l[cV] ?? "")}") — ignorada.`); continue; }
    if (valor < 0) avisos.push(`Linha ${n}: valor negativo (${valor.toLocaleString("pt-BR")}) em ${metrica}.`);
    registros.push({
      unidade: String(l[cU] ?? "").trim() || "(sem unidade)",
      categoria: String(l[cC] ?? "").trim() || "(sem categoria)",
      produto: String(l[cP] ?? "").trim() || "(sem produto)",
      metrica, mes, valor,
    });
  }
  const pares = new Map<string, Set<Metrica>>();
  for (const x of registros) {
    const k = `${x.produto} · ${x.unidade} · ${x.mes}`;
    pares.set(k, (pares.get(k) ?? new Set()).add(x.metrica));
  }
  const semPar = [...pares.entries()].filter(([, s]) => s.size === 1).map(([k, s]) => `${k}: tem ${[...s][0]} mas não tem ${[...s][0] === "Quantidade" ? "Receita" : "Quantidade"}`);
  const uniq = (f: (x: RegistroPVM) => string) => [...new Set(registros.map(f))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  return {
    registros,
    resumo: {
      aba, linhaCabecalho: cab.linha + 1, linhasLidas,
      unidades: uniq(x => x.unidade), categorias: uniq(x => x.categoria), produtos: uniq(x => x.produto),
      meses: [...new Set(registros.map(x => x.mes))].sort(), avisos, semPar,
    },
  };
}

/** Escolhe a aba "Base de Dados" (se existir com cabeçalho) ou a primeira aba que tenha o cabeçalho. */
export function lerAbasPVM(abas: Array<{ nome: string; matriz: unknown[][] }>, anoPadrao: number): ResultadoLeitura | null {
  const ordenadas = [...abas].sort((a, b) => Number(normalizar(b.nome) === "base de dados") - Number(normalizar(a.nome) === "base de dados"));
  for (const aba of ordenadas) {
    const r = lerMatrizPVM(aba.matriz, aba.nome, anoPadrao);
    if (r) return r;
  }
  return null;
}

// ---------- Formatação ----------
export function mesNome(mes: string): string {
  const [a, m] = mes.split("-");
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${MESES_PT[i]}/${a}` : mes;
}
export function mesCurtoPVM(mes: string): string {
  const [a, m] = mes.split("-");
  const i = Number(m) - 1;
  return i >= 0 && i < 12 ? `${MESES_PT[i].slice(0, 3).toLowerCase()}/${a.slice(2)}` : mes;
}
export function periodoNome(meses: string[]): string {
  if (!meses.length) return "—";
  return meses.length === 1 ? mesNome(meses[0]) : `${mesNome(meses[0])} a ${mesNome(meses[meses.length - 1])}`;
}
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const brlInteiro = (v: number) => `${v < 0 ? "−" : ""}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`;
export const brlSinal = (v: number) => `${v < 0 ? "−" : "+"}R$ ${Math.abs(Math.round(v)).toLocaleString("pt-BR")}`;
export const qtd = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
export const pct2 = (v: number) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const pctSinal = (v: number) => `${v < 0 ? "−" : "+"}${(Math.abs(v) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const brlCompacto = (v: number) => {
  const a = Math.abs(v), s = v < 0 ? "−" : "";
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};
