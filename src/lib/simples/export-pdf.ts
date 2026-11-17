import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MES_CURTO, type ResultadoEmpresa } from "./calculo";
import { COLUNAS_ANEXO, NOME_ANEXO, NOME_COLUNA, ORDEM_TRIBUTOS, TRIBUTOS_ANEXO, type AnexoId, type Tributo } from "./tabelas";
import type { EmpresaSimples } from "./store";
import { brl, num2, pct2, pct4 } from "./formato";
import { COR_ANEXO, COR_TRIBUTO } from "./cores";

type RGB = [number, number, number];
const NAVY: RGB = [15, 42, 68];
const GOLD: RGB = [201, 162, 39];
const CINZA: RGB = [91, 107, 127];
const BORDA: RGB = [226, 230, 236];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const limpar = (s: string) => s.replace(/\u00a0/g, " ").replace(/[−–]/g, "-").replace(/×/g, "x").replace(/÷/g, "/");

export async function gerarPdfSimples(e: EmpresaSimples, r: ResultadoEmpresa): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape", compress: true });
  const W = 297, H = 210, M = 12;
  const larg = W - 2 * M;
  const geradoEm = new Date().toLocaleString("pt-BR");
  const topo = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 15, "F");
    doc.setFillColor(...GOLD); doc.rect(M, 4.5, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY); doc.text("E", M + 3, 8.9, { align: "center" });
    doc.setFontSize(13); doc.setTextColor(...GOLD); doc.text("Ecommtabil", M + 8.5, 9.8);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(255, 255, 255);
    doc.text(limpar(`Memória de cálculo do Simples Nacional - ${e.razaoSocial} - ${e.ano}`), W - M, 9.8, { align: "right" });
  };
  topo();
  let y = 24;
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(...NAVY);
  doc.text("Memória de cálculo do Simples Nacional", M, y); y += 6;
  doc.setDrawColor(...BORDA); doc.setFillColor(247, 248, 250); doc.roundedRect(M, y, larg, 11, 1.5, 1.5, "FD");
  const info: Array<[string, string]> = [
    ["Empresa", e.razaoSocial || "-"], ["CNPJ", e.cnpj || "-"], ["Ano-calendário", String(e.ano)],
    ["Anexos", e.anexos.map((a) => `Anexo ${a}`).join(", ")],
  ];
  let x = M + 4;
  for (const [k, v] of info) {
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); doc.text(`${k}:`, x, y + 7);
    const lw = doc.getTextWidth(`${k}:`) + 1.5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(40, 48, 60); doc.text(limpar(v), x + lw, y + 7);
    x += Math.max(55, lw + doc.getTextWidth(limpar(v)) + 10);
  }
  y += 16;

  // KPIs
  const k = r.consolidado;
  const kpis: Array<[string, string, string]> = [
    ["Faturamento no ano", brl(k.faturamento), "Receita bruta de todos os anexos"],
    ["DAS total no ano", brl(k.das), `DAS / faturamento: ${pct2(k.aliquotaPaga)}`],
    ["Alíquota efetiva média", pct4(k.aeMediaPonderada), "Ponderada pela receita de cada mês"],
    ["Economia com segregação", brl(k.economia), "ST, monofásico e retenção de ISS"],
  ];
  const kw = (larg - 3 * 4) / 4;
  kpis.forEach(([t, v, s], i) => {
    const kx = M + i * (kw + 4);
    doc.setFillColor(255, 255, 255); doc.setDrawColor(...BORDA); doc.roundedRect(kx, y, kw, 20, 1.5, 1.5, "FD");
    doc.setFillColor(...GOLD); doc.rect(kx, y + 3, 1.2, 14, "F");
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA); doc.text(limpar(t), kx + 4, y + 6);
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY); doc.text(limpar(v), kx + 4, y + 12.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); doc.setTextColor(...CINZA); doc.text(limpar(s), kx + 4, y + 17);
  });
  y += 26;

  // Gráficos
  const gH = 62;
  const g1w = larg * 0.42, g2w = larg * 0.33, g3w = larg - g1w - g2w - 8;
  barrasEmpilhadas(doc, e, r, M, y, g1w, gH);
  linhaAe(doc, e, r, M + g1w + 4, y, g2w, gH);
  rosca(doc, r, M + g1w + g2w + 8, y, g3w, gH);
  y += gH + 6;

  const alertas = r.alertasGerais.map((a) => a.texto);
  if (e.anexos.includes("IV")) alertas.push("Anexo IV: a CPP não está no DAS (recolhida via GPS/DCTFWeb).");
  if (alertas.length) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA);
    alertas.slice(0, 3).forEach((a, i) => doc.text(limpar(`• ${a}`), M, y + i * 4));
  }

  // Tabelas por anexo
  for (const a of e.anexos) {
    const dados = r.anexos[a];
    if (!dados) continue;
    doc.addPage(); topo();
    let yy = 23;
    doc.setFont("helvetica", "bold"); doc.setFontSize(13); doc.setTextColor(...NAVY); doc.text(limpar(NOME_ANEXO[a]), M, yy);
    yy += 3;
    const trib = TRIBUTOS_ANEXO[a];
    const head = [["Mês", "Receita total", "RBT12", "Faixa", "Alíq. nominal", "Parcela a deduzir", "Alíq. efetiva", ...trib.map((t) => `${t} (R$)`), "Total do DAS"]];
    const body = dados.meses.map((m) => [
      MES_CURTO[m.mes], num2(m.receitaTotal), num2(m.rbt12), m.faixa === 7 ? "Acima" : m.faixa || "-",
      m.calculado ? pct2(m.aliqNominal) : "-", m.calculado ? num2(m.deducao) : "-", m.calculado ? pct4(m.ae) : "-",
      ...trib.map((t) => num2(m.tributos[t])), num2(m.totalDas),
    ]);
    const foot = [["TOTAIS", num2(dados.totais.receitaTotal), "", "", "", "", "", ...trib.map((t) => num2(dados.totais.tributos[t])), num2(dados.totais.totalDas)]];
    autoTable(doc, {
      startY: yy, head, body: body as string[][], foot, margin: { left: M, right: M, top: 20, bottom: 14 },
      styles: { fontSize: 7.3, cellPadding: 1.4, halign: "right", lineColor: BORDA, lineWidth: 0.1, textColor: [30, 40, 55] },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], halign: "center", fontStyle: "bold" },
      footStyles: { fillColor: [250, 243, 220], textColor: NAVY, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 3: { halign: "center" } },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      didDrawPage: () => topo(),
    });
    // Imposto por tipo de receita
    const cols = COLUNAS_ANEXO[a];
    const y2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    autoTable(doc, {
      startY: y2,
      head: [["Mês", ...cols.map((c) => `Receita - ${NOME_COLUNA[c]}`), ...cols.map((c) => `Imposto - ${NOME_COLUNA[c]}`)]],
      body: dados.meses.map((m) => [MES_CURTO[m.mes], ...cols.map((c) => num2(m.receitas[c])), ...cols.map((c) => num2(m.impostoPorColuna[c]))]),
      foot: [["TOTAIS", ...cols.map((c) => num2(dados.totais.receitas[c])), ...cols.map((c) => num2(dados.totais.impostoPorColuna[c]))]],
      margin: { left: M, right: M, top: 20, bottom: 14 },
      styles: { fontSize: 7.3, cellPadding: 1.3, halign: "right", lineColor: BORDA, lineWidth: 0.1, textColor: [30, 40, 55] },
      headStyles: { fillColor: [90, 107, 127], textColor: [255, 255, 255], halign: "center", fontStyle: "bold" },
      footStyles: { fillColor: [250, 243, 220], textColor: NAVY, fontStyle: "bold", halign: "right" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold" } },
      didDrawPage: () => topo(),
    });
    let y3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
    const notas = new Set<string>();
    for (const m of dados.meses) for (const al of m.alertas) notas.add(al.texto);
    if (a === "IV") notas.add("A CPP do Anexo IV não está no DAS: é recolhida via GPS/DCTFWeb.");
    notas.add("Valores em R$. Alíquotas com 4 casas; cálculo com precisão total e arredondamento só na exibição.");
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    for (const n of [...notas].slice(0, 8)) {
      if (y3 > H - 18) { doc.addPage(); topo(); y3 = 24; }
      doc.text(limpar(`• ${n}`), M, y3); y3 += 3.8;
    }
  }

  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setDrawColor(...BORDA); doc.line(M, H - 10, W - M, H - 10);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
    doc.text("Ecommtabil – Contabilidade e Consultoria".replace("–", "-"), M, H - 6);
    doc.text(limpar(`Gerado em ${geradoEm}`), W / 2, H - 6, { align: "center" });
    doc.text(`Página ${p} de ${total}`, W - M, H - 6, { align: "right" });
  }
  return doc.output("blob");
}

