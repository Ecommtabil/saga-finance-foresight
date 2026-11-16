import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas-pro";
import { formatBRLContabil } from "@/lib/finance";
import { NOTA_METODOLOGICA, type DefinicaoEstudo } from "./estudos";
import { dataBR, formatarPremissa, formatarValor, type CabecalhoEstudo } from "./estado";
import type { CampoPremissa, RelatorioEstudo } from "./tipos";
import type { RiscoQualitativo } from "./equipe-terceirizar";

const limpar = (s: string) => s.replace(/\u00a0/g, " ").replace(/[−–]/g, "-").replace(/×/g, "x").replace(/≥/g, ">=");
type RGB = [number, number, number];
const NAVY: RGB = [15, 42, 68];
const GOLD: RGB = [201, 162, 39];
const CINZA: RGB = [91, 107, 127];
const COR_PARECER: Record<string, { fundo: RGB; texto: RGB }> = {
  verde: { fundo: [232, 245, 236], texto: [21, 128, 61] },
  amarelo: { fundo: [252, 243, 224], texto: [160, 104, 20] },
  vermelho: { fundo: [251, 232, 230], texto: [192, 53, 43] },
  info: { fundo: NAVY, texto: GOLD },
};

export interface DadosPdf {
  def: DefinicaoEstudo;
  cabecalho: CabecalhoEstudo;
  campos: CampoPremissa<never>[];
  premissas: Record<string, unknown>;
  relatorio: RelatorioEstudo;
  graficos: HTMLElement[];
  riscos?: RiscoQualitativo[];
}

