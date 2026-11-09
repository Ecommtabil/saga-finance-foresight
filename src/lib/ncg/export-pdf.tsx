import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas-pro";
import { DashboardNCG } from "@/components/ncg/DashboardNCG";
import { dadosRelatorio, NOTA_SIMPLIFICADA } from "./relatorio-dados";
import { diasTexto, percentualTexto } from "./apresentacao";
import { periodoNCG } from "./analises";
import { formatarMoeda, type PremissasNCG } from "./premissas";
import { baixarArquivo, nomeArquivoNCG } from "./download";

export async function gerarPdfNCG(empresa: string, cnpj: string, p: PremissasNCG): Promise<Blob> {
  const d = dadosRelatorio(empresa, cnpj, p);
  const host = document.createElement("div");
  host.className = "ncg-tool";
  host.style.cssText = "position:fixed;left:-12000px;top:0;width:1100px;background:var(--ncg-surface);padding:24px;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  const images: { titulo: string; url: string; ratio: number }[] = [];
  try {
    flushSync(() => root.render(<DashboardNCG premissas={p} resultado={d.r}/>));
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 250));
    const titulos = ["Linha do tempo do ciclo", "Composição da NCG — cascata", "Cobertura do caixa"];
    const nodes = Array.from(host.querySelectorAll<HTMLElement>('div[role="img"]'));
    if (nodes.length !== 3) throw new Error("Não foi possível preparar todos os gráficos.");
    for (const [i, node] of nodes.entries()) {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: null, logging: false });
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível preparar a imagem do gráfico.");
      ctx.globalCompositeOperation = "destination-over";
      ctx.fillStyle = getComputedStyle(host).getPropertyValue("--ncg-surface").trim();
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      images.push({ titulo: titulos[i], url: canvas.toDataURL("image/jpeg", 0.92), ratio: canvas.height / canvas.width });
    }
  } finally { root.unmount(); host.remove(); }

  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const textoPdf = (s: string) => s.replace(/\u00a0/g, " ").replace(/−/g, "-");
  const navy: [number, number, number] = [31, 58, 95];
  const gold: [number, number, number] = [201, 162, 39];
  let y = 46;
  const header = () => {
    doc.setFillColor(...navy); doc.rect(0, 0, 210, 33, "F");
    doc.setFont("helvetica", "bold"); doc.setTextColor(...gold); doc.setFontSize(19); doc.text("Ecommtabil", 14, 14);
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.text("Necessidade de Capital de Giro — Relatório técnico", 14, 23);
    doc.setTextColor(...navy); doc.setFontSize(9); doc.setFont("helvetica", "normal");
  };
  header();
  const novaPagina = () => { doc.addPage(); header(); y = 46; };
  const titulo = (texto: string) => { if (y > 250) novaPagina(); doc.setTextColor(...navy); doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.text(texto, 14, y); doc.setFont("helvetica", "normal"); y += 7; };
  const paragrafo = (texto: string) => {
    doc.setFontSize(9); const linhas = doc.splitTextToSize(textoPdf(texto), 180) as string[];
    if (y + linhas.length * 4.5 > 270) novaPagina();
    doc.text(linhas, 14, y); y += linhas.length * 4.5 + 5;
  };
  const tabela = (cabecalho: string[], body: string[][]) => {
    autoTable(doc, { startY: y, head: [cabecalho], body: body.map(l => l.map(textoPdf)), margin: { top: 42, bottom: 22, left: 14, right: 14 },
      styles: { fontSize: 8, cellPadding: 2.4, overflow: "linebreak", textColor: navy }, headStyles: { fillColor: navy, textColor: 255 },
      columnStyles: { 1: { halign: "right" } },
      didDrawPage: () => header(),
      didParseCell: data => {
        if (data.section !== "body") return;
        const label = Array.isArray(data.row.raw) ? String(data.row.raw[0]) : "";
        if (["NCG operacional", "Capital de giro total necessário", "Sobra/(falta)"].includes(label)) data.cell.styles.fontStyle = "bold";
        if (data.column.index === 1 && data.cell.text.join("").includes("R$")) data.cell.styles.textColor = data.cell.text.join("").startsWith("-") ? [180, 40, 40] : [30, 90, 160];
      },
    });
    const end = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
    y = (end ?? y) + 9;
  };
  titulo(empresa);
  paragrafo(`CNPJ: ${cnpj || "Não informado"} | Segmento: ${p.segmento}\nPeríodo: ${periodoNCG(p)}`);
  titulo("Principais indicadores");
  tabela(["Indicador", "Resultado"], [
    ...d.totais.map(([nome, valor]) => [nome, formatarMoeda(valor)]),
    ["Cobertura do caixa", percentualTexto(d.r.coberturaCaixa)],
    ["NCG em dias de venda", diasTexto(d.r.ncgDiasVenda)],
    ["NCG sobre vendas anualizadas", percentualTexto(d.r.ncgSobreVendasAnualizadas)],
    ["Status", d.r.giroCoberto ? "Giro coberto" : "Falta giro"],
  ]);
  titulo("Diagnóstico para a empresa"); paragrafo(d.diagnostico);
  novaPagina();
  for (const image of images) {
    const width = image.titulo === "Cobertura do caixa" ? 100 : 180;
    const height = width * image.ratio;
    if (y + height + 20 > 270) novaPagina();
    titulo(image.titulo); doc.addImage(image.url, "JPEG", 14, y, width, height); y += height + 9;
    if (image.titulo.includes("tempo")) paragrafo(`PME: ${diasTexto(d.r.prazos.pme)} | PMR: ${diasTexto(d.r.prazos.pmr)} | PMP: ${diasTexto(d.r.prazos.pmp)} | Ciclo financeiro: ${diasTexto(d.r.prazos.cicloFinanceiro)}`);
    if (image.titulo.includes("cascata")) paragrafo("Azul: ativos; vermelho: passivos/falta; dourado: reserva. NCG e total necessário são subtotais. Caixa é separado. Sobra/(falta) = caixa − total necessário.");
    if (image.titulo.includes("Cobertura")) paragrafo("Vermelho: abaixo de 70%; amarelo: de 70% até menos de 100%; verde: a partir de 100%. Escala visual até 150%.");
  }
  novaPagina(); titulo("Memorial de cálculo — prazos médios");
  tabela(["Prazo", "Dias", "Fórmula"], d.prazos.map(([nome, valor, formula]) => [nome, diasTexto(valor), formula]));
  titulo("Bases diárias"); tabela(["Base", "Valor por dia", "Fórmula"], d.bases.map(([nome, valor, formula]) => [nome, formatarMoeda(valor), formula]));
  titulo("Composição da NCG operacional"); tabela(["Componente", "Valor", "Dias", "Lógica"], [
    ...d.componentes.map(c => [c.nome, formatarMoeda(c.valor), c.dias === null ? "—" : diasTexto(c.dias), c.logica]),
    ["NCG operacional", formatarMoeda(d.r.ncg.total), "—", "Ativos operacionais − passivos operacionais"],
  ]);
  paragrafo("Saldos médios = (saldo inicial + saldo final) / 2. Dias são arredondados apenas na exibição; os cálculos mantêm precisão integral.");
  titulo("Necessidade total x caixa"); tabela(["Componente", "Valor", "Lógica"], d.totais.map(([nome, valor, formula]) => [nome, formatarMoeda(valor), formula]));
  titulo("Comparativo com o método simplificado"); tabela(["Método", "Valor", "Fórmula"], [
    ["NCG simplificada", formatarMoeda(d.r.ncgSimplificada), "Ciclo financeiro × (compras/dia + despesas fixas/dia)"],
    ["NCG operacional técnica", formatarMoeda(d.r.ncg.total), "Soma dos componentes operacionais"],
    ["Diferença", formatarMoeda(d.r.diferencaSimplificada), "Simplificada − técnica"],
  ]); paragrafo(NOTA_SIMPLIFICADA);
  const paginas = doc.getNumberOfPages(); const agora = new Date().toLocaleString("pt-BR");
  for (let i = 1; i <= paginas; i++) {
    doc.setPage(i); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(...navy);
    doc.text(`Ecommtabil | ${agora}`, 14, 287); doc.text(`${i} / ${paginas}`, 196, 287, { align: "right" });
  }
  return doc.output("blob");
}
export function baixarPdfNCG(blob: Blob, empresa: string) { baixarArquivo(blob, nomeArquivoNCG(empresa, "pdf")); }