function moldura(doc: jsPDF, titulo: string, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(...BORDA); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); doc.text(limpar(titulo), x + 3, y + 5);
}
const curto = (v: number) => (v >= 1e6 ? `${num2(v / 1e6)} mi` : v >= 1e3 ? `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : num2(v));

function legenda(doc: jsPDF, itens: Array<[string, RGB]>, x: number, y: number, maxW: number) {
  let cx = x, cy = y;
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  for (const [n, c] of itens) {
    const w = doc.getTextWidth(n) + 6;
    if (cx + w > x + maxW) { cx = x; cy += 3.6; }
    doc.setFillColor(...c); doc.rect(cx, cy - 2, 2.2, 2.2, "F");
    doc.setTextColor(...CINZA); doc.text(n, cx + 3, cy);
    cx += w;
  }
}

function barrasEmpilhadas(doc: jsPDF, e: EmpresaSimples, r: ResultadoEmpresa, x: number, y: number, w: number, h: number) {
  moldura(doc, "DAS mensal por anexo", x, y, w, h);
  const px = x + 14, py = y + 9, pw = w - 18, ph = h - 21;
  const max = Math.max(1, ...r.consolidado.dasMensal.map((m) => m.total));
  doc.setFont("helvetica", "normal"); doc.setFontSize(6); doc.setTextColor(...CINZA);
  for (let i = 0; i <= 4; i++) {
    const yy = py + ph - (ph * i) / 4;
    doc.setDrawColor(238, 240, 244); doc.line(px, yy, px + pw, yy);
    doc.text(curto((max * i) / 4), px - 1.5, yy + 1, { align: "right" });
  }
  const bw = pw / 12;
  r.consolidado.dasMensal.forEach((m, i) => {
    let base = py + ph;
    for (const a of e.anexos) {
      const v = m[a] ?? 0;
      const bh = (v / max) * ph;
      if (bh > 0) { doc.setFillColor(...hex(COR_ANEXO[a])); doc.rect(px + i * bw + bw * 0.18, base - bh, bw * 0.64, bh, "F"); }
      base -= bh;
    }
    doc.setTextColor(...CINZA); doc.text(MES_CURTO[i], px + i * bw + bw / 2, py + ph + 3.5, { align: "center" });
  });
  legenda(doc, e.anexos.map((a) => [`Anexo ${a}`, hex(COR_ANEXO[a])] as [string, RGB]), px, y + h - 3, pw);
}

function linhaAe(doc: jsPDF, e: EmpresaSimples, r: ResultadoEmpresa, x: number, y: number, w: number, h: number) {
  moldura(doc, "Alíquota efetiva x RBT12", x, y, w, h);
  const px = x + 12, py = y + 9, pw = w - 24, ph = h - 21;
  const maxR = Math.max(1, ...r.rbt12.map((m) => m.valor));
  const aes = e.anexos.flatMap((a) => r.anexos[a]?.meses.filter((m) => m.calculado).map((m) => m.ae) ?? []);
  const maxA = Math.max(0.01, ...aes) * 1.15;
  const bw = pw / 12;
  doc.setFont("helvetica", "normal"); doc.setFontSize(6);
  for (let i = 0; i <= 4; i++) {
    const yy = py + ph - (ph * i) / 4;
    doc.setDrawColor(238, 240, 244); doc.line(px, yy, px + pw, yy);
    doc.setTextColor(...CINZA); doc.text(pct2((maxA * i) / 4), px - 1.5, yy + 1, { align: "right" });
    doc.text(curto((maxR * i) / 4), px + pw + 1.5, yy + 1);
  }
  r.rbt12.forEach((m, i) => {
    const bh = (m.valor / maxR) * ph;
    doc.setFillColor(226, 232, 240); doc.rect(px + i * bw + bw * 0.2, py + ph - bh, bw * 0.6, bh, "F");
    doc.setTextColor(...CINZA); doc.text(MES_CURTO[i], px + i * bw + bw / 2, py + ph + 3.5, { align: "center" });
  });
  for (const a of e.anexos) {
    const meses = r.anexos[a]?.meses ?? [];
    doc.setDrawColor(...hex(COR_ANEXO[a])); doc.setLineWidth(0.6);
    let ant: [number, number] | null = null;
    for (const m of meses) {
      if (!m.calculado) { ant = null; continue; }
      const p: [number, number] = [px + m.mes * bw + bw / 2, py + ph - (m.ae / maxA) * ph];
      if (ant) doc.line(ant[0], ant[1], p[0], p[1]);
      doc.setFillColor(...hex(COR_ANEXO[a])); doc.circle(p[0], p[1], 0.6, "F");
      ant = p;
    }
    doc.setLineWidth(0.2);
  }
  legenda(doc, [...e.anexos.map((a) => [`AE Anexo ${a}`, hex(COR_ANEXO[a])] as [string, RGB]), ["RBT12", [200, 208, 220] as RGB]], px, y + h - 3, pw);
}

function rosca(doc: jsPDF, r: ResultadoEmpresa, x: number, y: number, w: number, h: number) {
  moldura(doc, "Composição do DAS anual por tributo", x, y, w, h);
  const itens = ORDEM_TRIBUTOS.map((t) => [t, r.consolidado.porTributo[t]] as [Tributo, number]).filter(([, v]) => v > 0);
  const total = itens.reduce((s, [, v]) => s + v, 0);
  const raio = Math.min(w * 0.22, (h - 14) / 2);
  const cx = x + raio + 5, cy = y + 8 + (h - 8) / 2;
  if (total <= 0) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA); doc.text("Sem DAS no ano", x + w / 2, cy, { align: "center" });
    return;
  }
  let a0 = -Math.PI / 2;
  for (const [t, v] of itens) {
    const a1 = a0 + (v / total) * Math.PI * 2;
    doc.setFillColor(...hex(COR_TRIBUTO[t]));
    const passos = Math.max(2, Math.ceil((a1 - a0) / 0.05));
    for (let i = 0; i < passos; i++) {
      const s = a0 + ((a1 - a0) * i) / passos, f = a0 + ((a1 - a0) * (i + 1)) / passos + 0.004;
      doc.triangle(cx, cy, cx + raio * Math.cos(s), cy + raio * Math.sin(s), cx + raio * Math.cos(f), cy + raio * Math.sin(f), "F");
    }
    a0 = a1;
  }
  doc.setFillColor(255, 255, 255); doc.circle(cx, cy, raio * 0.58, "F");
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  let ly = y + 12;
  const lx = cx + raio + 5;
  for (const [t, v] of itens) {
    doc.setFillColor(...hex(COR_TRIBUTO[t])); doc.rect(lx, ly - 2, 2.2, 2.2, "F");
    doc.setTextColor(...NAVY); doc.text(`${t}`, lx + 3, ly);
    doc.setTextColor(...CINZA); doc.text(`${pct2(v / total)}  ${brl(v)}`.replace(/\u00a0/g, " "), lx + 13, ly);
    ly += 4.6;
  }
}

export type { AnexoId };
