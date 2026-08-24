import * as XLSX from "xlsx";
import jsPDF, { GState } from "jspdf";
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

const NAVY: [number, number, number] = [42, 53, 102];
const TEAL: [number, number, number] = [59, 169, 160];
const CORAL: [number, number, number] = [232, 112, 95];
const PERI: [number, number, number] = [123, 135, 214];

const compacto = (n: number) => {
  const abs = Math.abs(n);
  const s =
    abs >= 1e9
      ? (n / 1e9).toFixed(1) + "B"
      : abs >= 1e6
        ? (n / 1e6).toFixed(1) + "M"
        : abs >= 1e3
          ? (n / 1e3).toFixed(0) + "k"
          : n.toFixed(0);
  return s;
};

type Box = { x: number; y: number; w: number; h: number };

function molduraGrafico(doc: jsPDF, b: Box, titulo: string) {
  doc.setDrawColor(226, 232, 240);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(b.x, b.y, b.w, b.h, 6, 6, "FD");
  doc.setFontSize(10);
  doc.setTextColor(...NAVY);
  doc.text(titulo, b.x + 12, b.y + 18);
  doc.setTextColor(0);
}

/** Área de plotagem interna do card. */
function plotArea(b: Box): Box {
  return { x: b.x + 40, y: b.y + 30, w: b.w - 56, h: b.h - 60 };
}

function escala(vals: number[]) {
  const max = Math.max(0, ...vals);
  const min = Math.min(0, ...vals);
  const span = max - min || 1;
  return { max, min, span };
}

function eixos(doc: jsPDF, p: Box, min: number, max: number, span: number) {
  doc.setDrawColor(235, 238, 244);
  doc.setLineWidth(0.5);
  doc.setFontSize(6.5);
  doc.setTextColor(130);
  for (let i = 0; i <= 4; i++) {
    const y = p.y + (p.h * i) / 4;
    doc.line(p.x, y, p.x + p.w, y);
    const v = max - (span * i) / 4;
    doc.text(compacto(v), p.x - 4, y + 2, { align: "right" });
  }
  const zeroY = p.y + ((max - 0) / span) * p.h;
  doc.setDrawColor(190);
  doc.line(p.x, zeroY, p.x + p.w, zeroY);
  doc.setTextColor(0);
  return zeroY;
}

function rotulosX(doc: jsPDF, p: Box, labels: string[]) {
  doc.setFontSize(7);
  doc.setTextColor(110);
  const step = p.w / labels.length;
  labels.forEach((l, i) => {
    doc.text(String(l), p.x + step * (i + 0.5), p.y + p.h + 14, { align: "center" });
  });
  doc.setTextColor(0);
}

/** Barras agrupadas + linha opcional em eixo próprio. */
function graficoBarras(
  doc: jsPDF,
  b: Box,
  titulo: string,
  labels: string[],
  series: { nome: string; cor: [number, number, number]; valores: number[] }[],
  linha?: { nome: string; cor: [number, number, number]; valores: number[]; sufixo?: string },
) {
  molduraGrafico(doc, b, titulo);
  const p = plotArea(b);
  const todos = series.flatMap((s) => s.valores);
  const { max, min, span } = escala(todos);
  const zeroY = eixos(doc, p, min, max, span);
  const step = p.w / labels.length;
  const gw = step * 0.62;
  const bw = gw / series.length;
  series.forEach((s, si) => {
    doc.setFillColor(...s.cor);
    s.valores.forEach((v, i) => {
      const h = (Math.abs(v) / span) * p.h;
      const x = p.x + step * i + (step - gw) / 2 + bw * si;
      const y = v >= 0 ? zeroY - h : zeroY;
      doc.rect(x, y, bw - 1.5, Math.max(h, 0.5), "F");
    });
  });
  if (linha) {
    const l = escala(linha.valores);
    doc.setDrawColor(...linha.cor);
    doc.setLineWidth(1.4);
    const pts = linha.valores.map((v, i) => ({
      x: p.x + step * (i + 0.5),
      y: p.y + p.h - ((v - l.min) / (l.span || 1)) * p.h,
    }));
    pts.forEach((pt, i) => i > 0 && doc.line(pts[i - 1].x, pts[i - 1].y, pt.x, pt.y));
    doc.setFillColor(...linha.cor);
    pts.forEach((pt) => doc.circle(pt.x, pt.y, 2, "F"));
  }
  rotulosX(doc, p, labels);
  // legenda
  let lx = b.x + 12;
  const ly = b.y + b.h - 10;
  doc.setFontSize(7);
  [...series, ...(linha ? [{ nome: linha.nome, cor: linha.cor }] : [])].forEach((s) => {
    doc.setFillColor(...s.cor);
    doc.rect(lx, ly - 5, 7, 7, "F");
    doc.setTextColor(80);
    doc.text(s.nome, lx + 10, ly + 1);
    lx += doc.getTextWidth(s.nome) + 26;
  });
  doc.setTextColor(0);
  doc.setLineWidth(1);
}

