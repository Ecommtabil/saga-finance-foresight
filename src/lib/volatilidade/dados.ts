// Modelo de dados do Estudo de Volatilidade + leitura de meses e números no padrão brasileiro.
import { estatisticas, type Estatisticas } from "./stats";

export interface SerieDef { id: string; nome: string; cor: string }
export interface Celula { valor: number | null; ajuste?: number; obs?: string }
export interface LinhaMes { mes: string; valores: Record<string, Celula> } // mes = "AAAA-MM"

export interface Estudo {
  id: string;
  cliente: string;
  cnpj: string;
  responsavel: string;
  dataAnalise: string; // AAAA-MM-DD
  series: SerieDef[];
  linhas: LinhaMes[];
  filtro: { inicio: string | null; fim: string | null };
  diagnostico: string | null; // null = texto automático
  criadoEm: string;
  atualizadoEm: string;
}

export interface ConfigVolatilidade {
  cvBaixo: number;
  cvModerado: number;
  pontosCurva: number;
  confianca: number;
  mostrarMomentos: boolean;
  escuro: boolean;
}

export const CONFIG_PADRAO: ConfigVolatilidade = {
  cvBaixo: 0.1, cvModerado: 0.2, pontosCurva: 200, confianca: 0.95, mostrarMomentos: true, escuro: false,
};

export const PALETA_SERIES = ["#1F4E8C", "#C9A227", "#2E7D6B", "#B5473A", "#7A5BA6", "#4F6D7A", "#D9822B"];

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_EN = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

export function ordenarLinhas(linhas: LinhaMes[]): LinhaMes[] {
  return [...linhas].sort((a, b) => a.mes.localeCompare(b.mes));
}

export function valorEfetivo(c: Celula | undefined): number | null {
  if (!c || c.valor == null || !Number.isFinite(c.valor)) return null;
  return c.valor + (c.ajuste ?? 0);
}

export function celulaAjustada(c: Celula | undefined): boolean {
  return !!c && ((c.ajuste ?? 0) !== 0 || !!c.obs?.trim());
}

/** "2022-01" → "01/2022" */
export function mesTexto(mes: string): string {
  const [a, m] = mes.split("-");
  return a && m ? `${m}/${a}` : mes;
}

/** "2022-01" → "jan/22" (rótulo curto para gráficos) */
export function mesCurto(mes: string): string {
  const [a, m] = mes.split("-");
  const i = Number(m) - 1;
  return a && i >= 0 && i < 12 ? `${MESES[i]}/${a.slice(2)}` : mes;
}

function ano(t: string): number | null {
  const n = Number(t);
  if (!Number.isInteger(n)) return null;
  if (t.length === 2) return 2000 + n;
  if (t.length === 4 && n >= 1900 && n <= 2200) return n;
  return null;
}
const chave = (a: number, m: number) => `${a}-${String(m).padStart(2, "0")}`;

/** Interpreta jan/22, janeiro/2022, 01/2022, 2022-01, 01/01/2022, Date ou serial do Excel. */
export function lerMes(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return chave(v.getFullYear(), v.getMonth() + 1);
  if (typeof v === "number") {
    if (v > 20000 && v < 80000 && Number.isInteger(v)) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return chave(d.getUTCFullYear(), d.getUTCMonth() + 1);
    }
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (!s) return null;
  let r = s.match(/^([a-z]{3,})[\s./-]*(\d{2}|\d{4})$/);
  if (r) {
    const p = r[1].slice(0, 3);
    let i = MESES.indexOf(p);
    if (i < 0) i = MESES_EN.indexOf(p);
    const a = ano(r[2]);
    return i >= 0 && a ? chave(a, i + 1) : null;
  }
  r = s.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.]\d{1,2})?$/);
  if (r) { const m = Number(r[2]); return m >= 1 && m <= 12 ? chave(Number(r[1]), m) : null; }
  r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/); // dd/mm/aaaa
  if (r) { const m = Number(r[2]); const a = ano(r[3]); return a && m >= 1 && m <= 12 ? chave(a, m) : null; }
  r = s.match(/^(\d{1,2})[-/.](\d{2}|\d{4})$/); // mm/aaaa
  if (r) { const m = Number(r[1]); const a = ano(r[2]); return a && m >= 1 && m <= 12 ? chave(a, m) : null; }
  return null;
}

