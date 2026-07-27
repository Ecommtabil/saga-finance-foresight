import * as XLSX from "xlsx";
import type { Balanco, DRE, DadosImportados, Modo, Premissas } from "./types";

export class PlanilhaError extends Error {
  constructor(public aba: string, public detalhe: string) {
    super(`[${aba}] ${detalhe}`);
  }
}

function getSheet(wb: XLSX.WorkBook, nome: string): XLSX.WorkSheet {
  const found = wb.SheetNames.find((n) => n.toLowerCase() === nome.toLowerCase());
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

function findRow(rows: any[][], label: string, aba: string): number[] {
  const target = norm(label);
  const row = rows.find((r) => norm(r?.[0]) === target);
  if (!row) {
    throw new PlanilhaError(aba, `Linha "${label}" não encontrada.`);
  }
  return [0, 1, 2, 3, 4].map((i) => Number(row[i + 1]) || 0);
}

function parseDRE(wb: XLSX.WorkBook): DRE {
  const ws = getSheet(wb, "DRE");
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  const g = (label: string) => findRow(rows, label, "DRE");
  return {
    receitaBruta: g("Receita Bruta"),
    deducoes: g("Deduções"),
    receitaLiquida: g("Receita Líquida"),
    cmv: g("CMV"),
    lucroBruto: g("Lucro Bruto"),
    despOperacionais: g("Despesas Operacionais"),
    ebitda: g("EBITDA"),
    depreciacao: g("Depreciação"),
    ebit: g("EBIT"),
    resultadoFinanceiro: g("Resultado Financeiro"),
    lair: g("LAIR"),
    impostos: g("Impostos"),
    lucroLiquido: g("Lucro Líquido"),
  };
}

function parseBalanco(wb: XLSX.WorkBook, modo: Modo): Balanco | null {
  if (modo === "basica") {
    const ws = getSheet(wb, "Balanco_Simplificado");
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const g = (label: string) => findRow(rows, label, "Balanco_Simplificado");
    const caixa = g("Caixa e Equivalentes");
    const divida = g("Dívida Total");
    const pl = g("Patrimônio Líquido");
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
  const ws = getSheet(wb, "Balanco");
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  const g = (label: string) => findRow(rows, label, "Balanco");
  return {
    caixa: g("Caixa e Equivalentes"),
    contasReceber: g("Contas a Receber"),
    estoques: g("Estoques"),
    ativoCirculante: g("Ativo Circulante"),
    ativoNaoCirculante: g("Ativo Não Circulante"),
    ativoTotal: g("Ativo Total"),
    fornecedores: g("Fornecedores"),
    emprestimosCP: g("Empréstimos CP"),
    passivoCirculante: g("Passivo Circulante"),
    emprestimosLP: g("Empréstimos LP"),
    passivoNaoCirculante: g("Passivo Não Circulante"),
    patrimonioLiquido: g("Patrimônio Líquido"),
    passivoTotal: g("Passivo + PL Total"),
  };
}

function parsePremissas(wb: XLSX.WorkBook): {
  premissas: Premissas;
  empresa: string;
  anoBase: number;
} {
  const ws = getSheet(wb, "Premissas");
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
  const dre = parseDRE(wb);
  const balanco = parseBalanco(wb, modo);
  const anos = Array.from({ length: 5 }, (_, i) => anoBase - 4 + i);
  return { modo, empresaPlanilha: empresa, anos, dre, balanco, premissas };
}