/** Área simples (linha preenchida). */
function graficoArea(
  doc: jsPDF,
  b: Box,
  titulo: string,
  labels: string[],
  valores: number[],
  cor: [number, number, number],
) {
  molduraGrafico(doc, b, titulo);
  const p = plotArea(b);
  const { max, min, span } = escala(valores);
  const zeroY = eixos(doc, p, min, max, span);
  const step = p.w / labels.length;
  const pts = valores.map((v, i) => ({
    x: p.x + step * (i + 0.5),
    y: p.y + ((max - v) / span) * p.h,
  }));
  doc.setFillColor(cor[0], cor[1], cor[2]);
  doc.setGState(new GState({ opacity: 0.18 }));
  pts.forEach((pt, i) => {
    if (i === 0) return;
    const a = pts[i - 1];
    doc.triangle(a.x, a.y, pt.x, pt.y, a.x, zeroY, "F");
    doc.triangle(pt.x, pt.y, pt.x, zeroY, a.x, zeroY, "F");
  });
  doc.setGState(new GState({ opacity: 1 }));
  doc.setDrawColor(...cor);
  doc.setLineWidth(1.6);
  pts.forEach((pt, i) => i > 0 && doc.line(pts[i - 1].x, pts[i - 1].y, pt.x, pt.y));
  doc.setFillColor(...cor);
  pts.forEach((pt) => doc.circle(pt.x, pt.y, 2, "F"));
  rotulosX(doc, p, labels);
  doc.setLineWidth(1);
}

/** Waterfall de valuation. */
function graficoPonte(
  doc: jsPDF,
  b: Box,
  titulo: string,
  passos: { nome: string; valor: number }[],
  totalNome: string,
) {
  molduraGrafico(doc, b, titulo);
  const p = plotArea(b);
  let acc = 0;
  const barras = passos.map((s) => {
    const base = s.valor >= 0 ? acc : acc + s.valor;
    acc += s.valor;
    return { nome: s.nome, base, alt: Math.abs(s.valor), pos: s.valor >= 0 };
  });
  barras.push({ nome: totalNome, base: 0, alt: Math.abs(acc), pos: acc >= 0 });
  const max = Math.max(...barras.map((x) => x.base + x.alt), 0) || 1;
  const zeroY = p.y + p.h;
  const step = p.w / barras.length;
  doc.setFontSize(6.5);
  barras.forEach((x, i) => {
    const h = (x.alt / max) * p.h;
    const y = zeroY - ((x.base + x.alt) / max) * p.h;
    const cor = i === barras.length - 1 ? NAVY : x.pos ? TEAL : CORAL;
    doc.setFillColor(...cor);
    doc.rect(p.x + step * i + step * 0.19, y, step * 0.62, Math.max(h, 0.5), "F");
    doc.setTextColor(90);
    doc.text(compacto(x.alt * (x.pos ? 1 : -1)), p.x + step * (i + 0.5), y - 4, { align: "center" });
  });
  doc.setDrawColor(235, 238, 244);
  doc.line(p.x, zeroY, p.x + p.w, zeroY);
  doc.setTextColor(0);
  rotulosX(doc, p, barras.map((x) => x.nome));
}

function kpiCards(
  doc: jsPDF,
  x: number,
  y: number,
  larguraTotal: number,
  itens: { t: string; v: string; s: string }[],
) {
  const cols = 4;
  const gap = 10;
  const cw = (larguraTotal - gap * (cols - 1)) / cols;
  const ch = 56;
  itens.forEach((k, i) => {
    const cx = x + (i % cols) * (cw + gap);
    const cy = y + Math.floor(i / cols) * (ch + gap);
    doc.setFillColor(247, 248, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, cy, cw, ch, 5, 5, "FD");
    doc.setFillColor(...NAVY);
    doc.rect(cx, cy + 6, 3, ch - 12, "F");
    doc.setFontSize(7.5);
    doc.setTextColor(110);
    doc.text(k.t, cx + 12, cy + 18, { maxWidth: cw - 20 });
    doc.setFontSize(13);
    doc.setTextColor(...NAVY);
    doc.text(k.v, cx + 12, cy + 37, { maxWidth: cw - 20 });
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text(k.s, cx + 12, cy + 49, { maxWidth: cw - 20 });
  });
  doc.setTextColor(0);
  return y + Math.ceil(itens.length / cols) * (ch + gap);
}