export async function gerarPdfViabilidade(d: DadosPdf): Promise<Blob> {
  await document.fonts.ready;
  const imagens: Array<{ titulo: string; url: string; ratio: number }> = [];
  for (const el of d.graficos) {
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", logging: false });
    imagens.push({ titulo: el.dataset.viaChart ?? "", url: canvas.toDataURL("image/jpeg", 0.92), ratio: canvas.height / canvas.width });
  }
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const W = 210, H = 297, M = 14;
  const largura = W - 2 * M;
  const topo = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 16, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...GOLD); doc.text("Ecommtabil", M, 10.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    doc.text(limpar(`Estudo de Viabilidade - ${d.def.titulo}`), W - M, 10.5, { align: "right" });
  };
  topo();
  let y = 26;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...NAVY);
  doc.text(limpar(d.def.titulo), M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...CINZA);
  doc.text(limpar(`${d.def.tipoAnalise}  |  Horizonte de ${d.relatorio.anos} anos`), M, y); y += 6;

  // Cabeçalho do cliente
  const c = d.cabecalho;
  const info: Array<[string, string]> = [
    ["Cliente", c.cliente || "-"], ["CNPJ", c.cnpj || "-"],
    ["Responsável técnico", c.responsavel || "-"], ["Data-base", dataBR(c.dataBase) || "-"],
  ];
  doc.setDrawColor(226, 230, 236); doc.setFillColor(247, 248, 250); doc.roundedRect(M, y, largura, 16, 1.5, 1.5, "FD");
  info.forEach(([k, v], i) => {
    const x = M + 4 + (i % 2) * (largura / 2); const yy = y + 6 + Math.floor(i / 2) * 6;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); doc.text(`${k}:`, x, yy);
    const lw = doc.getTextWidth(`${k}:`) + 1.8;
    doc.setFont("helvetica", "normal"); doc.setTextColor(40, 48, 60); doc.text(limpar(v), x + lw, yy);
  });
  y += 22;

  // Parecer
  const cor = COR_PARECER[d.relatorio.parecer.nivel];
  doc.setFontSize(9);
  const linhasParecer = doc.splitTextToSize(limpar(d.relatorio.parecer.texto), largura - 8) as string[];
  const hp = 10 + linhasParecer.length * 4.2;
  doc.setFillColor(...cor.fundo); doc.roundedRect(M, y, largura, hp, 1.5, 1.5, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...cor.texto);
  doc.text(limpar(`Parecer: ${d.relatorio.parecer.titulo}`), M + 4, y + 6.5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.setTextColor(...(d.relatorio.parecer.nivel === "info" ? ([255, 255, 255] as RGB) : ([40, 48, 60] as RGB)));
  doc.text(linhasParecer, M + 4, y + 12);
  y += hp + 6;

  // KPIs (3 por linha)
  const cols = 3, gap = 3, bw = (largura - gap * (cols - 1)) / cols, bh = 15;
  d.relatorio.kpis.forEach((k, i) => {
    const x = M + (i % cols) * (bw + gap); const yy = y + Math.floor(i / cols) * (bh + gap);
    doc.setDrawColor(226, 230, 236); doc.setFillColor(255, 255, 255); doc.roundedRect(x, yy, bw, bh, 1.2, 1.2, "FD");
    doc.setFontSize(7); doc.setTextColor(...CINZA); doc.text(limpar(k.rotulo.toUpperCase()), x + 3, yy + 5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.setTextColor(...(k.ok === true ? ([21, 128, 61] as RGB) : k.ok === false ? ([192, 53, 43] as RGB) : NAVY));
    doc.text(limpar(formatarValor(k.valor, k.formato, k.textoNulo)), x + 3, yy + 11.5);
    doc.setFont("helvetica", "normal");
  });
  y += Math.ceil(d.relatorio.kpis.length / cols) * (bh + gap) + 4;

  // Premissas
  autoTable(doc, {
    startY: y, margin: { left: M, right: M, top: 22, bottom: 16 },
    head: [["Premissa", "Valor"]],
    body: d.campos.map((cp) => [limpar(cp.rotulo), limpar(formatarPremissa(cp, d.premissas[cp.chave]))]),
    theme: "grid", styles: { fontSize: 8, cellPadding: 1.6, textColor: [40, 48, 60], lineColor: [226, 230, 236] },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: { 1: { halign: "right", fillColor: [234, 242, 251], cellWidth: 45 } },
    didDrawPage: topo,
  });

  // Demonstrativo
  const anos = Array.from({ length: d.relatorio.anos + 1 }, (_, t) => `Ano ${t}`);
  const corpo: Array<Array<{ content: string; styles?: Record<string, unknown>; colSpan?: number }>> = [];
  for (const b of d.relatorio.blocos) {
    corpo.push([{ content: limpar(b.titulo), colSpan: anos.length + 1, styles: { fontStyle: "bold", textColor: NAVY, fillColor: [255, 255, 255], lineColor: GOLD } }]);
    for (const l of b.linhas) {
      const est = l.estilo ?? "calc";
      const fundo = est === "total" ? NAVY : est === "subtotal" ? ([240, 241, 243] as RGB) : est === "calc" ? ([234, 247, 238] as RGB) : ([255, 255, 255] as RGB);
      const texto: RGB = est === "total" ? [255, 255, 255] : [40, 48, 60];
      corpo.push([
        { content: limpar(l.rotulo), styles: { fillColor: est === "total" || est === "subtotal" ? fundo : [255, 255, 255], textColor: texto, fontStyle: est === "total" || est === "subtotal" ? "bold" : "normal", halign: "left" } },
        ...l.valores.map((v) => ({
          content: v === null ? "-" : limpar(formatBRLContabil(v)),
          styles: { fillColor: fundo, textColor: v !== null && v < -0.005 && est !== "total" ? ([192, 53, 43] as RGB) : texto, fontStyle: est === "total" || est === "subtotal" ? "bold" : "normal" },
        })),
      ]);
    }
  }
  const muitas = anos.length > 7;
  let inicioDemo = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  if (inicioDemo > H - 90) { doc.addPage(); topo(); inicioDemo = 24; }
  autoTable(doc, {
    startY: inicioDemo,
    margin: { left: M, right: M, top: 22, bottom: 16 },
    head: [["Demonstrativo anual", ...anos]],
    body: corpo as never,
    theme: "grid",
    styles: { fontSize: muitas ? 5.6 : 7, cellPadding: muitas ? 1 : 1.4, halign: "right", lineColor: [226, 230, 236], overflow: "linebreak" },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], halign: "right" },
    columnStyles: { 0: { halign: "left", cellWidth: muitas ? 38 : 50 } },
    didDrawPage: topo,
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  // Gráficos
  const colW = (largura - 4) / 2;
  for (let i = 0; i < imagens.length; i += 2) {
    const par = imagens.slice(i, i + 2);
    const h = Math.max(...par.map((img) => Math.min(90, colW * img.ratio)));
    if (y + h > H - 18) { doc.addPage(); topo(); y = 24; }
    par.forEach((img, j) => {
      const hh = Math.min(90, colW * img.ratio); const ww = hh / img.ratio;
      doc.addImage(img.url, "JPEG", M + j * (colW + 4) + (colW - ww) / 2, y, ww, hh);
    });
    y += h + 6;
  }

  // Riscos qualitativos
  if (d.riscos?.length) {
    if (y > H - 50) { doc.addPage(); topo(); y = 24; }
    const rot = { interno: "Equipe interna", terceirizado: "Terceirizar", neutro: "Neutro" } as const;
    autoTable(doc, {
      startY: y, margin: { left: M, right: M, top: 22, bottom: 16 },
      head: [["Riscos qualitativos (não alteram o cálculo)", "Favorece"]],
      body: d.riscos.map((r) => [limpar(r.texto), rot[r.favorece]]),
      theme: "grid", styles: { fontSize: 8, cellPadding: 1.6 }, headStyles: { fillColor: NAVY, textColor: [255, 255, 255] },
      columnStyles: { 1: { cellWidth: 40 } }, didDrawPage: topo,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // Nota metodológica
  doc.setFontSize(8);
  const nota = doc.splitTextToSize(limpar(NOTA_METODOLOGICA), largura) as string[];
  if (y + 8 + nota.length * 3.6 > H - 18) { doc.addPage(); topo(); y = 24; }
  doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...NAVY); doc.text("Nota metodológica", M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA); doc.text(nota, M, y);

  // Rodapé
  const total = doc.getNumberOfPages();
  const agora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...GOLD); doc.setLineWidth(0.4); doc.line(M, H - 12, W - M, H - 12);
    doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    doc.text(limpar("Ecommtabil – Contabilidade e Consultoria"), M, H - 7);
    doc.text(limpar(`Gerado em ${agora}`), W / 2, H - 7, { align: "center" });
    doc.text(`Página ${i} de ${total}`, W - M, H - 7, { align: "right" });
  }
  return doc.output("blob");
}
