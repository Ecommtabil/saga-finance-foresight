import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas-pro";
import { faixasProbabilidade, ROTULO_CLASSE, classificarCV } from "./stats";
import { moeda, moedaCompacta, numero, pct, type ConfigVolatilidade, type Estudo, type SerieCalculada } from "./dados";

export function nomeArquivoVolatilidade(cliente: string, ext: string) {
  const nome = cliente.trim().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_").slice(0, 80) || "Cliente";
  return `Ecommtabil_Volatilidade_${nome}.${ext}`;
}

const limpar = (s: string) => s.replace(/\u00a0/g, " ").replace(/[−–]/g, "-").replace(/≤/g, "<=").replace(/±/g, "+/-").replace(/×/g, "x");

async function capturarGraficos(raiz: HTMLElement) {
  const ferramenta = raiz.closest(".vol-tool");
  const escuro = ferramenta?.classList.contains("vol-dark") ?? false;
  if (escuro) ferramenta!.classList.remove("vol-dark");
  try {
    await document.fonts.ready;
    await new Promise(r => setTimeout(r, 120));
    const out: { titulo: string; url: string; ratio: number; estreito: boolean }[] = [];
    for (const node of Array.from(raiz.querySelectorAll<HTMLElement>("[data-vol-chart]"))) {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: "#ffffff", logging: false });
      out.push({ titulo: node.dataset.volChart ?? "", url: canvas.toDataURL("image/jpeg", 0.9), ratio: canvas.height / canvas.width, estreito: node.getBoundingClientRect().width < 760 });
    }
    return out;
  } finally {
    if (escuro) ferramenta!.classList.add("vol-dark");
  }
}

