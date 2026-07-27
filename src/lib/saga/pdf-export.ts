import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DadosImportados, Empresa } from "./types";
import { fmtNum, fmtPct } from "./formatters";
import {
  margens,
  indicadoresLiquidez,
  indicadoresEndividamento,
  indicadoresRentabilidade,
  crescimento,
  calcularValuation,
} from "./calculations";

const NAVY: [number, number, number] = [30, 41, 82];
const MUTED: [number, number, number] = [100, 116, 139];

export type RelatorioOpcoes = {
  nomeArquivo?: string;
  observacao?: string;
};

export function gerarRelatorioPDF(
  dados: DadosImportados,
  empresa: Empresa | null,
  opcoes: RelatorioOpcoes = {},
): {
  blob: Blob;
  url: string;
  filename: string;
  save: () => void;
} {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const moeda = empresa?.moeda ?? "R$";
  const anos = dados.anos.map(String);
  const anoBase = dados.anos[dados.anos.length - 1];
  const nomeEmpresa = empresa?.nome || dados.empresaPlanilha || "Empresa";

  // ===== Capa / cabeçalho =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 595, 90, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("SAGA — Relatório de Análise", 40, 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(nomeEmpresa, 40, 65);
  const agora = new Date();
  const dataStr = agora.toLocaleDateString("pt-BR");
  const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const exportadoEm = `${dataStr} às ${horaStr}`;
  doc.text(`Emitido em ${exportadoEm}`, 40, 80);

  doc.setTextColor(0, 0, 0);
  let y = 120;

  // Observação/cabeçalho curto informado pelo usuário
  const obs = (opcoes.observacao ?? "").trim();
  if (obs) {
    const larguraTexto = 515;
    const linhas = doc.splitTextToSize(obs, larguraTexto) as string[];
    const altura = 18 + linhas.length * 13;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.rect(40, y, 515, altura, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("OBSERVAÇÃO", 50, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(linhas, 50, y + 30);
    doc.setTextColor(0, 0, 0);
    y += altura + 20;
  }

  // Ficha da empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Identificação", 40, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 3 },
    body: [
      ["Empresa", nomeEmpresa],
      ["Setor", empresa?.setor || "—"],
      ["Porte", empresa?.porte || "—"],
      ["Moeda", moeda],
      ["Modo de análise", dados.modo === "completa" ? "Contabilidade Completa" : "Dados Básicos"],
      ["Período analisado", `${dados.anos[0]} – ${anoBase}`],
    ],
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 140, textColor: MUTED }, 1: { cellWidth: "auto" } },
  });

  // ===== Highlights =====
  const v = calcularValuation(dados);
  const mg = margens(dados);
  const cr = crescimento(dados);

  y = tableEndY(doc) + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Destaques", 40, y);

  autoTable(doc, {
    startY: y + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 10, cellPadding: 6, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Indicador", `Ano base (${anoBase})`, "CAGR / Média"]],
    body: [
      ["Receita Líquida", fmt(dados.dre.receitaLiquida[4], moeda), fmtPct(cr.cagrReceita)],
      ["Lucro Líquido", fmt(dados.dre.lucroLiquido[4], moeda), fmtPct(cr.cagrLucro)],
      ["Margem EBITDA", fmtPct(mg.ebitda[4]), fmtPct(avg(mg.ebitda))],
      ["Margem Líquida", fmtPct(mg.liquida[4]), fmtPct(avg(mg.liquida))],
      ["Enterprise Value", fmt(v.ev, moeda), "—"],
      ["Equity Value", fmt(v.equity, moeda), "—"],
    ],
  });

  // ===== DRE =====
  doc.addPage();
  header(doc, "DRE — Demonstração do Resultado", nomeEmpresa);
  const d = dados.dre;
  autoTable(doc, {
    startY: 110,
    theme: "striped",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, halign: "right" },
    columnStyles: { 0: { halign: "left", cellWidth: 170 } },
    head: [["Conta", ...anos]],
    body: [
      linhaDRE("Receita Bruta", d.receitaBruta, moeda),
      linhaDRE("(−) Deduções", d.deducoes, moeda),
      linhaDRE("Receita Líquida", d.receitaLiquida, moeda, true),
      linhaDRE("(−) CMV", d.cmv, moeda),
      linhaDRE("Lucro Bruto", d.lucroBruto, moeda, true),
      linhaDRE("(−) Despesas Operacionais", d.despOperacionais, moeda),
      linhaDRE("EBITDA", d.ebitda, moeda, true),
      linhaDRE("(−) Depreciação", d.depreciacao, moeda),
      linhaDRE("EBIT", d.ebit, moeda, true),
      linhaDRE("Resultado Financeiro", d.resultadoFinanceiro, moeda),
      linhaDRE("LAIR", d.lair, moeda),
      linhaDRE("(−) Impostos", d.impostos, moeda),
      linhaDRE("Lucro Líquido", d.lucroLiquido, moeda, true),
    ],
  });

  // Margens
  let yy = tableEndY(doc) + 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Margens (%)", 40, yy);
  autoTable(doc, {
    startY: yy + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Margem", ...anos]],
    body: [
      ["Bruta", ...mg.bruta.map((x) => fmtPct(x))],
      ["EBITDA", ...mg.ebitda.map((x) => fmtPct(x))],
      ["Operacional (EBIT)", ...mg.operacional.map((x) => fmtPct(x))],
      ["Líquida", ...mg.liquida.map((x) => fmtPct(x))],
    ],
  });

  // ===== Indicadores =====
  doc.addPage();
  header(doc, "Indicadores Financeiros", nomeEmpresa);
  const rent = indicadoresRentabilidade(dados);
  const liq = indicadoresLiquidez(dados);
  const end = indicadoresEndividamento(dados);

  yy = 110;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Rentabilidade", 40, yy);
  autoTable(doc, {
    startY: yy + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Indicador", ...anos]],
    body: [
      ["ROE", ...rent.roe.map((x) => fmtPct(x))],
      ["ROA", ...rent.roa.map((x) => fmtPct(x))],
      ["ROIC", ...rent.roic.map((x) => fmtPct(x))],
    ],
  });

  if (liq) {
    yy = tableEndY(doc) + 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Liquidez", 40, yy);
    autoTable(doc, {
      startY: yy + 6,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4, halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      head: [["Índice", ...anos]],
      body: [
        ["Corrente", ...liq.corrente.map((x) => fmtNum(x, 2))],
        ["Seca", ...liq.seca.map((x) => fmtNum(x, 2))],
        ["Imediata", ...liq.imediata.map((x) => fmtNum(x, 2))],
      ],
    });
  }

  if (end) {
    yy = tableEndY(doc) + 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Endividamento", 40, yy);
    autoTable(doc, {
      startY: yy + 6,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 4, halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      head: [["Indicador", ...anos]],
      body: [
        ["Dívida / PL", ...end.dividaSobrePL.map((x) => fmtNum(x, 2))],
        ["Dívida / Ativo", ...end.dividaSobreAtivo.map((x) => fmtNum(x, 2))],
        ["Cobertura de Juros", ...end.coberturaJuros.map((x) => fmtNum(x, 2))],
      ],
    });
  }

  // ===== Valuation =====
  doc.addPage();
  header(doc, "Valuation (DCF)", nomeEmpresa);

  autoTable(doc, {
    startY: 110,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 10, cellPadding: 6, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Premissa", "Valor"]],
    body: [
      ["WACC", fmtPct(v.wacc)],
      ["g (perpetuidade)", fmtPct(v.g)],
      ["Alíquota IR", fmtPct(dados.premissas.aliquotaIR)],
      ["Custo da Dívida", fmtPct(dados.premissas.custoDivida)],
      ["Beta", fmtNum(dados.premissas.beta, 2)],
    ],
  });

  yy = tableEndY(doc) + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("FCFF Projetado e Valor Presente", 40, yy);
  autoTable(doc, {
    startY: yy + 6,
    theme: "striped",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 4, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Item", ...v.anos.map(String)]],
    body: [
      ["FCFF", ...v.fcff.map((x) => fmt(x, moeda))],
      ["Valor Presente", ...v.vp.map((x) => fmt(x, moeda))],
    ],
  });

  yy = tableEndY(doc) + 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Ponte EV → Equity Value", 40, yy);
  autoTable(doc, {
    startY: yy + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    styles: { fontSize: 10, cellPadding: 6, halign: "right" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Componente", "Valor"]],
    body: [
      ["VP dos FCFFs explícitos", fmt(v.vpSum, moeda)],
      ["VP do Valor Terminal", fmt(v.vpVt, moeda)],
      ["Enterprise Value", fmt(v.ev, moeda)],
      ["(+) Caixa", fmt(v.caixa, moeda)],
      ["(−) Dívida", fmt(-v.divida, moeda)],
      ["Equity Value", fmt(v.equity, moeda)],
    ],
  });

  // Rodapé em todas as páginas: identificação · data/hora · paginação
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.line(40, 808, 555, 808);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`SAGA · ${nomeEmpresa}`, 40, 822);
    doc.text(`Exportado em ${exportadoEm}`, 297.5, 822, { align: "center" });
    doc.text(`Página ${i} de ${total}`, 555, 822, { align: "right" });
  }

  const slugDefault = nomeEmpresa.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "empresa";
  const nomeInformado = (opcoes.nomeArquivo ?? "").trim();
  const base = nomeInformado || `saga-relatorio-${slugDefault}-${anoBase}`;
  const filename = base.toLowerCase().endsWith(".pdf") ? base : `${base}.pdf`;
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
  return { blob, url, filename, save: () => doc.save(filename) };
}

export function exportarRelatorioPDF(dados: DadosImportados, empresa: Empresa | null) {
  gerarRelatorioPDF(dados, empresa).save();
}

function fmt(n: number, moeda: string) {
  return `${moeda} ${fmtNum(n)}`;
}
function avg(arr: number[]) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function linhaDRE(label: string, vals: number[], moeda: string, bold = false) {
  const row = [label, ...vals.map((x) => fmt(x, moeda))];
  if (bold) {
    return row.map((c, i) => ({ content: c, styles: { fontStyle: "bold" as const, halign: i === 0 ? ("left" as const) : ("right" as const) } }));
  }
  return row;
}
function header(doc: jsPDF, titulo: string, empresa: string) {
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, 595, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(titulo, 40, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(empresa, 40, 55);
  doc.setTextColor(0, 0, 0);
}
function tableEndY(doc: jsPDF): number {
  // jspdf-autotable stores lastAutoTable on the doc instance
  const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return t?.finalY ?? 100;
}