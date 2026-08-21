import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { EmpresaSimpl, Cenario } from "./types";
import type { Projecao, ResultadoMes } from "./engine";
import type { DcfResultado } from "./valuation";

const LINHAS_DRE: [string, keyof ResultadoMes][] = [
  ["Receita bruta", "receitaBruta"],
  ["(-) Impostos sobre venda", "impostosVenda"],
  ["Receita líquida", "receitaLiquida"],
  ["(-) Custos", "custos"],
  ["Lucro bruto", "lucroBruto"],
  ["(-) Despesas operacionais", "despesas"],
  ["EBITDA", "ebitda"],
  ["(-) Depreciação e amortização", "depreciacao"],
  ["EBIT", "ebit"],
  ["Resultado financeiro", "resultadoFinanceiro"],
  ["LAIR", "lair"],
  ["(-) IRPJ/CSLL", "irpjCsll"],
  ["Lucro líquido", "lucroLiquido"],
];

const LINHAS_BP: [string, keyof ResultadoMes][] = [
  ["Caixa", "caixa"],
  ["Contas a receber", "contasReceber"],
  ["Estoques", "estoques"],
  ["Adiantamentos a fornecedores", "adiantFornecedores"],
  ["Imobilizado líquido", "imobilizadoLiquido"],
  ["Ativo total", "ativoTotal"],
  ["Fornecedores", "fornecedores"],
  ["Adiantamentos de clientes", "adiantClientes"],
  ["Tributos a recolher", "tributosRecolher"],
  ["Obrigações trabalhistas", "obrigacoesTrabalhistas"],
  ["Dívida CP", "dividaCP"],
  ["Dívida LP", "dividaLP"],
  ["Crédito rotativo", "rotativoSaldo"],
  ["Passivo total", "passivoTotal"],
  ["Capital social", "capitalSocial"],
  ["Lucros acumulados", "lucrosAcumulados"],
  ["Patrimônio líquido", "patrimonioLiquido"],
  ["Balance check", "balanceCheck"],
];

const LINHAS_FC: [string, keyof ResultadoMes][] = [
  ["Caixa inicial", "caixaInicial"],
  ["Fluxo operacional", "fco"],
  ["Fluxo de investimento", "fci"],
  ["Fluxo de financiamento", "fcf"],
  ["Caixa final", "caixa"],
];

export const DEMONSTRATIVOS = { LINHAS_DRE, LINHAS_BP, LINHAS_FC };

function aoa(linhas: [string, keyof ResultadoMes][], dados: ResultadoMes[]) {
  const head = ["Linha", ...dados.map((d) => d.rotulo)];
  return [head, ...linhas.map(([label, k]) => [label, ...dados.map((d) => Number(d[k] ?? 0))])];
}

export function exportarExcel(
  empresa: EmpresaSimpl,
  cenario: Cenario,
  proj: Projecao,
  dcf: DcfResultado,
) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Empresa", empresa.nome],
      ["Cenário", cenario.nome],
      ["Regime", empresa.regime],
      ["Horizonte (anos)", cenario.premissas.horizonteAnos],
      ["WACC", dcf.wacc],
      ["Ke", dcf.ke],
      ["Kd líquido", dcf.kdLiquido],
      ["g perpetuidade", cenario.valuation.gPerp],
      ["Enterprise Value", dcf.enterpriseValue],
      ["Dívida líquida", dcf.dividaLiquida],
      ["Equity Value", dcf.equityValue],
      ["EV/EBITDA", dcf.evEbitda],
    ]),
    "Resumo",
  );
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa(LINHAS_DRE, proj.anual)), "DRE Anual");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa(LINHAS_DRE, proj.mensal)), "DRE Mensal");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa(LINHAS_BP, proj.anual)), "Balanco Anual");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa(LINHAS_FC, proj.anual)), "Fluxo Caixa");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Ano", "NOPAT", "D&A", "CAPEX", "Δ NCG", "FCFF", "Fator", "VP"],
      ...dcf.anos.map((a) => [a.rotulo, a.nopat, a.da, a.capex, a.varNcg, a.fcff, a.fatorDesconto, a.vp]),
      [],
      ["Soma VP explícito", dcf.somaVp],
      ["Valor terminal", dcf.valorTerminal],
      ["VP do valor terminal", dcf.vpTerminal],
      ["Enterprise Value", dcf.enterpriseValue],
    ]),
    "DCF",
  );

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  baixar(blob, `${empresa.nome}_${cenario.nome}_Modelagem.xlsx`);
}

