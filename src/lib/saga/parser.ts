import * as XLSX from "xlsx";
import type { Balanco, DRE, DadosImportados, Modo, Premissas } from "./types";

export class PlanilhaError extends Error {
  constructor(public aba: string, public detalhe: string) {
    super(`[${aba}] ${detalhe}`);
  }
}

function getSheet(wb: XLSX.WorkBook, nome: string, posicao?: number): XLSX.WorkSheet {
  const found =
    wb.SheetNames.find((n) => norm(n) === norm(nome)) ??
    (posicao != null ? wb.SheetNames[posicao] : undefined);
  if (!found) {
    throw new PlanilhaError(nome, `Aba "${nome}" não encontrada na planilha.`);
  }
  return wb.Sheets[found];
}

function norm(s: any) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Lê as linhas na MESMA ORDEM da planilha modelo, independente do nome
 * digitado pelo usuário na coluna A. Guarda o nome usado para exibição.
 */
function lerPorPosicao(
  rows: any[][],
  campos: { key: string; label: string }[],
  aba: string,
  prefixo: string,
  rotulos: Record<string, string>,
): Record<string, number[]> {
  const dados = rows.filter(
    (r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim() !== ""),
  );
  // descarta o cabeçalho (primeira linha sem valores numéricos)
  const temNumero = (r: any[]) =>
    r.slice(1, 6).some((c) => c !== "" && c != null && !isNaN(Number(c)));
  const linhas = dados.length && !temNumero(dados[0]) ? dados.slice(1) : dados;
  if (linhas.length < campos.length) {
    throw new PlanilhaError(
      aba,
      `A aba deve ter ${campos.length} linhas de contas na ordem da planilha modelo; foram encontradas ${linhas.length}.`,
    );
  }
  const out: Record<string, number[]> = {};
  campos.forEach((c, i) => {
    const r = linhas[i]!;
    out[c.key] = [0, 1, 2, 3, 4].map((j) => Number(r[j + 1]) || 0);
    const nome = String(r[0] ?? "").trim();
    if (nome && norm(nome) !== norm(c.label)) rotulos[`${prefixo}.${c.key}`] = nome;
  });
  return out;
}

export const CAMPOS_DRE: { key: keyof DRE; label: string }[] = [
  { key: "receitaBruta", label: "Receita Bruta" },
  { key: "deducoes", label: "Deduções" },
  { key: "receitaLiquida", label: "Receita Líquida" },
  { key: "cmv", label: "CMV" },
  { key: "lucroBruto", label: "Lucro Bruto" },
  { key: "despOperacionais", label: "Despesas Operacionais" },
  { key: "ebitda", label: "EBITDA" },
  { key: "depreciacao", label: "Depreciação" },
  { key: "ebit", label: "EBIT" },
  { key: "resultadoFinanceiro", label: "Resultado Financeiro" },
  { key: "lair", label: "LAIR" },
  { key: "impostos", label: "Impostos" },
  { key: "lucroLiquido", label: "Lucro Líquido" },
];

export const CAMPOS_BP: { key: keyof Balanco; label: string }[] = [
  { key: "caixa", label: "Caixa e Equivalentes" },
  { key: "contasReceber", label: "Contas a Receber" },
  { key: "estoques", label: "Estoques" },
  { key: "ativoCirculante", label: "Ativo Circulante" },
  { key: "ativoNaoCirculante", label: "Ativo Não Circulante" },
  { key: "ativoTotal", label: "Ativo Total" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "emprestimosCP", label: "Empréstimos CP" },
  { key: "passivoCirculante", label: "Passivo Circulante" },
  { key: "emprestimosLP", label: "Empréstimos LP" },
  { key: "passivoNaoCirculante", label: "Passivo Não Circulante" },
  { key: "patrimonioLiquido", label: "Patrimônio Líquido" },
  { key: "passivoTotal", label: "Passivo + PL Total" },
];