export async function gerarPdfVolatilidade(estudo: Estudo, series: SerieCalculada[], config: ConfigVolatilidade, periodo: string, diagnostico: string, raiz: HTMLElement): Promise<Blob> {
  const imagens = await capturarGraficos(raiz);
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const navy: [number, number, number] = [11, 31, 58];
  const gold: [number, number, number] = [201, 162, 39];
  const cinza: [number, number, number] = [100, 110, 125];
  const W = 210, M = 14;
  let y = 0;

  // Capa
  doc.setFillColor(...navy); doc.rect(0, 0, W, 297, "F");
  doc.setFillColor(...gold); doc.rect(M, 70, 40, 1.6, "F");
  doc.setFont("helvetica", "bold"); doc.setTextColor(...gold); doc.setFontSize(22); doc.text("Ecommtabil", M, 40);
  doc.setTextColor(255, 255, 255); doc.setFontSize(28); doc.text(doc.splitTextToSize("Estudo de Volatilidade Financeira", 170) as string[], M, 92);
  doc.setFont("helvetica", "normal"); doc.setFontSize(13);
  const capa = [
    ["Cliente", estudo.cliente || "Não informado"], ["CNPJ", estudo.cnpj || "Não informado"], ["Período analisado", periodo],
    ["Responsável técnico", estudo.responsavel || "Não informado"],
    ["Data da análise", estudo.dataAnalise ? estudo.dataAnalise.split("-").reverse().join("/") : new Date().toLocaleDateString("pt-BR")],
  ];
  let cy = 135;
  for (const [k, v] of capa) {
    doc.setTextColor(...gold); doc.setFontSize(9); doc.text(k.toUpperCase(), M, cy);
    doc.setTextColor(255, 255, 255); doc.setFontSize(13); doc.text(limpar(v), M, cy + 6.5); cy += 18;
  }

  const cabecalho = () => {
    doc.setFillColor(...navy); doc.rect(0, 0, W, 20, "F");
    doc.setFont("helvetica", "bold"); doc.setTextColor(...gold); doc.setFontSize(12); doc.text("Ecommtabil", M, 12.5);
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    doc.text(limpar(`Estudo de Volatilidade — ${estudo.cliente || "Cliente"}`), W - M, 12.5, { align: "right" });
  };
  const novaPagina = () => { doc.addPage(); cabecalho(); y = 30; };
  const titulo = (t: string) => {
    if (y > 255) novaPagina();
    doc.setFont("helvetica", "bold"); doc.setFontSize(12.5); doc.setTextColor(...navy); doc.text(limpar(t), M, y);
    doc.setFillColor(...gold); doc.rect(M, y + 1.8, 18, 0.8, "F"); y += 8; doc.setFont("helvetica", "normal");
  };
  const paragrafo = (t: string, tam = 9.5) => {
    doc.setFontSize(tam); doc.setTextColor(40, 48, 60);
    for (const bloco of limpar(t).split("\n")) {
      const linhas = doc.splitTextToSize(bloco, W - 2 * M) as string[];
      for (const l of linhas) { if (y > 278) novaPagina(); doc.text(l, M, y); y += tam * 0.45; }
      y += 1.5;
    }
    y += 2;
  };
  const tabela = (head: string[], body: string[][], destaqueLinha?: (r: string[]) => boolean) => {
    autoTable(doc, {
      startY: y, head: [head.map(limpar)], body: body.map(r => r.map(limpar)), margin: { top: 28, left: M, right: M, bottom: 18 },
      styles: { fontSize: 8, cellPadding: 1.8, textColor: [30, 40, 55] }, headStyles: { fillColor: navy, textColor: 255 },
      alternateRowStyles: { fillColor: [246, 247, 250] },
      didParseCell: d => {
        if (d.section === "body" && d.column.index > 0) d.cell.styles.halign = "right";
        if (d.section === "body" && destaqueLinha && Array.isArray(d.row.raw) && destaqueLinha(d.row.raw as string[])) { d.cell.styles.fontStyle = "bold"; d.cell.styles.fillColor = [250, 243, 220]; }
      },
      didDrawPage: () => cabecalho(),
    });
    y = ((doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y) + 8;
  };

  // KPIs
  novaPagina();
  titulo("Indicadores-chave por série");
  const cardW = (W - 2 * M - 6) / 2;
  series.forEach((s, i) => {
    const col = i % 2;
    if (col === 0 && i > 0) y += 34;
    if (y > 240) novaPagina();
    const x = M + col * (cardW + 6);
    doc.setDrawColor(225, 228, 235); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, cardW, 30, 2, 2, "FD");
    doc.setFillColor(...gold); doc.rect(x, y, cardW, 1.2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(...navy); doc.text(limpar(s.serie.nome), x + 4, y + 7.5);
    const classe = classificarCV(s.stats.cv, { baixo: config.cvBaixo, moderado: config.cvModerado });
    const corClasse: [number, number, number] = classe === "baixa" ? [40, 130, 80] : classe === "moderada" ? [190, 140, 20] : [190, 50, 40];
    doc.setFontSize(8); doc.setTextColor(...corClasse); doc.text(ROTULO_CLASSE[classe], x + cardW - 4, y + 7.5, { align: "right" });
    const kpis = [["Média", moedaCompacta(s.stats.media)], ["Desvio padrão", moedaCompacta(s.stats.desvio)], ["CV", pct(s.stats.cv)]];
    kpis.forEach(([k, v], j) => {
      const kx = x + 4 + j * ((cardW - 8) / 3);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...cinza); doc.text(k, kx, y + 16);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...navy); doc.text(limpar(v), kx, y + 23);
    });
  });
  y += 38;

  titulo("Estatística descritiva");
  const linhasEst: Array<[string, (s: SerieCalculada) => string]> = [
    ["N (meses)", s => String(s.stats.n)], ["Média", s => moeda(s.stats.media)], ["Mediana", s => moeda(s.stats.mediana)],
    ["Mínimo", s => moeda(s.stats.minimo)], ["Máximo", s => moeda(s.stats.maximo)], ["Amplitude", s => moeda(s.stats.amplitude)],
    ["Desvio padrão (amostral)", s => moeda(s.stats.desvio)], ["Coef. de variação", s => pct(s.stats.cv)],
    ["Moda", s => (s.stats.moda ? s.stats.moda.map(moeda).join(" / ") : "Sem moda")],
    ...(config.mostrarMomentos ? [["Assimetria", (s: SerieCalculada) => (s.stats.assimetria === null ? "—" : numero(s.stats.assimetria, 3))], ["Curtose", (s: SerieCalculada) => (s.stats.curtose === null ? "—" : numero(s.stats.curtose, 3))]] as Array<[string, (s: SerieCalculada) => string]> : []),
    ["Normalidade (Jarque-Bera)", s => (s.stats.aproxNormal === null ? "—" : s.stats.aproxNormal ? "Aprox. normal" : "Pode não ser normal")],
    ["Tendência ao mês", s => `${s.stats.tendenciaMensal >= 0 ? "+" : "-"}${pct(Math.abs(s.stats.tendenciaMensal))}`],
  ];
  tabela(["Indicador", ...series.map(s => s.serie.nome)], linhasEst.map(([k, f]) => [k, ...series.map(f)]));

  for (const s of series) {
    titulo(`Faixas de probabilidade — ${s.serie.nome}`);
    tabela(["Faixa", "Limite inferior", "Limite superior", "Probabilidade", "Acumulada"],
      faixasProbabilidade(s.stats.media, s.stats.desvio).map(f => [f.rotulo, moeda(f.inferior), moeda(f.superior), pct(f.probabilidade, 2), pct(f.acumulada, 2)]),
      r => r[0] === "Média");
  }
  paragrafo("Regra empírica: +/-1DP = 68,27%; entre 1 e 2DP = 13,59% de cada lado; entre 2 e 3DP = 2,14% de cada lado; além de 3DP = 0,13% de cada lado. Cada série usa sua própria média e desvio padrão.", 8);

  // Gráficos
  novaPagina();
  titulo("Gráficos");
  const desenhar = (img: (typeof imagens)[number], x: number, largura: number, alturaMax: number) => {
    let altura = largura * img.ratio;
    if (altura > alturaMax) altura = alturaMax;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...navy);
    doc.text(doc.splitTextToSize(limpar(img.titulo), largura) as string[], x, y);
    doc.addImage(img.url, "JPEG", x, y + 3, altura / img.ratio, altura);
    return altura + 11;
  };
  for (let i = 0; i < imagens.length; i++) {
    const img = imagens[i];
    const prox = imagens[i + 1];
    if (img.estreito) {
      const meia = (W - 2 * M - 6) / 2;
      const alt = Math.max(meia * img.ratio, prox?.estreito ? meia * prox.ratio : 0);
      if (y + alt + 12 > 282) novaPagina();
      const h1 = desenhar(img, M, meia, 90);
      const h2 = prox?.estreito ? desenhar(prox, M + meia + 6, meia, 90) : 0;
      if (prox?.estreito) i++;
      y += Math.max(h1, h2);
    } else {
      const largura = W - 2 * M;
      if (y + Math.min(110, largura * img.ratio) + 12 > 282) novaPagina();
      y += desenhar(img, M, largura, 110);
    }
  }

  // Diagnóstico e assinatura
  novaPagina();
  titulo("Diagnóstico");
  paragrafo(diagnostico || "—");
  if (y > 240) novaPagina();
  y = Math.max(y + 20, 235);
  doc.setDrawColor(...navy); doc.line(M, y, M + 80, y);
  doc.setFontSize(9.5); doc.setTextColor(...navy); doc.setFont("helvetica", "bold"); doc.text(limpar(estudo.responsavel || "Responsável técnico"), M, y + 5.5);
  doc.setFont("helvetica", "normal"); doc.setTextColor(...cinza); doc.text("Responsável técnico — Ecommtabil", M, y + 10.5);

  const total = doc.getNumberOfPages();
  const agora = new Date().toLocaleString("pt-BR");
  for (let i = 2; i <= total; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(...cinza);
    doc.text(limpar(`Ecommtabil | Gerado em ${agora}`), M, 290); doc.text(`${i} / ${total}`, W - M, 290, { align: "right" });
  }
  return doc.output("blob");
}
