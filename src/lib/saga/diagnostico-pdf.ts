import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const NAVY: [number, number, number] = [30, 41, 82];
const MUTED: [number, number, number] = [100, 116, 139];
const OK: [number, number, number] = [16, 148, 96];
const WARN: [number, number, number] = [217, 143, 20];
const BAD: [number, number, number] = [200, 40, 40];

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN_X = 40;
const MARGIN_BOTTOM = 56;
const CONTENT_BOTTOM = PAGE_H - MARGIN_BOTTOM;

export type DiagStatus = "bom" | "atencao" | "ruim" | "neutro";

export interface DiagCard {
  titulo: string;
  valor: string;
  status: DiagStatus;
  interpretacao: string;
  referencia: string;
  delta?: number;
  deltaLabel?: string;
  pctPoints?: boolean;
}

export interface DiagSecao {
  titulo: string;
  cards: DiagCard[];
}

export interface DiagPdfInput {
  empresa: string;
  anoBase: number;
  secoes: DiagSecao[];
}

const STATUS_LABEL: Record<DiagStatus, string> = {
  bom: "Saudavel",
  atencao: "Atencao",
  ruim: "Critico",
  neutro: "N/D",
};

const STATUS_COLOR: Record<DiagStatus, [number, number, number]> = {
  bom: OK,
  atencao: WARN,
  ruim: BAD,
  neutro: MUTED,
};

export function gerarDiagnosticoPDF(input: DiagPdfInput) {
  const { empresa, anoBase, secoes } = input;
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  // Capa
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 96, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SAGA — Diagnóstico Financeiro", MARGIN_X, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(empresa, MARGIN_X, 68);
  const agora = new Date();
  const dataStr = agora.toLocaleDateString("pt-BR");
  const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const exportadoEm = `${dataStr} às ${horaStr}`;
  doc.setFontSize(10);
  doc.text(`Ano base: ${anoBase}  ·  Emitido em ${exportadoEm}`, MARGIN_X, 84);

  doc.setTextColor(0, 0, 0);
  let y = 120;

  // Legenda semáforo
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text("Legenda do semáforo", MARGIN_X, y);
  y += 14;
  const legenda: { status: DiagStatus; texto: string }[] = [
    { status: "bom", texto: "Saudável — dentro do padrão" },
    { status: "atencao", texto: "Atenção — monitorar e agir" },
    { status: "ruim", texto: "Crítico — ação prioritária" },
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  let lx = MARGIN_X;
  legenda.forEach((l) => {
    doc.setFillColor(...STATUS_COLOR[l.status]);
    doc.circle(lx + 4, y - 3, 3.5, "F");
    doc.setTextColor(30, 30, 30);
    doc.text(l.texto, lx + 12, y);
    lx += doc.getTextWidth(l.texto) + 40;
  });
  y += 18;

  // Seções
  secoes.forEach((sec) => {
    y = ensureSpace(doc, y, 60, empresa);
    // Faixa da seção
    doc.setFillColor(...NAVY);
    doc.rect(MARGIN_X, y, PAGE_W - MARGIN_X * 2, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(sec.titulo.toUpperCase(), MARGIN_X + 10, y + 14);
    doc.setTextColor(0, 0, 0);
    y += 28;

    // Tabela de indicadores
    const body = sec.cards.map((c) => [
      c.titulo,
      c.valor,
      STATUS_LABEL[c.status],
      c.interpretacao,
      // A fonte padrão do PDF não contém os glifos ≥/≤; preservar a comparação
      // usando equivalentes ASCII evita corromper a coluna de referências.
      c.referencia.replaceAll("≥", ">=").replaceAll("≤", "<="),
    ]);
    autoTable(doc, {
      startY: y,
      head: [["Indicador", "Valor", "Status", "Interpretação", "Referência"]],
      body,
      theme: "grid",
      headStyles: { fillColor: [235, 238, 245], textColor: NAVY, fontStyle: "bold", fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 6, valign: "middle" },
      columnStyles: {
        0: { cellWidth: 100, fontStyle: "bold" },
        1: { cellWidth: 60, halign: "right" },
        2: { cellWidth: 60, halign: "center", fontStyle: "bold" },
        3: { cellWidth: "auto" },
        4: { cellWidth: 110, textColor: MUTED, fontSize: 8 },
      },
      didParseCell: (data) => {
        if (data.section !== "body" || data.column.index !== 2) return;
        const card = sec.cards[data.row.index];
        if (!card) return;
        const color = STATUS_COLOR[card.status];
        data.cell.styles.textColor = 255;
        data.cell.styles.fillColor = color;
      },
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM },
    });
    y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 18;
  });

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
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`SAGA · ${empresa}`, MARGIN_X, footerTextY);
    doc.text(`Exportado em ${exportadoEm}`, PAGE_W / 2, footerTextY, { align: "center" });
    doc.text(`Página ${i} de ${total}`, PAGE_W - MARGIN_X, footerTextY, { align: "right" });
  }

  const slug =
    empresa.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "empresa";
  doc.save(`saga-diagnostico-${slug}.pdf`);
}

function ensureSpace(doc: jsPDF, y: number, needed: number, empresa: string): number {
  if (y + needed <= CONTENT_BOTTOM) return y;
  doc.addPage();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, PAGE_W, 60, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("SAGA — Diagnóstico Financeiro", MARGIN_X, 32);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(empresa, MARGIN_X, 50);
  doc.setTextColor(0, 0, 0);
  return 90;
}