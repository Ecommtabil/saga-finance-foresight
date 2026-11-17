// Importação de receitas: extrato PGDAS-D (texto do PDF), planilha com mapeamento de colunas e colagem.
// Tudo puro (sem DOM), para testar e reutilizar.
import { COLUNAS_ANEXO, COLUNA_PRINCIPAL, NOME_COLUNA, type AnexoId, type ColunaReceita } from "./tabelas";
import type { ConferenciaRbt12, EmpresaSimples } from "./store";

export interface LinhaImport {
  mes: string | null; // "AAAA-MM"
  anexo?: AnexoId;
  coluna?: ColunaReceita;
  /** Total do mês sem segregação. */
  total?: boolean;
  valor: number | null;
  erro?: string;
  ref?: string;
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const norm = (s: unknown) => semAcento(String(s ?? "")).toLowerCase().trim();
const pad = (n: number) => String(n).padStart(2, "0");
const MESES_ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "1.234,56", "1,234.56", "1234.56", "R$ 1.234", número → número. Texto inválido → null. */
export function lerValor(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v ?? "").replace(/R\$/gi, "").replace(/[\s\u00a0]/g, "");
  if (!s) return null;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (/^[-−–]/.test(s)) { neg = true; s = s.slice(1); }
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (s.includes(",")) {
    s = /^\d{1,3}(,\d{3}){2,}$/.test(s) ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return neg ? -n : n;
}

const ano2 = (y: number) => (y < 100 ? 2000 + y : y);
function mesOk(ano: number, mes: number): string | null {
  if (mes < 1 || mes > 12 || ano < 1990 || ano > 2100) return null;
  return `${ano}-${pad(mes)}`;
}

/** "01/2025", "1/25", "jan/25", "janeiro 2025", "2025-01", "15/01/2025", data ou número de série do Excel → "AAAA-MM". */
export function lerMes(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return mesOk(v.getFullYear(), v.getMonth() + 1);
  if (typeof v === "number") {
    if (v > 20000 && v < 80000) {
      const d = new Date(Math.round((v - 25569) * 86400000));
      return mesOk(d.getUTCFullYear(), d.getUTCMonth() + 1);
    }
    return null;
  }
  const s = norm(v).replace(/\s+/g, " ");
  if (!s) return null;
  let m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(s);
  if (m) return mesOk(ano2(Number(m[3])), Number(m[2]));
  m = /^(\d{4})-(\d{2})(?:-(\d{2}))?(?:[t ].*)?$/.exec(s);
  if (m) return mesOk(Number(m[1]), Number(m[2]));
  m = /^(\d{1,2})[/\-. ](\d{4}|\d{2})$/.exec(s);
  if (m) return mesOk(ano2(Number(m[2])), Number(m[1]));
  m = /^(\d{4})[/\-.](\d{1,2})$/.exec(s);
  if (m) return mesOk(Number(m[1]), Number(m[2]));
  m = /^([a-zç]+)\.?\s*(?:[/\-.]|de)?\s*(\d{4}|\d{2})$/.exec(s);
  if (m) {
    const i = MESES_ABREV.indexOf(m[1].slice(0, 3));
    if (i >= 0) return mesOk(ano2(Number(m[2])), i + 1);
  }
  return null;
}

export function lerAnexo(v: unknown): AnexoId | null {
  const s = norm(v).replace(/^anexo\s*/, "").replace(/[^a-z0-9]/g, "");
  if (!s) return null;
  const mapa: Record<string, AnexoId> = { i: "I", "1": "I", ii: "II", "2": "II", iii: "III", "3": "III", iv: "IV", "4": "IV", v: "V", "5": "V" };
  if (mapa[s]) return mapa[s];
  if (s.startsWith("comerc")) return "I";
  if (s.startsWith("indust")) return "II";
  return null;
}

// ---------------- PGDAS-D ----------------

export interface AtividadePgdas {
  anexo: AnexoId;
  coluna: ColunaReceita;
  valor: number;
  descricao: string;
  /** Débito por tributo declarado para a atividade (IRPJ, CSLL, COFINS, PIS, CPP, ICMS, IPI, ISS, Total). */
  tributos?: TributosPgdas;
}
export interface TributosPgdas { irpj: number; csll: number; cofins: number; pis: number; cpp: number; icms: number; ipi: number; iss: number; total: number }
export interface ExtratoPgdas {
  arquivo: string;
  pa: string | null;
  cnpj: string | null;
  rpa: number | null;
  rbt12: number | null;
  rba: number | null;
  rbaa: number | null;
  /** Valor total do débito declarado (DAS) no PA. */
  das: number | null;
  anteriores: Record<string, number>;
  folha: Record<string, number>;
  atividades: AtividadePgdas[];
  erros: string[];
}

const RE_VALOR = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2})";
const valorBR = (s: string) => lerValor(s) ?? 0;