const brl = (n: number) =>
  (n < 0 ? "(" : "") +
  Math.abs(n).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) +
  (n < 0 ? ")" : "");

export function exportarPdf(
  empresa: EmpresaSimpl,
  cenario: Cenario,
  proj: Projecao,
  dcf: DcfResultado,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFillColor(42, 53, 102);
  doc.rect(0, 0, w, 90, "F");
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.text("Relatório Executivo — Modelagem Simplificada", 40, 45);
  doc.setFontSize(11);
  doc.text(`${empresa.nome} · Cenário ${cenario.nome} · ${new Date().toLocaleString("pt-BR")}`, 40, 68);
  doc.setTextColor(0);

  const ultimo = proj.anual[proj.anual.length - 1];
  autoTable(doc, {
    startY: 110,
    head: [["Indicador", "Valor"]],
    body: [
      ["Receita líquida (último ano)", brl(ultimo?.receitaLiquida ?? 0)],
      ["EBITDA (último ano)", brl(ultimo?.ebitda ?? 0)],
      ["Lucro líquido (último ano)", brl(ultimo?.lucroLiquido ?? 0)],
      ["Caixa final", brl(ultimo?.caixa ?? 0)],
      ["WACC", `${(dcf.wacc * 100).toFixed(1)}%`],
      ["Enterprise Value", brl(dcf.enterpriseValue)],
      ["Equity Value", brl(dcf.equityValue)],
      ["EV/EBITDA implícito", `${dcf.evEbitda.toFixed(1)}x`],
    ],
    theme: "grid",
    headStyles: { fillColor: [42, 53, 102] },
    styles: { fontSize: 9 },
  });

  const tabela = (titulo: string, linhas: [string, keyof ResultadoMes][]) => {
    doc.addPage();
    doc.setFontSize(14);
    doc.text(titulo, 40, 40);
    autoTable(doc, {
      startY: 60,
      head: [["Linha", ...proj.anual.map((a) => a.rotulo)]],
      body: linhas.map(([label, k]) => [label, ...proj.anual.map((a) => brl(Number(a[k] ?? 0)))]),
      theme: "striped",
      headStyles: { fillColor: [42, 53, 102] },
      styles: { fontSize: 8, halign: "right" },
      columnStyles: { 0: { halign: "left", cellWidth: 180 } },
    });
  };

  tabela("DRE projetada", LINHAS_DRE);
  tabela("Balanço patrimonial", LINHAS_BP);
  tabela("Fluxo de caixa", LINHAS_FC);

  doc.addPage();
  doc.setFontSize(14);
  doc.text("Valuation (DCF)", 40, 40);
  autoTable(doc, {
    startY: 60,
    head: [["Ano", "NOPAT", "D&A", "CAPEX", "Δ NCG", "FCFF", "VP"]],
    body: dcf.anos.map((a) => [
      a.rotulo,
      brl(a.nopat),
      brl(a.da),
      brl(-a.capex),
      brl(-a.varNcg),
      brl(a.fcff),
      brl(a.vp),
    ]),
    theme: "grid",
    headStyles: { fillColor: [42, 53, 102] },
    styles: { fontSize: 9, halign: "right" },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `${empresa.nome} — gerado em ${new Date().toLocaleString("pt-BR")}`,
      40,
      doc.internal.pageSize.getHeight() - 20,
    );
    doc.text(`Página ${i} de ${total}`, w - 90, doc.internal.pageSize.getHeight() - 20);
  }

  doc.save(`${empresa.nome}_${cenario.nome}_Executivo.pdf`);
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}
