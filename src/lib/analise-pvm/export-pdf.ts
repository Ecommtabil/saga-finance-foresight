import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas-pro";
import type { ResultadoPVM } from "@/lib/pvm";
import { brl, pct2, pctSinal, periodoNome, qtd } from "./importacao";
import type { LeituraPVM } from "./insights";

const limpar = (s: string) => s.replace(/\u00a0/g, " ").replace(/[−–]/g, "-").replace(/×/g, "x");
const NIVEL = { unidade: "Unidade", categoria: "Categoria", produto: "Produto" } as const;

export async function gerarPdfPVM(cliente: string, r: ResultadoPVM, leitura: LeituraPVM, grafico: HTMLElement | null): Promise<Blob> {
  let img: { url: string; ratio: number } | null = null;
  if (grafico) {
    await document.fonts.ready;
    const canvas = await html2canvas(grafico, { scale: 2, backgroundColor: "#ffffff", logging: false });
    img = { url: canvas.toDataURL("image/jpeg", 0.9), ratio: canvas.height / canvas.width };
  }
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const navy: [number, number, number] = [11, 31, 58], gold: [number, number, number] = [201, 162, 39];
  const verde: [number, number, number] = [22, 163, 74], vermelho: [number, number, number] = [220, 38, 38];
  const W = 210, M = 12;
  const cabecalho = () => {
    doc.setFillColor(...navy); doc.rect(0, 0, W, 22, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(...gold); doc.text("Ecommtabil", M, 10);
    doc.setTextColor(255, 255, 255); doc.text(limpar(" – Análise PVM"), M + doc.getTextWidth("Ecommtabil"), 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(limpar(`${cliente || "Cliente"}  |  ${periodoNome(r.base)} x ${periodoNome(r.atual)}  |  Nível: ${NIVEL[r.nivel]}`), M, 17);
  };
  cabecalho();
  let y = 30;
  const t = r.total;
  const kpis: Array<[string, string, string?]> = [
    ["Receita base", brl(t.r0)], ["Receita atual", brl(t.r1)],
    ["Variação", brl(t.dR), pctSinal(t.r0 ? t.dR / t.r0 : 0)],
    ["Volume", `${qtd(t.q0)} > ${qtd(t.q1)}`, pctSinal(t.q0 ? t.dQ / t.q0 : 0)],
    ["Preço médio", `${brl(t.p0)} > ${brl(t.p1)}`, pctSinal(t.p0 ? (t.p1 - t.p0) / t.p0 : 0)],
  ];
  const bw = (W - 2 * M - 4 * 3) / 5;
  kpis.forEach(([n, v, d], i) => {
    const x = M + i * (bw + 3);
    doc.setDrawColor(225, 228, 235); doc.setFillColor(248, 249, 252); doc.roundedRect(x, y, bw, 20, 1.5, 1.5, "FD");
    doc.setFontSize(7); doc.setTextColor(100, 110, 125); doc.text(n, x + 2.5, y + 5);
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.3); doc.setTextColor(...navy);
    doc.text(doc.splitTextToSize(limpar(v), bw - 4) as string[], x + 2.5, y + 10.5);
    if (d) { doc.setFontSize(7.5); doc.setTextColor(...(d.startsWith("−") ? vermelho : verde)); doc.text(limpar(d), x + 2.5, y + 17.5); }
    doc.setFont("helvetica", "normal");
  });
  y += 25;
  doc.setFontSize(8); doc.setTextColor(...(r.conciliado ? verde : vermelho));
  doc.text(limpar(r.conciliado ? "Conciliado: Volume + Preço + Mix = Receita atual − Receita base" : `Diferença de conciliação: ${brl(r.diferenca)}`), M, y); y += 5;

  if (img) {
    const largura = W - 2 * M; const altura = Math.min(85, largura * img.ratio);
    doc.addImage(img.url, "JPEG", M, y, altura / img.ratio, altura); y += altura + 5;
  }
  doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...navy); doc.text("Leitura da variação", M, y); y += 5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.8); doc.setTextColor(40, 48, 60);
  const extras = [
    leitura.quedasPreco.length ? `Maiores quedas de preço médio: ${leitura.quedasPreco.map(i => `${i.item} (${pctSinal(i.dP / i.p0)})`).join("; ")}.` : "",
    leitura.altasPreco.length ? `Maiores altas de preço médio: ${leitura.altasPreco.map(i => `${i.item} (${pctSinal(i.dP / i.p0)})`).join("; ")}.` : "",
  ].filter(Boolean);
  for (const f of [...leitura.frases, ...extras]) {
    const linhas = doc.splitTextToSize(limpar(`• ${f}`), W - 2 * M) as string[];
    doc.text(linhas, M, y); y += linhas.length * 4 + 1;
  }
  y += 3;

  const LIMITE = 30;
  const ordenados = [...r.itens].sort((a, b) => Math.abs(b.total) - Math.abs(a.total));
  const mostrados = ordenados.slice(0, LIMITE);
  const resto = ordenados.slice(LIMITE);
  const linhas = mostrados.map(i => [i.item + (i.status === "novo" ? " (novo)" : i.status === "descontinuado" ? " (desc.)" : ""), brl(i.r0), brl(i.r1), pct2(i.mix1), brl(i.volume), brl(i.preco), brl(i.mix), brl(i.total)]);
  if (resto.length) {
    const s = (k: "r0" | "r1" | "volume" | "preco" | "mix" | "total") => resto.reduce((a, i) => a + i[k], 0);
    linhas.push([`Outros (${resto.length} itens)`, brl(s("r0")), brl(s("r1")), pct2(resto.reduce((a, i) => a + i.mix1, 0)), brl(s("volume")), brl(s("preco")), brl(s("mix")), brl(s("total"))]);
  }
  linhas.push(["TOTAL", brl(t.r0), brl(t.r1), "100,00%", brl(t.volume), brl(t.preco), brl(t.mix), brl(t.total)]);
  autoTable(doc, {
    startY: y, head: [[NIVEL[r.nivel], "Receita base", "Receita atual", "Mix atual", "Ef. Volume", "Ef. Preço", "Ef. Mix", "Total"]],
    body: linhas.map(l => l.map(limpar)), margin: { top: 28, left: M, right: M, bottom: 14 },
    styles: { fontSize: 7, cellPadding: 1.4 }, headStyles: { fillColor: navy, textColor: 255 },
    didParseCell: d => {
      if (d.section !== "body") return;
      if (d.column.index > 0) d.cell.styles.halign = "right";
      if (d.column.index >= 4 && d.cell.text.join("").startsWith("-")) d.cell.styles.textColor = vermelho;
      else if (d.column.index >= 4) d.cell.styles.textColor = verde;
      if (d.row.index === linhas.length - 1) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [250, 243, 220]; }
    },
    didDrawPage: () => cabecalho(),
  });
  const total = doc.getNumberOfPages(), agora = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFontSize(7); doc.setTextColor(100, 110, 125);
    doc.text(limpar(`Ecommtabil | Gerado em ${agora}${resto.length && i === total ? ` | Tabela com os ${LIMITE} itens de maior impacto; demais em "Outros".` : ""}`), M, 290);
    doc.text(`${i} / ${total}`, W - M, 290, { align: "right" });
  }
  return doc.output("blob");
}