function trecho(texto: string, inicio: RegExp, fim: RegExp): string {
  const m = inicio.exec(texto);
  if (!m) return "";
  const resto = texto.slice(m.index + m[0].length);
  const j = resto.search(fim);
  return j < 0 ? resto : resto.slice(0, j);
}

function paresMesValor(t: string): Record<string, number> {
  const out: Record<string, number> = {};
  const re = new RegExp(`(\\d{2})\\/(\\d{4})\\s+${RE_VALOR}`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const k = mesOk(Number(m[2]), Number(m[1]));
    if (k) out[k] = valorBR(m[3]);
  }
  return out;
}

/** Último valor (coluna Total) após o rótulo, ex.: "(RBT12) 400.000,00 0,00 400.000,00". */
function valorRotulo(t: string, rotulo: string): number | null {
  const re = new RegExp(`\\(${rotulo}\\)[^\\d(]{0,80}((?:\\d{1,3}(?:\\.\\d{3})*,\\d{2}\\s*){1,3})`, "i");
  const m = re.exec(t);
  if (!m) return null;
  const nums = m[1].trim().split(/\s+/);
  return valorBR(nums[nums.length - 1]);
}

/** Classifica a descrição da atividade do PGDAS-D em anexo + coluna do app. */
export function classificarAtividade(descricao: string, tributos?: TributosPgdas): { anexo: AnexoId; coluna: ColunaReceita } | null {
  const d = norm(descricao).replace(/\(o substitu(?:ido|to) tributario do icms[^)]*\)/g, " ");
  let anexo: AnexoId | null = null;
  if (/revenda de mercadorias/.test(d)) anexo = "I";
  else if (/venda de mercadorias industrializadas/.test(d)) anexo = "II";
  else if (/prestacao de servicos|locacao de bens moveis/.test(d)) {
    const a = /anexo\s+(iii|iv|v)\b/.exec(d);
    anexo = a ? (a[1].toUpperCase() as AnexoId) : "III";
  }
  if (!anexo) return null;
  if (anexo === "I" || anexo === "II") {
    if (/sem substituicao tributaria/.test(d)) return { anexo, coluna: "integral" };
    let icms = /icms/.test(d);
    let mono = /(cofins|pis)/.test(d);
    // Descrição genérica ("Com substituição tributária/tributação monofásica…") sem detalhe: deduz pelos tributos zerados.
    if (!icms && !mono && tributos && tributos.total > 0) {
      icms = tributos.icms === 0;
      mono = tributos.cofins === 0 && tributos.pis === 0;
      if (!icms && !mono) icms = true;
    }
    if (icms && mono) return { anexo, coluna: "stMono" };
    if (mono) return { anexo, coluna: "mono" };
    return { anexo, coluna: "st" };
  }
  if (/sem retencao/.test(d)) return { anexo, coluna: "semRet" };
  if (/com retencao|iss retido|substituicao tributaria de:?\s*iss/.test(d)) return { anexo, coluna: "comRet" };
  return { anexo, coluna: "semRet" };
}