export function exportarPdf(
  empresa: EmpresaSimpl,
  cenario: Cenario,
  proj: Projecao,
  dcf: DcfResultado,
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 90, "F");
  doc.setTextColor(255);
  doc.setFontSize(20);
  doc.text("Relatório Executivo — Modelagem Simplificada", 40, 45);
  doc.setFontSize(11);
  doc.text(`${empresa.nome} · Cenário ${cenario.nome} · ${new Date().toLocaleString("pt-BR")}`, 40, 68);
  doc.setTextColor(0);

  const anos = proj.anual;
  const ultimo = anos[anos.length - 1];
  const primeiro = anos[0];
  const labels = anos.map((a) => a.rotulo);
  const cagr =
    anos.length > 1 && primeiro.receitaLiquida > 0
      ? Math.pow(ultimo.receitaLiquida / primeiro.receitaLiquida, 1 / (anos.length - 1)) - 1
      : 0;
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
  const margem = (a: number, b: number) => (b ? pct(a / b) : "—");

  const fim = kpiCards(doc, 40, 110, w - 80, [
    { t: "Receita líquida (último ano)", v: brl(ultimo?.receitaLiquida ?? 0), s: `CAGR ${pct(cagr)}` },
    {
      t: "EBITDA",
      v: brl(ultimo?.ebitda ?? 0),
      s: `Margem ${margem(ultimo?.ebitda ?? 0, ultimo?.receitaLiquida ?? 0)}`,
    },
    {
      t: "Lucro líquido",
      v: brl(ultimo?.lucroLiquido ?? 0),
      s: `Margem ${margem(ultimo?.lucroLiquido ?? 0, ultimo?.receitaLiquida ?? 0)}`,
    },
    { t: "Caixa final", v: brl(ultimo?.caixa ?? 0), s: `Dívida líq. ${brl(dcf.dividaLiquida)}` },
    { t: "WACC", v: pct(dcf.wacc), s: `Ke ${pct(dcf.ke)} · Kd ${pct(dcf.kdLiquido)}` },
    { t: "Enterprise Value", v: brl(dcf.enterpriseValue), s: `EV/EBITDA ${dcf.evEbitda.toFixed(1)}x` },
    { t: "Equity Value", v: brl(dcf.equityValue), s: `g perpetuidade ${pct(cenario.valuation.gPerp)}` },
    {
      t: "Horizonte",
      v: `${cenario.premissas.horizonteAnos} anos`,
      s: `${empresa.regime} · ${empresa.moeda ?? "BRL"}`,
    },
  ]);

  const gw = (w - 80 - 16) / 2;
  const gh = (h - fim - 60) / 2 - 8;
  graficoBarras(
    doc,
    { x: 40, y: fim + 6, w: gw, h: gh },
    "Receita, EBITDA e margem EBITDA",
    labels,
    [
      { nome: "Receita líquida", cor: PERI, valores: anos.map((a) => a.receitaLiquida) },
      { nome: "EBITDA", cor: TEAL, valores: anos.map((a) => a.ebitda) },
    ],
    {
      nome: "Margem EBITDA",
      cor: CORAL,
      valores: anos.map((a) => (a.receitaLiquida ? (a.ebitda / a.receitaLiquida) * 100 : 0)),
    },
  );
  graficoBarras(
    doc,
    { x: 40 + gw + 16, y: fim + 6, w: gw, h: gh },
    "Geração de caixa por ano",
    labels,
    [
      { nome: "Operacional", cor: NAVY, valores: anos.map((a) => a.fco) },
      { nome: "Investimento", cor: CORAL, valores: anos.map((a) => a.fci) },
      { nome: "Financiamento", cor: PERI, valores: anos.map((a) => a.fcf) },
    ],
    { nome: "Caixa final", cor: TEAL, valores: anos.map((a) => a.caixa) },
  );
  graficoArea(
    doc,
    { x: 40, y: fim + 6 + gh + 16, w: gw, h: gh },
    "Lucro líquido projetado",
    labels,
    anos.map((a) => a.lucroLiquido),
    NAVY,
  );
  graficoPonte(
    doc,
    { x: 40 + gw + 16, y: fim + 6 + gh + 16, w: gw, h: gh },
    "Ponte de valuation",
    [
      { nome: "VP explícito", valor: dcf.somaVp },
      { nome: "VP terminal", valor: dcf.vpTerminal },
      { nome: "(-) Dívida líq.", valor: -dcf.dividaLiquida },
    ],
    "Equity Value",
  );

  doc.addPage();
  doc.setFontSize(14);
  doc.setTextColor(...NAVY);
  doc.text("Resumo dos indicadores", 40, 40);
  doc.setTextColor(0);
  autoTable(doc, {
    startY: 60,
    head: [["Indicador", "Valor"]],
    body: [
      ["Receita líquida (último ano)", brl(ultimo?.receitaLiquida ?? 0)],
      ["CAGR da receita", pct(cagr)],
      ["EBITDA (último ano)", brl(ultimo?.ebitda ?? 0)],
      ["Margem EBITDA", margem(ultimo?.ebitda ?? 0, ultimo?.receitaLiquida ?? 0)],
      ["Lucro líquido (último ano)", brl(ultimo?.lucroLiquido ?? 0)],
      ["Margem líquida", margem(ultimo?.lucroLiquido ?? 0, ultimo?.receitaLiquida ?? 0)],
      ["Caixa final", brl(ultimo?.caixa ?? 0)],
      ["Dívida líquida", brl(dcf.dividaLiquida)],
      ["WACC", pct(dcf.wacc)],
      ["Enterprise Value", brl(dcf.enterpriseValue)],
      ["Equity Value", brl(dcf.equityValue)],
      ["EV/EBITDA implícito", `${dcf.evEbitda.toFixed(1)}x`],
    ],
    theme: "grid",
    headStyles: { fillColor: NAVY },
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
