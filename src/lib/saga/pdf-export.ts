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

// ===== A4 layout constants (pt) =====
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_TOP = 40;
const MARGIN_BOTTOM = 56; // reserva espaço para rodapé + linha divisória
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 515.28
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM; // 785.89

// Tipografia (pt) — hierarquia consistente para impressão
const FS_TITLE = 20;
const FS_SECTION = 13;
const FS_SUB = 11;
const FS_BODY = 10;
const FS_TABLE = 9;
const FS_TABLE_HEAD = 9;
const FS_CAPTION = 9;
const FS_FOOTER = 8;

export type RelatorioOpcoes = {
  nomeArquivo?: string;
  observacao?: string;
  graficos?: { titulo: string; legenda: string; dataUrl: string }[];
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
  doc.rect(0, 0, PAGE_W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FS_TITLE);
  doc.text("SAGA — Relatório de Análise", MARGIN_X, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_SUB);
  doc.text(nomeEmpresa, MARGIN_X, 68);
  const agora = new Date();
  const dataStr = agora.toLocaleDateString("pt-BR");
  const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const exportadoEm = `${dataStr} às ${horaStr}`;
  doc.setFontSize(FS_BODY);
  doc.text(`Emitido em ${exportadoEm}`, MARGIN_X, 84);

  doc.setTextColor(0, 0, 0);
  let y = 124;

  // Métricas usadas no Resumo Executivo (e reaproveitadas mais abaixo)
  const v = calcularValuation(dados);
  const mg = margens(dados);
  const cr = crescimento(dados);
  const rentCapa = indicadoresRentabilidade(dados);
  const liqCapa = indicadoresLiquidez(dados);

  // Observação/cabeçalho curto informado pelo usuário
  const obs = (opcoes.observacao ?? "").trim();
  if (obs) {
    const larguraTexto = CONTENT_W - 20;
    const linhas = doc.splitTextToSize(obs, larguraTexto) as string[];
    const altura = 20 + linhas.length * 13;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.8);
    doc.rect(MARGIN_X, y, CONTENT_W, altura, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text("OBSERVAÇÃO", MARGIN_X + 10, y + 14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FS_BODY);
    doc.setTextColor(30, 41, 59);
    doc.text(linhas, MARGIN_X + 10, y + 30);
    doc.setTextColor(0, 0, 0);
    y += altura + 24;
  }

  // ===== Resumo Executivo (capa) =====
  sectionTitle(doc, "Resumo Executivo", y);
  y += 10;

  const kpis: { label: string; valor: string }[] = [
    { label: `Receita Líquida (${anoBase})`, valor: fmt(dados.dre.receitaLiquida[4], moeda) },
    { label: `Lucro Líquido (${anoBase})`, valor: fmt(dados.dre.lucroLiquido[4], moeda) },
    { label: "Margem EBITDA", valor: fmtPct(mg.ebitda[4]) },
    { label: "Margem Líquida", valor: fmtPct(mg.liquida[4]) },
    { label: "CAGR Receita", valor: fmtPct(cr.cagrReceita) },
    { label: "ROE (ano base)", valor: fmtPct(rentCapa.roe[4]) },
    { label: "Enterprise Value", valor: fmt(v.ev, moeda) },
    { label: "Equity Value", valor: fmt(v.equity, moeda) },
  ];

  const cols = 4;
  const rows = Math.ceil(kpis.length / cols);
  const gap = 8;
  const cardW = (CONTENT_W - gap * (cols - 1)) / cols;
  const cardH = 46;
  for (let i = 0; i < kpis.length; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const cx = MARGIN_X + c * (cardW + gap);
    const cy = y + r * (cardH + gap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(...NAVY);
    doc.setLineWidth(0.4);
    doc.rect(cx, cy, cardW, cardH, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(kpis[i].label, cx + 8, cy + 14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...NAVY);
    doc.text(kpis[i].valor, cx + 8, cy + 34);
  }
  y += rows * (cardH + gap) + 6;
  doc.setTextColor(0, 0, 0);

  // Narrativa curta baseada nas métricas
  const tendencia = cr.cagrReceita >= 0 ? "crescimento" : "retração";
  const rentTxt = mg.liquida[4] >= 0 ? "resultado positivo" : "resultado negativo";
  const liqTxt = liqCapa ? `liquidez corrente de ${fmtNum(liqCapa.corrente[4], 2)}` : "estrutura simplificada de dados";
  const narrativa =
    `No período ${dados.anos[0]}–${anoBase}, ${nomeEmpresa} apresentou ${tendencia} de receita ` +
    `(CAGR ${fmtPct(cr.cagrReceita)}) e ${rentTxt} (margem líquida ${fmtPct(mg.liquida[4])} no ano base), ` +
    `com ${liqTxt}. O valuation por DCF (WACC ${fmtPct(v.wacc)} e g ${fmtPct(v.g)}) indica ` +
    `Enterprise Value de ${fmt(v.ev, moeda)} e Equity Value de ${fmt(v.equity, moeda)}.`;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_BODY);
  doc.setTextColor(30, 41, 59);
  const narrLines = doc.splitTextToSize(narrativa, CONTENT_W) as string[];
  doc.text(narrLines, MARGIN_X, y + 4);
  y += narrLines.length * 13 + 18;
  doc.setTextColor(0, 0, 0);

  // Ficha da empresa
  sectionTitle(doc, "Identificação", y);
  y += 6;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: FS_TABLE, cellPadding: 4 },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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
  y = ensureSpace(doc, tableEndY(doc) + 24, 140, nomeEmpresa);
  sectionTitle(doc, "Destaques", y);

  autoTable(doc, {
    startY: y + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_BODY, cellPadding: 6, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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
    startY: 100,
    theme: "striped",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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
  let yy = ensureSpace(doc, tableEndY(doc) + 24, 110, nomeEmpresa);
  sectionTitle(doc, "Margens (%)", yy, FS_SUB);
  autoTable(doc, {
    startY: yy + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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

  yy = 100;
  sectionTitle(doc, "Rentabilidade", yy, FS_SUB);
  autoTable(doc, {
    startY: yy + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Indicador", ...anos]],
    body: [
      ["ROE", ...rent.roe.map((x) => fmtPct(x))],
      ["ROA", ...rent.roa.map((x) => fmtPct(x))],
      ["ROIC", ...rent.roic.map((x) => fmtPct(x))],
    ],
  });

  if (liq) {
    yy = ensureSpace(doc, tableEndY(doc) + 20, 110, nomeEmpresa);
    sectionTitle(doc, "Liquidez", yy, FS_SUB);
    autoTable(doc, {
      startY: yy + 6,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
      styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "right" },
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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
    yy = ensureSpace(doc, tableEndY(doc) + 20, 110, nomeEmpresa);
    sectionTitle(doc, "Endividamento", yy, FS_SUB);
    autoTable(doc, {
      startY: yy + 6,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
      styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "right" },
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      head: [["Indicador", ...anos]],
      body: [
        ["Dívida / PL", ...end.dividaSobrePL.map((x) => fmtNum(x, 2))],
        ["Dívida / Ativo", ...end.dividaSobreAtivo.map((x) => fmtNum(x, 2))],
        ["Cobertura de Juros", ...end.coberturaJuros.map((x) => fmtNum(x, 2))],
      ],
    });
  }

  // ===== Gráficos (opcional) =====
  const graficos = opcoes.graficos ?? [];
  if (graficos.length > 0) {
    doc.addPage();
    header(doc, "Gráficos — DRE e Indicadores", nomeEmpresa);
    let gy = 96;
    const imgW = CONTENT_W;
    const imgH = Math.round((imgW * 420) / 900); // preserva proporção 900x420 ≈ 240
    const legendaLineH = 11;
    const gapAposGrafico = 24;
    for (const g of graficos) {
      // pré-calcula altura da legenda para decidir quebra de página cedo
      doc.setFont("helvetica", "italic");
      doc.setFontSize(FS_CAPTION);
      const linhas = doc.splitTextToSize(g.legenda, imgW) as string[];
      const blocoH = 14 + imgH + 6 + linhas.length * legendaLineH + gapAposGrafico;
      if (gy + blocoH > CONTENT_BOTTOM) {
        doc.addPage();
        header(doc, "Gráficos — DRE e Indicadores", nomeEmpresa);
        gy = 96;
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FS_SUB);
      doc.setTextColor(...NAVY);
      doc.text(g.titulo, MARGIN_X, gy);
      gy += 12;
      try {
        doc.addImage(g.dataUrl, "PNG", MARGIN_X, gy, imgW, imgH, undefined, "FAST");
      } catch {
        // se a imagem falhar, apenas pula
      }
      gy += imgH + 6;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(FS_CAPTION);
      doc.setTextColor(...MUTED);
      doc.text(linhas, MARGIN_X, gy);
      gy += linhas.length * legendaLineH + gapAposGrafico;
      doc.setTextColor(0, 0, 0);
    }
  }

  // ===== Valuation =====
  doc.addPage();
  header(doc, "Valuation (DCF)", nomeEmpresa);

  sectionTitle(doc, "Premissas do modelo", 96, FS_SUB);
  autoTable(doc, {
    startY: 102,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_BODY, cellPadding: 6, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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

  yy = ensureSpace(doc, tableEndY(doc) + 20, 110, nomeEmpresa);
  sectionTitle(doc, "FCFF Projetado e Valor Presente", yy, FS_SUB);
  autoTable(doc, {
    startY: yy + 6,
    theme: "striped",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
    head: [["Item", ...v.anos.map(String)]],
    body: [
      ["FCFF", ...v.fcff.map((x) => fmt(x, moeda))],
      ["Valor Presente", ...v.vp.map((x) => fmt(x, moeda))],
    ],
  });

  yy = ensureSpace(doc, tableEndY(doc) + 20, 160, nomeEmpresa);
  sectionTitle(doc, "Ponte EV → Equity Value", yy, FS_SUB);
  autoTable(doc, {
    startY: yy + 6,
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: FS_TABLE_HEAD },
    styles: { fontSize: FS_BODY, cellPadding: 6, halign: "right" },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
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
  const footerLineY = PAGE_H - 34;
  const footerTextY = PAGE_H - 20;
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...MUTED);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_X, footerLineY, PAGE_W - MARGIN_X, footerLineY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(FS_FOOTER);
    doc.setTextColor(...MUTED);
    doc.text(`SAGA · ${nomeEmpresa}`, MARGIN_X, footerTextY);
    doc.text(`Exportado em ${exportadoEm}`, PAGE_W / 2, footerTextY, { align: "center" });
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN_X, footerTextY, { align: "right" });
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
  doc.rect(0, 0, PAGE_W, 72, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(titulo, MARGIN_X, 36);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_BODY);
  doc.text(empresa, MARGIN_X, 56);
  doc.setTextColor(0, 0, 0);
}
function tableEndY(doc: jsPDF): number {
  // jspdf-autotable stores lastAutoTable on the doc instance
  const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return t?.finalY ?? 100;
}

function sectionTitle(doc: jsPDF, texto: string, y: number, size = FS_SECTION) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(size);
  doc.setTextColor(...NAVY);
  doc.text(texto, MARGIN_X, y);
  doc.setTextColor(0, 0, 0);
}

// Garante espaço vertical suficiente para o próximo bloco; caso contrário,
// insere quebra de página com cabeçalho e retorna o novo Y de trabalho.
function ensureSpace(doc: jsPDF, y: number, needed: number, empresa: string): number {
  if (y + needed <= CONTENT_BOTTOM) return y;
  doc.addPage();
  header(doc, "Continuação", empresa);
  return 96;
}