/** Primeira tabela "IRPJ CSLL COFINS PIS/Pasep INSS/CPP ICMS IPI ISS Total" seguida de 9 valores. */
function lerTabelaTributos(t: string): TributosPgdas | null {
  const re = new RegExp(`IRPJ\\s+CSLL\\s+COFINS\\s+PIS(?:\\/Pasep)?\\s+INSS\\/CPP\\s+ICMS\\s+IPI\\s+ISS\\s+Total\\s+((?:${RE_VALOR}\\s*){9})`, "i");
  const m = re.exec(t);
  if (!m) return null;
  const v = m[1].trim().split(/\s+/).map(valorBR);
  return { irpj: v[0], csll: v[1], cofins: v[2], pis: v[3], cpp: v[4], icms: v[5], ipi: v[6], iss: v[7], total: v[8] };
}

export function interpretarPgdas(textoOriginal: string, arquivo: string): ExtratoPgdas {
  const texto = textoOriginal.replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  const erros: string[] = [];
  let pa: string | null = null;
  const mPa = /Per[ií]odo de Apura[cç][aã]o[^0-9]{0,25}(?:(\d{2})\/)?(\d{2})\/(\d{4})/i.exec(texto);
  if (mPa) pa = mesOk(Number(mPa[3]), Number(mPa[2]));
  if (!pa) erros.push("Período de apuração (PA) não encontrado.");
  const mCnpj = /CNPJ(?:\s+(?:Matriz|B[aá]sico|Estabelecimento))?\s*:?\s*(\d{2}\.?\d{3}\.?\d{3}(?:\/?\d{4}-?\d{2})?)/i.exec(texto);
  const cnpj = mCnpj ? mCnpj[1] : null;

  // "(?<![\d.])" evita confundir "2.1" com o fim de "2.2.1)".
  const sec21 = trecho(texto, /(?<![\d.])2\.1\)?\s*Discriminativo|(?<![\d.])2\.1\)/i, /(?<![\d.])2\.2\)?\s*Receitas Brutas Anteriores|(?<![\d.])2\.2\)/i) || texto;
  const sec221 = trecho(texto, /2\.2\.1\)/, /2\.2\.2\)|2\.3\)/) || trecho(texto, /2\.2\)/, /2\.2\.2\)|2\.3\)/);
  const sec23 = trecho(texto, /(?<![\d.])2\.3\)/, /2\.3\.2\)|2\.4\)|\b3\)/);

  const atividades: AtividadePgdas[] = [];
  const iEstab = texto.search(/Informa[cç][oõ]es da Declara[cç][aã]o por Estabelecimento|2\.[89]\)/i);
  const area = iEstab >= 0 ? texto.slice(iEstab) : texto.slice(Math.max(0, texto.search(/2\.3\)/)));
  const reInicio = /(Revenda de mercadorias|Venda de mercadorias industrializadas|Presta[cç][aã]o de servi[cç]os|Loca[cç][aã]o de bens m[oó]veis)/gi;
  const inicios: number[] = [];
  let mi: RegExpExecArray | null;
  while ((mi = reInicio.exec(area))) inicios.push(mi.index);
  for (let k = 0; k < inicios.length; k++) {
    const bloco = area.slice(inicios[k], inicios[k + 1] ?? area.length);
    const mv = new RegExp(`(?:Receita Bruta Informada|Valor (?:da receita|informado))\\s*:?\\s*(?:R\\$)?\\s*${RE_VALOR}`, "i").exec(bloco);
    if (!mv) continue;
    const descricao = bloco.slice(0, mv.index).trim();
    // Depois do valor vêm a tabela de tributos e detalhes como "Substituição tributária de: ICMS." / "Tributação monofásica de: COFINS, PIS".
    let resto = bloco.slice(mv.index + mv[0].length);
    const fimResto = resto.search(/Totais do Estabelecimento|Valor do D[eé]bito por Tributo|Total Geral da Empresa/i);
    if (fimResto >= 0) resto = resto.slice(0, fimResto);
    const tributos = lerTabelaTributos(resto);
    const detalhes = [...resto.matchAll(/(Substitui[cç][aã]o tribut[aá]ria de|monof[aá]sica de|Reten[cç][aã]o (?:de|do)|ISS retido)\s*:?\s*([^.]*)/gi)].map((m) => `${m[1]} ${m[2]}`).join(" ");
    const c = classificarAtividade(`${descricao} ${detalhes}`, tributos ?? undefined);
    if (!c) { erros.push(`Atividade não reconhecida: "${descricao.slice(0, 80)}…"`); continue; }
    atividades.push({ ...c, valor: valorBR(mv[1]), descricao, ...(tributos ? { tributos } : {}) });
  }
  const mDas = new RegExp(`Valor Total do D[eé]bito Declarado\\s*\\(R\\$\\)\\s*${RE_VALOR}\\s+${RE_VALOR}`, "i").exec(texto);
  let das: number | null = mDas ? valorBR(mDas[2]) : null;
  if (das === null) {
    const iGeral = texto.search(/Total Geral da Empresa/i);
    const t = iGeral >= 0 ? lerTabelaTributos(texto.slice(iGeral)) : null;
    das = t ? t.total : null;
  }
  const anteriores = paresMesValor(sec221);
  if (!Object.keys(anteriores).length) erros.push("Seção 2.2.1 (receitas brutas anteriores) não encontrada.");
  return {
    arquivo, pa, cnpj,
    rpa: valorRotulo(sec21, "RPA"), rbt12: valorRotulo(sec21, "RBT12"), rba: valorRotulo(sec21, "RBA"), rbaa: valorRotulo(sec21, "RBAA"), das,
    anteriores, folha: sec23 ? paresMesValor(sec23) : {}, atividades, erros,
  };
}