/** Interpreta números no padrão brasileiro: 1.234,56 · R$ 476.288,42 · (1.000) · −50.000 */
export function lerNumero(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.trim().replace(/\u00a0/g, " ").replace(/[−–]/g, "-");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  s = s.replace(/r\$/i, "").replace(/\s/g, "");
  if (s.startsWith("-")) { neg = !neg; s = s.slice(1); }
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null;
  const ultPonto = s.lastIndexOf(".");
  const ultVirg = s.lastIndexOf(",");
  if (ultPonto >= 0 && ultVirg >= 0) {
    s = ultVirg > ultPonto ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (ultVirg >= 0) {
    s = (s.match(/,/g)!.length > 1) ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (ultPonto >= 0) {
    const partes = s.split(".");
    const milhar = partes.length > 2 || (partes.length === 2 && partes[1].length === 3);
    if (milhar) s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

// ---------- Importação tabular (Excel, CSV ou colado) ----------

export interface GradeImportada { cabecalho: string[]; linhas: unknown[][] }
export interface SugestaoColunas { colunaMes: number; colunasSeries: number[] }

export function gradeDeTexto(texto: string): GradeImportada {
  const linhas = texto.replace(/\r/g, "").split("\n").filter(l => l.trim()).map(l => l.split(l.includes("\t") ? "\t" : ";"));
  return gradeDeMatriz(linhas);
}

export function gradeDeMatriz(matriz: unknown[][]): GradeImportada {
  const linhas = matriz.filter(l => l.some(c => c !== null && c !== undefined && String(c).trim() !== ""));
  if (!linhas.length) return { cabecalho: [], linhas: [] };
  const largura = Math.max(...linhas.map(l => l.length));
  const primeira = linhas[0];
  const temCabecalho = primeira.some(c => typeof c === "string" && lerNumero(c) === null && lerMes(c) === null && c.trim() !== "");
  const cabecalho = Array.from({ length: largura }, (_, i) =>
    temCabecalho ? String(primeira[i] ?? "").trim() || `Coluna ${i + 1}` : `Coluna ${i + 1}`);
  const corpo = (temCabecalho ? linhas.slice(1) : linhas).map(l => Array.from({ length: largura }, (_, i) => l[i] ?? null));
  return { cabecalho, linhas: corpo };
}

export function sugerirColunas(g: GradeImportada): SugestaoColunas {
  const n = Math.max(1, g.linhas.length);
  const taxa = (i: number, f: (v: unknown) => unknown) => g.linhas.filter(l => f(l[i]) !== null).length / n;
  let colunaMes = -1, melhor = 0;
  g.cabecalho.forEach((_, i) => { const t = taxa(i, lerMes); if (t > melhor) { melhor = t; colunaMes = i; } });
  if (melhor < 0.5) colunaMes = -1;
  const colunasSeries = g.cabecalho.map((_, i) => i).filter(i => i !== colunaMes && taxa(i, lerNumero) >= 0.5);
  return { colunaMes, colunasSeries };
}

export interface ResultadoImportacao { series: SerieDef[]; linhas: LinhaMes[]; avisos: string[] }

export function importarGrade(g: GradeImportada, colunaMes: number, colunasSeries: number[], novoId: () => string, seriesExistentes: SerieDef[] = []): ResultadoImportacao {
  const avisos: string[] = [];
  const series = colunasSeries.map((c, i) => {
    const nome = g.cabecalho[c] || `Série ${i + 1}`;
    const existente = seriesExistentes.find(s => s.nome.toLowerCase() === nome.toLowerCase());
    return existente ?? { id: novoId(), nome, cor: PALETA_SERIES[(seriesExistentes.length + i) % PALETA_SERIES.length] };
  });
  const porMes = new Map<string, LinhaMes>();
  g.linhas.forEach((l, idx) => {
    const mes = lerMes(l[colunaMes]);
    const nLinha = idx + 2;
    if (!mes) { avisos.push(`Linha ${nLinha}: mês não reconhecido ("${String(l[colunaMes] ?? "")}") — ignorada.`); return; }
    if (porMes.has(mes)) avisos.push(`Mês duplicado ${mesTexto(mes)} (linha ${nLinha}): mantido o último valor.`);
    const linha = porMes.get(mes) ?? { mes, valores: {} };
    colunasSeries.forEach((c, i) => {
      const bruto = l[c];
      if (bruto === null || bruto === undefined || String(bruto).trim() === "") return;
      const n = lerNumero(bruto);
      if (n === null) { avisos.push(`Linha ${nLinha}, ${series[i].nome}: valor não numérico ("${String(bruto)}") — ignorado.`); return; }
      if (n < 0) avisos.push(`Linha ${nLinha}, ${series[i].nome}: valor negativo (${n.toLocaleString("pt-BR")}).`);
      linha.valores[series[i].id] = { valor: n };
    });
    porMes.set(mes, linha);
  });
  return { series, linhas: ordenarLinhas([...porMes.values()]), avisos };
}

// ---------- Estudo, filtro e validações ----------

export function linhasFiltradas(e: Estudo): LinhaMes[] {
  const { inicio, fim } = e.filtro;
  return ordenarLinhas(e.linhas).filter(l => (!inicio || l.mes >= inicio) && (!fim || l.mes <= fim));
}

export interface SerieCalculada { serie: SerieDef; meses: string[]; valores: number[]; stats: Estatisticas }

export function calcularSeries(e: Estudo): SerieCalculada[] {
  const linhas = linhasFiltradas(e);
  return e.series.map(serie => {
    const meses: string[] = [];
    const valores: number[] = [];
    for (const l of linhas) {
      const v = valorEfetivo(l.valores[serie.id]);
      if (v !== null) { meses.push(l.mes); valores.push(v); }
    }
    return { serie, meses, valores, stats: estatisticas(valores) };
  });
}

export interface Validacao { nivel: "erro" | "aviso"; texto: string }

export function validarEstudo(e: Estudo): Validacao[] {
  const out: Validacao[] = [];
  const vistos = new Set<string>();
  for (const l of e.linhas) {
    if (vistos.has(l.mes)) out.push({ nivel: "erro", texto: `Mês duplicado: ${mesTexto(l.mes)}. Corrija ou remova uma das linhas.` });
    vistos.add(l.mes);
  }
  for (const s of calcularSeries(e)) {
    if (s.valores.length < 3) out.push({ nivel: "erro", texto: `${s.serie.nome}: são necessários pelo menos 3 meses com valor (há ${s.valores.length}).` });
    else if (s.valores.length < 12) out.push({ nivel: "aviso", texto: `${s.serie.nome}: amostra pequena (${s.valores.length} meses) — resultados indicativos.` });
    const neg = s.valores.map((v, i) => [v, s.meses[i]] as const).filter(([v]) => v < 0);
    if (neg.length) out.push({ nivel: "aviso", texto: `${s.serie.nome}: valores negativos em ${neg.map(([, m]) => mesTexto(m)).join(", ")}.` });
  }
  return out;
}

export function serieValida(s: SerieCalculada): boolean {
  return s.valores.length >= 3 && s.stats.desvio > 0;
}

const EXEMPLO: Array<[string, number, number]> = [
  ["2022-01", 476288.42, 413574], ["2022-02", 527830.72, 485190], ["2022-03", 479158.62, 556124],
  ["2022-04", 492078.56, 539352], ["2022-05", 559475.67, 451669], ["2022-06", 566317, 685936],
  ["2022-07", 530482, 459010], ["2022-08", 504035, 680181],
];

export function seriesPadrao(): SerieDef[] {
  return [
    { id: "faturamento", nome: "Faturamento", cor: PALETA_SERIES[0] },
    { id: "recebimento", nome: "Recebimento", cor: PALETA_SERIES[1] },
  ];
}

export function linhasExemplo(): LinhaMes[] {
  return EXEMPLO.map(([mes, f, r]) => ({ mes, valores: { faturamento: { valor: f }, recebimento: { valor: r } } }));
}

export function estudoExemplo(id = "estudo-inicial", agora = ""): Estudo {
  return {
    id, cliente: "Cliente Exemplo Ltda.", cnpj: "", responsavel: "", dataAnalise: agora.slice(0, 10),
    series: seriesPadrao(), linhas: linhasExemplo(), filtro: { inicio: null, fim: null }, diagnostico: null,
    criadoEm: agora, atualizadoEm: agora,
  };
}

export function estudoVazio(id: string, agora: string): Estudo {
  return { ...estudoExemplo(id, agora), cliente: "", linhas: [] };
}

/** Localiza Faturamento e Recebimento pelo nome. */
export function parGap(series: SerieDef[]): { fat: SerieDef; rec: SerieDef } | null {
  const fat = series.find(s => /fatur/i.test(s.nome));
  const rec = series.find(s => /receb/i.test(s.nome));
  return fat && rec ? { fat, rec } : null;
}

export function mascararCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// ---------- Formatação ----------

export function moeda(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function numero(v: number, casas = 2): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
export function pct(v: number, casas = 1): string {
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}
/** R$ 482 mil · R$ 1,2 mi */
export function moedaCompacta(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${Math.round(a / 1e3).toLocaleString("pt-BR")} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}