function parseDRE(wb: XLSX.WorkBook, rotulos: Record<string, string>): DRE {
  const ws = getSheet(wb, "DRE", 1);
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  return lerPorPosicao(rows, CAMPOS_DRE, "DRE", "dre", rotulos) as unknown as DRE;
}

function parseBalanco(
  wb: XLSX.WorkBook,
  modo: Modo,
  rotulos: Record<string, string>,
): Balanco | null {
  if (modo === "basica") {
    const ws = getSheet(wb, "Balanco_Simplificado", 2);
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const v = lerPorPosicao(
      rows,
      [
        { key: "caixa", label: "Caixa e Equivalentes" },
        { key: "divida", label: "Dívida Total" },
        { key: "pl", label: "Patrimônio Líquido" },
      ],
      "Balanco_Simplificado",
      "bps",
      rotulos,
    );
    const caixa = v.caixa!;
    const divida = v.divida!;
    const pl = v.pl!;
    return {
      caixa,
      contasReceber: [0, 0, 0, 0, 0],
      estoques: [0, 0, 0, 0, 0],
      ativoCirculante: caixa,
      ativoNaoCirculante: [0, 0, 0, 0, 0],
      ativoTotal: caixa.map((c, i) => c + pl[i] + divida[i]),
      fornecedores: [0, 0, 0, 0, 0],
      emprestimosCP: divida.map((d) => d * 0.3),
      passivoCirculante: divida.map((d) => d * 0.3),
      emprestimosLP: divida.map((d) => d * 0.7),
      passivoNaoCirculante: divida.map((d) => d * 0.7),
      patrimonioLiquido: pl,
      passivoTotal: divida.map((d, i) => d + pl[i]),
    };
  }
  const ws = getSheet(wb, "Balanco", 2);
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  return lerPorPosicao(rows, CAMPOS_BP, "Balanco", "bp", rotulos) as unknown as Balanco;
}

function parsePremissas(wb: XLSX.WorkBook): {
  premissas: Premissas;
  empresa: string;
  anoBase: number;
} {
  const ws = getSheet(wb, "Premissas", 0);
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  const map = new Map<string, any>();
  for (const r of rows) {
    if (r && r[0]) map.set(norm(r[0]), r[1]);
  }
  const num = (k: string, def = 0) => {
    const v = map.get(norm(k));
    return v == null || v === "" ? def : Number(v);
  };
  return {
    empresa: String(map.get(norm("empresa")) ?? ""),
    anoBase: num("ano base", new Date().getFullYear()),
    premissas: {
      selic: num("selic"),
      cdi: num("cdi"),
      ipca: num("ipca"),
      rf: num("taxa livre de risco (rf)"),
      beta: num("beta", 1),
      erp: num("erp (prêmio de risco)"),
      aliquotaIR: num("alíquota ir/csll", 0.34),
      custoDivida: num("custo da dívida"),
      dividaTotal: num("dívida total (valor de mercado)"),
      equityMercado: num("equity (valor de mercado)"),
      crescimentoPerp: num("crescimento perpetuidade (g)", 0.03),
      crescimentoProj: num("crescimento projetado", 0.05),
    },
  };
}

export async function lerPlanilha(file: File, modo: Modo): Promise<DadosImportados> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const { premissas, empresa, anoBase } = parsePremissas(wb);
  const rotulos: Record<string, string> = {};
  const dre = parseDRE(wb, rotulos);
  const balanco = parseBalanco(wb, modo, rotulos);
  const anos = Array.from({ length: 5 }, (_, i) => anoBase - 4 + i);
  return { modo, empresaPlanilha: empresa, anos, dre, balanco, premissas, rotulos };
}

/** Nome exibido para a conta: personalizado pelo usuário ou o padrão. */
export function rotulo(
  dados: { rotulos?: Record<string, string> } | null | undefined,
  chave: string,
  padrao: string,
): string {
  return dados?.rotulos?.[chave]?.trim() || padrao;
}