/** CNPJ do PDF confere com o da empresa? Compara pela raiz (8 dígitos) quando o PDF só traz a raiz. */
export function cnpjConfere(empresa: string, pdf: string | null): boolean {
  const a = empresa.replace(/\D/g, "");
  const b = (pdf ?? "").replace(/\D/g, "");
  if (!a || !b) return true;
  return b.length === 8 ? a.startsWith(b) : a === b;
}

export interface ConsolidacaoPgdas {
  linhas: LinhaImport[];
  conferencias: Record<string, ConferenciaRbt12>;
  folha: Record<string, number>;
  avisos: string[];
}

/** Junta vários extratos. Mesmo mês em mais de um PDF: vale o PDF de PA mais recente. */
export function consolidarPgdas(extratos: ExtratoPgdas[], ano: number, cnpjEmpresa: string): ConsolidacaoPgdas {
  const avisos: string[] = [];
  const ordenados = [...extratos].sort((a, b) => (a.pa ?? "").localeCompare(b.pa ?? ""));
  const totais = new Map<string, { valor: number; ref: string }>();
  const segregadas = new Map<string, Map<string, { anexo: AnexoId; coluna: ColunaReceita; valor: number }>>();
  const conferencias: Record<string, ConferenciaRbt12> = {};
  const folha: Record<string, number> = {};
  for (const x of ordenados) {
    for (const e of x.erros) avisos.push(`${x.arquivo}: ${e}`);
    if (!cnpjConfere(cnpjEmpresa, x.cnpj)) avisos.push(`${x.arquivo}: CNPJ ${x.cnpj} diferente do CNPJ da empresa.`);
    for (const [mes, v] of Object.entries(x.anteriores)) totais.set(mes, { valor: v, ref: x.arquivo });
    Object.assign(folha, x.folha);
    if (x.pa) {
      if (x.atividades.length) {
        const mapa = new Map<string, { anexo: AnexoId; coluna: ColunaReceita; valor: number }>();
        for (const a of x.atividades) {
          const k = `${a.anexo}|${a.coluna}`;
          const atual = mapa.get(k);
          mapa.set(k, { anexo: a.anexo, coluna: a.coluna, valor: (atual?.valor ?? 0) + a.valor });
        }
        segregadas.set(x.pa, mapa);
      } else if (x.rpa !== null) {
        totais.set(x.pa, { valor: x.rpa, ref: x.arquivo });
      }
      if (x.rbt12 !== null && Number(x.pa.slice(0, 4)) === ano) conferencias[x.pa] = { valor: x.rbt12, arquivo: x.arquivo, ...(x.das !== null ? { das: x.das } : {}) };
    }
  }
  const linhas: LinhaImport[] = [];
  const refPa = new Map(ordenados.filter((x) => x.pa).map((x) => [x.pa as string, x.arquivo]));
  for (const [mes, mapa] of segregadas) {
    const ehAno = Number(mes.slice(0, 4)) === ano;
    if (ehAno) for (const s of mapa.values()) linhas.push({ mes, anexo: s.anexo, coluna: s.coluna, valor: s.valor, ref: refPa.get(mes) });
    else {
      const soma = [...mapa.values()].reduce((t, s) => t + s.valor, 0);
      totais.set(mes, { valor: soma, ref: refPa.get(mes) ?? "" });
    }
  }
  for (const [mes, t] of totais) {
    if (Number(mes.slice(0, 4)) === ano && segregadas.has(mes)) continue;
    linhas.push({ mes, total: true, valor: t.valor, ref: t.ref });
  }
  linhas.sort((a, b) => (a.mes ?? "").localeCompare(b.mes ?? ""));
  return { linhas, conferencias, folha, avisos };
}

