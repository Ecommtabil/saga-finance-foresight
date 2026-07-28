import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NAVY: [number, number, number] = [30, 41, 82];
const MUTED: [number, number, number] = [100, 116, 139];
const POS: [number, number, number] = [37, 99, 235];
const NEG: [number, number, number] = [220, 38, 38];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_BOTTOM = 56;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;

const FS_TITLE = 20;
const FS_SECTION = 13;
const FS_SUB = 11;
const FS_BODY = 10;
const FS_TABLE = 9;
const FS_CAPTION = 9;
const FS_FOOTER = 8;

export type Par = { a: string; b: string; v: number };

export interface StatsPdfInput {
  empresa: string;
  arquivo?: string;
  periodoInicial: string;
  periodoFinal: string;
  totalPeriodos: number;
  totalSeries: number;
  seriesNomes: string[]; // já com nomes curtos
  corrMatrix: number[][];
  paresNarrativa: Par[];
  hipotese: (p: Par) => string;
  comoValidar: (p: Par) => string[];
}

export function gerarRelatorioEstatisticasPDF(input: StatsPdfInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const {
    empresa,
    arquivo,
    periodoInicial,
    periodoFinal,
    totalPeriodos,
    totalSeries,
    seriesNomes,
    corrMatrix,
    paresNarrativa,
    hipotese,
    comoValidar,
  } = input;

  // ===== Capa =====
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FS_TITLE);
  doc.text("SAGA — Análise Estatística", MARGIN_X, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_SUB);
  doc.text(empresa, MARGIN_X, 68);
  const agora = new Date();
  const dataStr = agora.toLocaleDateString("pt-BR");
  const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const exportadoEm = `${dataStr} às ${horaStr}`;
  doc.setFontSize(FS_BODY);
  doc.text(`Emitido em ${exportadoEm}`, MARGIN_X, 84);

  doc.setTextColor(0, 0, 0);
  let y = 124;

  // Contexto da análise
  sectionTitle(doc, "Contexto da análise", y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_BODY);
  doc.setTextColor(...MUTED);
  const contexto = [
    `Arquivo: ${arquivo ?? "planilha importada"}`,
    `Recorte: ${periodoInicial} até ${periodoFinal}  ·  ${totalPeriodos} períodos  ·  ${totalSeries} indicadores`,
  ];
  contexto.forEach((linha, i) => doc.text(linha, MARGIN_X, y + i * 14));
  y += contexto.length * 14 + 10;
  doc.setTextColor(0, 0, 0);

  // ===== Matriz de correlação =====
  y = ensureSpace(doc, y, 40, empresa);
  sectionTitle(doc, "Mapa de relacionamentos entre indicadores", y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_CAPTION);
  doc.setTextColor(...MUTED);
  y += 12;
  doc.text(
    "Coeficiente de correlação (−1 a +1). Azul = movimento no mesmo sentido; vermelho = sentido oposto.",
    MARGIN_X,
    y,
  );
  doc.setTextColor(0, 0, 0);
  y += 10;

  const head = [["Indicador", ...seriesNomes]];
  const body = corrMatrix.map((row, i) => [
    seriesNomes[i],
    ...row.map((v) => v.toFixed(2)),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: "grid",
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontSize: FS_TABLE,
      halign: "center",
    },
    styles: { fontSize: FS_TABLE, cellPadding: 4, halign: "center" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold", cellWidth: 110 } },
    margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    didParseCell: (data) => {
      if (data.section !== "body" || data.column.index === 0) return;
      const v = corrMatrix[data.row.index]?.[data.column.index - 1];
      if (!Number.isFinite(v)) return;
      const base = v >= 0 ? POS : NEG;
      const alpha = Math.min(1, Math.abs(v));
      // interpolação com branco para simular "cor com transparência"
      const bg: [number, number, number] = [
        Math.round(255 + (base[0] - 255) * alpha * 0.7),
        Math.round(255 + (base[1] - 255) * alpha * 0.7),
        Math.round(255 + (base[2] - 255) * alpha * 0.7),
      ];
      data.cell.styles.fillColor = bg;
      if (Math.abs(v) > 0.6) {
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = "bold";
      }
    },
  });
  y = tableEndY(doc) + 18;

  // ===== Narrativa =====
  y = ensureSpace(doc, y, 60, empresa);
  sectionTitle(doc, "Narrativa de causa e efeito — hipóteses de negócio", y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_BODY);
  doc.setTextColor(...MUTED);
  const intro =
    "A partir das relações mais fortes do mapa (|r| ≥ 0,40), cada bloco propõe uma hipótese de gestão e um roteiro para validar com dados adicionais. Correlação sinaliza padrão — a validação confirma (ou descarta) a causa.";
  const introLines = doc.splitTextToSize(intro, PAGE_W - MARGIN_X * 2);
  doc.text(introLines, MARGIN_X, y);
  y += introLines.length * 12 + 6;
  doc.setTextColor(0, 0, 0);

  if (paresNarrativa.length === 0) {
    y = ensureSpace(doc, y, 40, empresa);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(FS_BODY);
    doc.setTextColor(...MUTED);
    const msg = doc.splitTextToSize(
      "Nenhum par atingiu força mínima (|r| ≥ 0,40) no recorte atual. Amplie o intervalo ou inclua mais indicadores.",
      PAGE_W - MARGIN_X * 2,
    );
    doc.text(msg, MARGIN_X, y);
    y += msg.length * 12;
  } else {
    paresNarrativa.forEach((p, idx) => {
      const passos = comoValidar(p);
      const hip = hipotese(p);
      const hipLines = doc.splitTextToSize(hip, PAGE_W - MARGIN_X * 2 - 16);
      const passosLines = passos.map((pa, i) =>
        doc.splitTextToSize(`${i + 1}. ${pa}`, PAGE_W - MARGIN_X * 2 - 16),
      );
      const passosLinhas = passosLines.reduce((a, l) => a + l.length, 0);
      const alturaBloco =
        22 /* header */ +
        14 /* label hipotese */ +
        hipLines.length * 12 +
        14 /* label validar */ +
        passosLinhas * 12 +
        18;

      y = ensureSpace(doc, y, alturaBloco, empresa);

      const xLeft = MARGIN_X;
      const xRight = PAGE_W - MARGIN_X;
      const boxTop = y - 4;
      const boxBottom = y + alturaBloco - 12;

      doc.setDrawColor(220, 224, 232);
      doc.setLineWidth(0.6);
      doc.roundedRect(xLeft, boxTop, xRight - xLeft, boxBottom - boxTop, 6, 6, "S");
      // faixa lateral por sentido
      const barCor = p.v >= 0 ? POS : NEG;
      doc.setFillColor(...barCor);
      doc.rect(xLeft, boxTop, 3, boxBottom - boxTop, "F");

      const innerX = xLeft + 12;
      let yy = y + 12;

      // Título do par
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FS_SUB);
      doc.setTextColor(...NAVY);
      doc.text(`#${idx + 1}  ${p.a}  ×  ${p.b}`, innerX, yy);

      const forca = Math.abs(p.v) > 0.7 ? "forte" : "moderada";
      const sentido = p.v >= 0 ? "mesmo sentido" : "sentido oposto";
      const sinal = p.v >= 0 ? "+" : "";
      const tag = `${sinal}${p.v.toFixed(2)} · ${forca} · ${sentido}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FS_CAPTION);
      doc.setTextColor(...MUTED);
      doc.text(tag, xRight - 8, yy, { align: "right" });
      yy += 18;

      // Hipótese
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FS_CAPTION);
      doc.setTextColor(...NAVY);
      doc.text("HIPÓTESE DE NEGÓCIO", innerX, yy);
      yy += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FS_BODY);
      doc.setTextColor(20, 20, 20);
      doc.text(hipLines, innerX, yy);
      yy += hipLines.length * 12 + 6;

      // Como validar
      doc.setFont("helvetica", "bold");
      doc.setFontSize(FS_CAPTION);
      doc.setTextColor(...NAVY);
      doc.text("COMO VALIDAR COM DADOS ADICIONAIS", innerX, yy);
      yy += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(FS_BODY);
      doc.setTextColor(20, 20, 20);
      passosLines.forEach((linhas) => {
        doc.text(linhas, innerX, yy);
        yy += linhas.length * 12;
      });

      y = boxBottom + 14;
    });
  }

  // Rodapé
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
    doc.text(`SAGA · ${empresa}`, MARGIN_X, footerTextY);
    doc.text(`Exportado em ${exportadoEm}`, PAGE_W / 2, footerTextY, { align: "center" });
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN_X, footerTextY, { align: "right" });
  }

  const slug =
    empresa.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "empresa";
  const filename = `saga-estatisticas-${slug}.pdf`;
  doc.save(filename);
}

function sectionTitle(doc: jsPDF, texto: string, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(FS_SECTION);
  doc.setTextColor(...NAVY);
  doc.text(texto, MARGIN_X, y);
  doc.setTextColor(0, 0, 0);
}
function tableEndY(doc: jsPDF): number {
  const t = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  return t?.finalY ?? 100;
}
function ensureSpace(doc: jsPDF, y: number, needed: number, empresa: string): number {
  if (y + needed <= CONTENT_BOTTOM) return y;
  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SAGA — Análise Estatística", MARGIN_X, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(FS_BODY);
  doc.text(empresa, MARGIN_X, 50);
  doc.setTextColor(0, 0, 0);
  return 90;
}