// ---------------- Planilha ----------------

export interface Mapeamento {
  mes: number;
  anexo: number;
  total: number;
  colunas: Partial<Record<ColunaReceita, number>>;
}
export const TODAS_COLUNAS: ColunaReceita[] = ["integral", "st", "mono", "stMono", "semRet", "comRet"];

export function detectarCabecalho(rows: unknown[][]): number {
  const limite = Math.min(rows.length, 30);
  let fallback = -1;
  for (let i = 0; i < limite; i++) {
    const textos = (rows[i] ?? []).filter((c) => typeof c === "string" && c.trim() && lerValor(c) === null && lerMes(c) === null);
    if (textos.length >= 2) {
      if (textos.some((c) => /m[eê]s|per[ií]odo|compet|data|refer/i.test(String(c)))) return i;
      if (fallback < 0) fallback = i;
    }
  }
  return fallback < 0 ? 0 : fallback;
}

export function sugerirMapeamento(cabecalho: unknown[]): Mapeamento {
  const m: Mapeamento = { mes: -1, anexo: -1, total: -1, colunas: {} };
  const usados = new Set<number>();
  const achar = (re: RegExp) => {
    const i = cabecalho.findIndex((c, idx) => !usados.has(idx) && re.test(norm(c)));
    if (i >= 0) usados.add(i);
    return i;
  };
  m.mes = achar(/^mes|\bmes\b|periodo|competencia|^data|referencia/);
  m.anexo = achar(/anexo/);
  const stMono = achar(/(st|substitui).*(monof)|(monof).*(\bst\b|substitui)/);
  const comRet = achar(/com reten/);
  const semRet = achar(/sem reten/);
  const st = achar(/\bst\b|substitui/);
  const mono = achar(/monof/);
  const integral = achar(/integral|tributad/);
  const total = achar(/total|receita bruta|faturamento|valor|receita/);
  const pares: Array<[ColunaReceita, number]> = [["integral", integral], ["st", st], ["mono", mono], ["stMono", stMono], ["semRet", semRet], ["comRet", comRet]];
  for (const [c, i] of pares) if (i >= 0) m.colunas[c] = i;
  m.total = total;
  return m;
}

export function linhasDePlanilha(rows: unknown[][], linhaCabecalho: number, mapa: Mapeamento): LinhaImport[] {
  const out: LinhaImport[] = [];
  const segregadas = Object.entries(mapa.colunas).filter(([, i]) => (i ?? -1) >= 0) as Array<[ColunaReceita, number]>;
  for (let r = linhaCabecalho + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (!row.some((c) => String(c ?? "").trim() !== "")) continue;
    const brutoMes = mapa.mes >= 0 ? row[mapa.mes] : undefined;
    const mes = lerMes(brutoMes);
    const ref = `Linha ${r + 1}`;
    let anexo: AnexoId | undefined;
    if (mapa.anexo >= 0 && String(row[mapa.anexo] ?? "").trim()) {
      const a = lerAnexo(row[mapa.anexo]);
      if (!a) { out.push({ mes, valor: null, erro: `Anexo não reconhecido: "${String(row[mapa.anexo])}"`, ref }); continue; }
      anexo = a;
    }
    const itens: LinhaImport[] = [];
    for (const [coluna, i] of segregadas) {
      const bruto = row[i];
      if (String(bruto ?? "").trim() === "") continue;
      const v = lerValor(bruto);
      if (v === null) itens.push({ mes, anexo, coluna, valor: null, erro: `Valor inválido: "${String(bruto)}"`, ref });
      else if (v !== 0) itens.push({ mes, anexo, coluna, valor: v, ref });
    }
    if (!itens.length && mapa.total >= 0 && String(row[mapa.total] ?? "").trim() !== "") {
      const v = lerValor(row[mapa.total]);
      if (v === null) itens.push({ mes, anexo, total: true, valor: null, erro: `Valor inválido: "${String(row[mapa.total])}"`, ref });
      else if (v !== 0) itens.push({ mes, anexo, total: true, valor: v, ref });
    }
    if (!itens.length) continue;
    if (!mes) { out.push({ mes: null, valor: null, erro: `Mês não reconhecido: "${String(brutoMes ?? "")}"`, ref }); continue; }
    out.push(...itens);
  }
  return out;
}

/** Duas colunas coladas (mês e valor). */
export function linhasDeColagem(texto: string): LinhaImport[] {
  const out: LinhaImport[] = [];
  texto.split(/\r?\n/).forEach((linha, i) => {
    const l = linha.trim();
    if (!l) return;
    const partes = l.split(/\t|;|\s{2,}/).map((p) => p.trim()).filter(Boolean);
    let mes: string | null = null, valor: number | null = null;
    if (partes.length >= 2) { mes = lerMes(partes[0]); valor = lerValor(partes[partes.length - 1]); }
    else {
      const m = /^(.+?)\s+(\S+)$/.exec(l);
      if (m) { mes = lerMes(m[1]); valor = lerValor(m[2]); }
    }
    const ref = `Linha ${i + 1}`;
    if (!mes && i === 0 && valor === null) return; // cabeçalho
    if (!mes) out.push({ mes: null, valor: null, erro: `Mês não reconhecido: "${partes[0] ?? l}"`, ref });
    else if (valor === null) out.push({ mes, valor: null, erro: `Valor inválido na linha "${l}"`, ref });
    else out.push({ mes, total: true, valor, ref });
  });
  return out;
}

// ---------------- Prévia e aplicação ----------------

export type DestinoTotais = AnexoId | "anterior";
export type StatusPrevia = "novo" | "sobrescrever" | "igual" | "erro";
export interface LinhaPrevia {
  id: string;
  mes: string | null;
  destino: "anterior" | AnexoId | null;
  coluna: ColunaReceita | null;
  valor: number | null;
  atual: number;
  status: StatusPrevia;
  mensagem?: string;
  ref?: string;
}

export function valorAtual(e: EmpresaSimples, destino: "anterior" | AnexoId, mes: number, coluna: ColunaReceita | null): number {
  if (destino === "anterior") return Number(e.anoAnterior[mes]) || 0;
  return Number(coluna ? e.receitas[destino]?.[mes]?.[coluna] : 0) || 0;
}

export function montarPrevia(e: EmpresaSimples, linhas: LinhaImport[], destinoTotais: DestinoTotais): LinhaPrevia[] {
  const out: LinhaPrevia[] = [];
  const agrupado = new Map<string, LinhaPrevia>();
  let n = 0;
  const erro = (l: LinhaImport, mensagem: string, destino: LinhaPrevia["destino"] = null, coluna: ColunaReceita | null = null) =>
    out.push({ id: `e${n++}`, mes: l.mes, destino, coluna, valor: l.valor, atual: 0, status: "erro", mensagem, ref: l.ref });
  for (const l of linhas) {
    if (l.erro || l.valor === null || !l.mes) { erro(l, l.erro ?? "Erro de leitura"); continue; }
    if (l.valor < 0) { erro(l, "Valor negativo não é aceito"); continue; }
    const ano = Number(l.mes.slice(0, 4));
    let destino: "anterior" | AnexoId;
    let coluna: ColunaReceita | null = null;
    if (ano === e.ano - 1) destino = "anterior";
    else if (ano === e.ano) {
      if (l.total || !l.coluna) {
        const alvo = l.anexo ?? destinoTotais;
        if (alvo === "anterior") { erro(l, "Mês do ano-calendário ignorado (totais só no bloco do ano anterior)"); continue; }
        destino = alvo;
        coluna = COLUNA_PRINCIPAL[alvo];
      } else {
        const alvo = l.anexo ?? (destinoTotais === "anterior" ? e.anexos.find((a) => COLUNAS_ANEXO[a].includes(l.coluna as ColunaReceita)) : destinoTotais);
        if (!alvo) { erro(l, "Informe o anexo desta receita"); continue; }
        destino = alvo;
        coluna = l.coluna;
        if (!COLUNAS_ANEXO[alvo].includes(coluna)) { erro(l, `"${NOME_COLUNA[coluna]}" não existe no Anexo ${alvo}`, alvo, coluna); continue; }
      }
      if (!e.anexos.includes(destino)) { erro(l, `Anexo ${destino} não está cadastrado na empresa`, destino, coluna); continue; }
    } else { erro(l, `Fora do período (${ano}): só ${e.ano - 1} e ${e.ano}`); continue; }
    const k = `${destino}|${l.mes}|${coluna ?? ""}`;
    const atual = agrupado.get(k);
    if (atual) { atual.valor = (atual.valor ?? 0) + l.valor; continue; }
    const p: LinhaPrevia = { id: k, mes: l.mes, destino, coluna, valor: l.valor, atual: 0, status: "novo", ref: l.ref };
    agrupado.set(k, p);
    out.push(p);
  }
  for (const p of out) {
    if (p.status === "erro" || !p.mes || !p.destino) continue;
    const mes = Number(p.mes.slice(5, 7)) - 1;
    p.atual = valorAtual(e, p.destino, mes, p.coluna);
    const v = p.valor ?? 0;
    p.status = p.atual === 0 ? "novo" : Math.abs(p.atual - v) < 0.005 ? "igual" : "sobrescrever";
  }
  return out.sort((a, b) => (a.mes ?? "9999").localeCompare(b.mes ?? "9999") || String(a.destino).localeCompare(String(b.destino)));
}

export interface ResultadoAplicacao { empresa: EmpresaSimples; importados: number; sobrescritos: number; ignorados: number }

export function aplicarPrevia(e: EmpresaSimples, previa: LinhaPrevia[], selecionadas: Set<string>, sobrescrever: boolean): ResultadoAplicacao {
  const nova: EmpresaSimples = JSON.parse(JSON.stringify(e));
  const aplicados = new Set<string>(), sobrescritos = new Set<string>(), todos = new Set<string>();
  for (const p of previa) {
    const chaveMes = `${p.destino ?? ""}|${p.mes ?? p.id}`;
    todos.add(chaveMes);
    if (p.status === "erro" || !p.mes || !p.destino || !selecionadas.has(p.id)) continue;
    if (p.status === "sobrescrever" && !sobrescrever) continue;
    const mes = Number(p.mes.slice(5, 7)) - 1;
    const v = p.valor ?? 0;
    if (p.destino === "anterior") nova.anoAnterior[mes] = v;
    else if (p.coluna) {
      const grade = nova.receitas[p.destino] ?? Array.from({ length: 12 }, () => ({}));
      grade[mes] = { ...(grade[mes] ?? {}), [p.coluna]: v };
      nova.receitas[p.destino] = grade;
    }
    aplicados.add(chaveMes);
    if (p.status === "sobrescrever") sobrescritos.add(chaveMes);
  }
  const ignorados = [...todos].filter((k) => !aplicados.has(k)).length;
  return { empresa: nova, importados: aplicados.size, sobrescritos: sobrescritos.size, ignorados };
}
