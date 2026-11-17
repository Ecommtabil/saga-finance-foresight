// Relatório A4 (retrato) da projeção da alíquota, para envio ao cliente.
// Só lê os resultados prontos de projetarAliquota/calcularEmpresa — nenhum cálculo do Simples é refeito aqui.
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ResultadoEmpresa, ResultadoMes } from "./calculo";
import { rotuloMes, type ResultadoProjecao } from "./projecao";
import { NOME_ANEXO, type AnexoId } from "./tabelas";
import type { EmpresaSimples } from "./store";
import { brl, pct2, pct4 } from "./formato";
import { COR_ANEXO } from "./cores";

type RGB = [number, number, number];
const NAVY: RGB = [15, 42, 68];
const GOLD: RGB = [201, 162, 39];
const CINZA: RGB = [91, 107, 127];
const TINTA: RGB = [30, 40, 55];
const BORDA: RGB = [226, 230, 236];
const PAPEL: RGB = [247, 248, 250];
const VERMELHO: RGB = [185, 28, 28];
const VERDE: RGB = [21, 128, 61];
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const limpar = (s: string) => s.replace(/\u00a0/g, " ").replace(/[−–—]/g, "-").replace(/×/g, "x").replace(/÷/g, "/").replace(/→/g, "->");
const pp = (v: number) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} p.p.`;
const faixaTxt = (f: number) => (f === 7 ? "acima do teto" : f > 0 ? `${f}ª faixa` : "-");

export interface DadosRelatorioProjecao {
  empresa: EmpresaSimples;
  projecao: ResultadoProjecao;
  anual: ResultadoEmpresa;
  /** Como a prévia foi informada: parcial até o dia X (extrapolada) ou mês inteiro. */
  previa: { parcial: boolean; dia: number; dias: number; digitado: number };
  responsavel?: string;
  observacao?: string;
}

/** Frases do resumo em linguagem simples, na ordem em que aparecem no relatório. */
export function resumoProjecao(d: DadosRelatorioProjecao): string[] {
  const p = d.projecao;
  const nomeC = rotuloMes(p.mesCorrente), nomeP = rotuloMes(p.mesProximo);
  const nomeU = p.mesUltimo !== null ? rotuloMes(p.mesUltimo) : null;
  const linhas: string[] = [];
  const base = d.previa.parcial
    ? `Com faturamento de ${brl(d.previa.digitado)} até o dia ${d.previa.dia} de ${nomeC}, estimamos ${brl(p.faturamentoCorrente)} para o mês inteiro (média diária).`
    : `Com a prévia de faturamento de ${brl(p.faturamentoCorrente)} em ${nomeC},`;
  linhas.push(d.previa.parcial
    ? `${base} Com isso, a receita dos últimos 12 meses (RBT12) usada para calcular ${nomeP} passa a ser ${brl(p.rbt12Proximo.valor)}.`
    : `${base} a receita dos últimos 12 meses (RBT12) usada para calcular ${nomeP} passa a ser ${brl(p.rbt12Proximo.valor)}.`);
  for (const x of p.anexos) {
    if (!x.proximo.calculado) continue;
    const pre = d.empresa.anexos.length > 1 ? `No Anexo ${x.anexo}, a` : "A";
    if (x.corrente.calculado) {
      const dif = x.proximo.ae - x.corrente.ae;
      const mov = Math.abs(dif) < 0.0000005 ? "deve se manter" : dif > 0 ? `deve subir ${pp(dif).slice(1)}` : `deve cair ${pp(dif).slice(1)}`;
      linhas.push(`${pre} alíquota efetiva ${mov}: de ${pct4(x.corrente.ae)} em ${nomeC} para ${pct4(x.proximo.ae)} em ${nomeP}.`);
    } else {
      linhas.push(`${pre} alíquota efetiva projetada para ${nomeP} é de ${pct4(x.proximo.ae)}.`);
    }
  }
  if (p.faixaProximo > 0 && p.faixaCorrente > 0) {
    linhas.push(p.faixaProximo === p.faixaCorrente
      ? `A empresa continua na ${faixaTxt(p.faixaProximo)} do Simples Nacional.`
      : `A empresa ${p.faixaProximo > p.faixaCorrente ? "sobe" : "desce"} da ${faixaTxt(p.faixaCorrente)} para a ${faixaTxt(p.faixaProximo)} em ${nomeP}.`);
  }
  if (p.limiteParaManterFaixa !== null && p.faixaProximo > p.faixaCorrente) {
    linhas.push(`Para ${nomeP} permanecer na ${faixaTxt(p.faixaCorrente)}, o faturamento de ${nomeC} precisaria ficar em até ${brl(p.limiteParaManterFaixa)}.`);
  } else if (p.folgaFaixa !== null) {
    linhas.push(`Ainda há ${brl(p.folgaFaixa)} de margem no RBT12 antes de passar para a ${faixaTxt(p.faixaProximo + 1)}.`);
  }
  if (p.faturamentoCorrente > 0) {
    linhas.push(nomeU && p.dasUltimo !== null
      ? `O DAS estimado de ${nomeC} é de ${brl(p.dasCorrenteEstimado)}, contra ${brl(p.dasUltimo)} apurados em ${nomeU}.`
      : `O DAS estimado de ${nomeC} é de ${brl(p.dasCorrenteEstimado)}.`);
  }
  return linhas.map(limpar);
}

export function gerarRelatorioProjecao(d: DadosRelatorioProjecao): Blob {
  const { empresa: e, projecao: p, anual } = d;
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const W = 210, H = 297, M = 14, larg = W - 2 * M;
  const nomeC = rotuloMes(p.mesCorrente), nomeP = rotuloMes(p.mesProximo);
  const nomeU = p.mesUltimo !== null ? rotuloMes(p.mesUltimo) : null;
  const emitido = new Date();
  const fim = H - 18;

  const topo = () => {
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 16, "F");
    doc.setFillColor(...GOLD); doc.rect(M, 5, 6, 6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...NAVY); doc.text("E", M + 3, 9.4, { align: "center" });
    doc.setFontSize(13); doc.setTextColor(...GOLD); doc.text("Ecommtabil", M + 8.5, 10.3);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    doc.text("Projeção da alíquota · Simples Nacional", W - M, 10.3, { align: "right" });
  };
  const titulo = (t: string, y: number) => {
    doc.setFillColor(...GOLD); doc.rect(M, y - 3.6, 1.2, 4.6, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...NAVY); doc.text(limpar(t), M + 3.5, y);
    return y + 4;
  };
  const novaPagina = () => { doc.addPage(); topo(); return 26; };
  const garantir = (y: number, h: number) => (y + h > fim ? novaPagina() : y);
  const finalY = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ---------- Página 1 ----------
  topo();
  let y = 29;
  doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.setTextColor(...NAVY);
  doc.text("Projeção da alíquota do Simples Nacional", M, y); y += 6;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...CINZA);
  doc.text(limpar(`Estimativa da alíquota de ${nomeP} a partir da prévia de faturamento de ${nomeC}`), M, y); y += 5;

  // Identificação
  doc.setDrawColor(...BORDA); doc.setFillColor(...PAPEL); doc.roundedRect(M, y, larg, 15, 1.5, 1.5, "FD");
  const info: Array<[string, string]> = [
    ["Empresa", e.razaoSocial || "-"], ["CNPJ", e.cnpj || "-"],
    ["Emitido em", emitido.toLocaleDateString("pt-BR")], ["Atividade", e.anexos.map((a) => NOME_ANEXO[a]).join(" / ")],
  ];
  info.forEach(([k, v], i) => {
    const cx = M + 4 + (i % 2) * (larg / 2), cy = y + 6 + Math.floor(i / 2) * 5.5;
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY); doc.text(`${k}:`, cx, cy);
    const lw = doc.getTextWidth(`${k}:`) + 1.5;
    doc.setFont("helvetica", "normal"); doc.setTextColor(...TINTA);
    doc.text(doc.splitTextToSize(limpar(v), larg / 2 - lw - 8)[0] as string, cx + lw, cy);
  });
  y += 19;

  // Destaque: alíquota projetada
  const princ = p.anexos[0];
  const hH = 30;
  doc.setFillColor(...NAVY); doc.roundedRect(M, y, larg, hH, 2, 2, "F");
  doc.setFillColor(...GOLD); doc.rect(M, y + 4, 1.5, hH - 8, "F");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8); doc.setTextColor(...GOLD);
  doc.text(limpar(`ALÍQUOTA EFETIVA PROJETADA PARA ${nomeP.toUpperCase()}${e.anexos.length > 1 && princ ? ` · ANEXO ${princ.anexo}` : ""}`), M + 6, y + 8);
  doc.setFontSize(26); doc.setTextColor(255, 255, 255);
  doc.text(princ?.proximo.calculado ? pct4(princ.proximo.ae) : "-", M + 6, y + 19);
  if (princ?.proximo.calculado && princ.corrente.calculado) {
    const dif = princ.proximo.ae - princ.corrente.ae;
    const igual = Math.abs(dif) < 0.0000005;
    const txt = limpar(igual ? `sem variação vs ${nomeC}` : `${pp(dif)} vs ${nomeC}`);
    doc.setFontSize(8.5); const tw = doc.getTextWidth(txt) + 6;
    doc.setFillColor(...(igual ? ([226, 230, 236] as RGB) : dif > 0 ? ([251, 229, 227] as RGB) : ([232, 245, 236] as RGB)));
    doc.roundedRect(M + 6, y + 22, tw, 5.5, 2.7, 2.7, "F");
    doc.setTextColor(...(igual ? CINZA : dif > 0 ? VERMELHO : VERDE)); doc.text(txt, M + 9, y + 25.8);
  }
  const lados: Array<[string, string]> = [
    [`RBT12 de ${nomeP}`, brl(p.rbt12Proximo.valor)],
    ["Faixa projetada", faixaTxt(p.faixaProximo)],
    [`DAS estimado de ${nomeC}`, p.faturamentoCorrente > 0 ? brl(p.dasCorrenteEstimado) : "-"],
  ];
  lados.forEach(([k, v], i) => {
    const cx = M + larg * 0.52, cy = y + 7.5 + i * 8;
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(200, 210, 222); doc.text(limpar(k), cx, cy);
    doc.setFont("helvetica", "bold"); doc.setFontSize(10.5); doc.setTextColor(255, 255, 255); doc.text(limpar(v), cx, cy + 4.3);
  });
  y += hH + 7;

  // Resumo
  y = titulo("Resumo", y) + 1.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(...TINTA);
  for (const frase of resumoProjecao(d)) {
    const ls = doc.splitTextToSize(frase, larg - 6) as string[];
    y = garantir(y, ls.length * 4.3);
    doc.setFillColor(...GOLD); doc.circle(M + 1.3, y - 1.1, 0.7, "F");
    doc.text(ls, M + 4.5, y); y += ls.length * 4.3 + 1;
  }
  y += 2;

  // Comparativo dos três meses
  y = titulo("Comparativo: último mês, mês corrente e próximo mês", garantir(y, 40)) + 1;
  const col = (r: ResultadoMes | null | undefined, f: (m: ResultadoMes) => string) => (r ? f(r) : "-");
  const deltaTxt = (de: ResultadoMes | null | undefined, para: ResultadoMes) => (de?.calculado && para.calculado ? pp(para.ae - de.ae) : "-");
  for (const x of p.anexos) {
    const body: string[][] = [
      ["Faturamento", col(x.ultimo, (m) => brl(m.receitaTotal)), `${brl(x.corrente.receitaTotal)}${d.previa.parcial ? "*" : ""}`, "-"],
      ["RBT12", col(x.ultimo, (m) => brl(m.rbt12)), brl(x.corrente.rbt12), brl(x.proximo.rbt12)],
      ["Faixa", col(x.ultimo, (m) => faixaTxt(m.faixa)), faixaTxt(x.corrente.faixa), faixaTxt(x.proximo.faixa)],
      ["Alíquota nominal", col(x.ultimo, (m) => (m.calculado ? pct2(m.aliqNominal) : "-")), x.corrente.calculado ? pct2(x.corrente.aliqNominal) : "-", x.proximo.calculado ? pct2(x.proximo.aliqNominal) : "-"],
      ["Parcela a deduzir", col(x.ultimo, (m) => (m.calculado ? brl(m.deducao) : "-")), x.corrente.calculado ? brl(x.corrente.deducao) : "-", x.proximo.calculado ? brl(x.proximo.deducao) : "-"],
      ["Alíquota efetiva", col(x.ultimo, (m) => (m.calculado ? pct4(m.ae) : "-")), x.corrente.calculado ? pct4(x.corrente.ae) : "-", x.proximo.calculado ? pct4(x.proximo.ae) : "-"],
      ["Variação da alíquota", "-", deltaTxt(x.ultimo, x.corrente), deltaTxt(x.corrente, x.proximo)],
      ["DAS", col(x.ultimo, (m) => brl(m.totalDas)), `${brl(x.corrente.totalDas)} (estimado)`, "a apurar"],
    ].map((l) => l.map(limpar));
    y = garantir(y, 64);
    if (e.anexos.length > 1) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...hex(COR_ANEXO[x.anexo]));
      doc.text(limpar(NOME_ANEXO[x.anexo]), M, y + 2); y += 3.5;
    }
    autoTable(doc, {
      startY: y,
      head: [["", limpar(`Último mês calculado\n${nomeU ?? "-"}`), limpar(`Mês corrente\n${nomeC}`), limpar(`Próximo mês (projeção)\n${nomeP}`)]],
      body,
      margin: { left: M, right: M, top: 24, bottom: 20 },
      styles: { fontSize: 8.3, cellPadding: 1.45, halign: "right", lineColor: BORDA, lineWidth: 0.1, textColor: TINTA },
      headStyles: { fillColor: NAVY, textColor: [255, 255, 255], halign: "center", fontStyle: "bold", valign: "middle" },
      columnStyles: { 0: { halign: "left", fontStyle: "bold", textColor: NAVY, cellWidth: 40 }, 3: { fillColor: [250, 245, 228] } },
      alternateRowStyles: { fillColor: [249, 250, 252] },
      didParseCell: (c) => {
        if (c.section === "head" && c.column.index === 3) { c.cell.styles.fillColor = GOLD; c.cell.styles.textColor = NAVY; }
        if (c.section === "body" && c.row.index === 6 && c.column.index > 0) {
          const t = String(c.cell.raw);
          if (t.startsWith("+")) c.cell.styles.textColor = VERMELHO;
          else if (t.startsWith("-") && t.length > 1) c.cell.styles.textColor = VERDE;
          c.cell.styles.fontStyle = "bold";
        }
        if (c.section === "body" && c.row.index === 5) c.cell.styles.fontStyle = "bold";
      },
      didDrawPage: () => topo(),
    });
    y = finalY() + 3;
  }
  if (d.previa.parcial) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(7.3); doc.setTextColor(...CINZA);
    doc.text(limpar(`* Estimativa do mês inteiro a partir de ${brl(d.previa.digitado)} apurados até o dia ${d.previa.dia} de ${d.previa.dias}.`), M, y + 1); y += 4;
  }
  y += 3;

  // Ponte do RBT12 + gráfico
  const bH = 56;
  y = garantir(y, bH);
  const wE = larg * 0.42, wD = larg - wE - 5;
  caixa(doc, M, y, wE, bH, `Como se chega ao RBT12 de ${nomeP}`);
  let yy = y + 12;
  const linhaP = (k: string, v: string, forte = false) => {
    doc.setFont("helvetica", forte ? "bold" : "normal"); doc.setFontSize(8.3); doc.setTextColor(...(forte ? NAVY : CINZA));
    const ls = doc.splitTextToSize(limpar(k), wE - 38) as string[];
    doc.text(ls, M + 3.5, yy);
    doc.setTextColor(...(forte ? NAVY : TINTA)); doc.text(limpar(v), M + wE - 3.5, yy, { align: "right" });
    yy += ls.length * 3.8 + 2.4;
  };
  if (p.ponte) {
    linhaP(`RBT12 de ${nomeC}`, brl(p.rbt12Corrente.valor));
    linhaP(`+ Faturamento de ${nomeC} (prévia)`, brl(p.ponte.entra));
    linhaP(`- Faturamento de ${rotuloMes(p.ponte.mesSai)} (sai da conta)`, `(${brl(p.ponte.sai)})`);
    doc.setDrawColor(...BORDA); doc.line(M + 3.5, yy - 2.6, M + wE - 3.5, yy - 2.6); yy += 1;
    linhaP(`= RBT12 de ${nomeP}`, brl(p.rbt12Proximo.valor), true);
  } else {
    linhaP(`RBT12 de ${nomeP}`, brl(p.rbt12Proximo.valor), true);
    const origem = p.rbt12Proximo.origem === "manual" ? "valor informado manualmente" : p.rbt12Proximo.origem === "proporcional" ? "proporcional ao início de atividade" : p.rbt12Proximo.origem === "primeiro-mes" ? "primeiro mês de atividade" : "sem atividade";
    linhaP(`Origem: ${origem}`, "");
  }
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
  const nota = doc.splitTextToSize(limpar(`A alíquota de cada mês usa a receita dos 12 meses anteriores. Por isso o faturamento de ${nomeC} já define a alíquota de ${nomeP}.`), wE - 7) as string[];
  doc.text(nota, M + 3.5, y + bH - 3 - (nota.length - 1) * 3.3);
  grafico(doc, d, M + wE + 5, y, wD, bH);
  y += bH + 7;

  // ---------- Histórico do ano ----------
  y = titulo(`Histórico de ${e.ano} e projeção`, garantir(y, 50)) + 1;
  const multi = e.anexos.length > 1;
  const head = [["Mês", "Faturamento", "RBT12", "Faixa", ...e.anexos.map((a) => (multi ? `Alíq. efetiva\nAnexo ${a}` : "Alíq. efetiva")), "DAS", "Situação"]];
  const body: string[][] = [];
  for (const s of p.serie) {
    const i = s.abs - e.ano * 12;
    if (s.tipo === "fechado") {
      const ms = e.anexos.map((a) => anual.anexos[a]?.meses[i]);
      const faixa = ms.find((m) => m)?.faixa ?? 0;
      body.push([rotuloMes(s.abs), brl(anual.consolidado.receitaMensal[i]), brl(anual.rbt12[i].valor), faixaTxt(faixa),
        ...ms.map((m) => (m?.calculado ? pct4(m.ae) : "-")), brl(anual.consolidado.dasMensal[i].total), "Fechado"]);
    } else if (s.tipo === "corrente") {
      body.push([rotuloMes(s.abs), brl(p.faturamentoCorrente), brl(p.rbt12Corrente.valor), faixaTxt(p.faixaCorrente),
        ...p.anexos.map((x) => (x.corrente.calculado ? pct4(x.corrente.ae) : "-")), brl(p.dasCorrenteEstimado), d.previa.parcial ? "Prévia parcial" : "Prévia"]);
    } else {
      body.push([rotuloMes(s.abs), "-", brl(p.rbt12Proximo.valor), faixaTxt(p.faixaProximo),
        ...p.anexos.map((x) => (x.proximo.calculado ? pct4(x.proximo.ae) : "-")), "-", "Projeção"]);
    }
  }
  autoTable(doc, {
    startY: y, head, body: body.map((l) => l.map(limpar)),
    margin: { left: M, right: M, top: 24, bottom: 20 },
    styles: { fontSize: 8, cellPadding: 1.5, halign: "right", lineColor: BORDA, lineWidth: 0.1, textColor: TINTA },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], halign: "center", fontStyle: "bold", valign: "middle" },
    columnStyles: { 0: { halign: "left", fontStyle: "bold" }, 3: { halign: "center" }, [head[0].length - 1]: { halign: "center" } },
    alternateRowStyles: { fillColor: [249, 250, 252] },
    didParseCell: (c) => {
      if (c.section !== "body") return;
      const sit = String((c.row.raw as string[])[head[0].length - 1]);
      if (sit === "Projeção") { c.cell.styles.fillColor = [250, 245, 228]; c.cell.styles.fontStyle = "bold"; c.cell.styles.textColor = NAVY; }
      else if (sit.startsWith("Prévia")) c.cell.styles.fillColor = [238, 242, 248];
    },
    didDrawPage: () => topo(),
  });
  y = finalY() + 8;

  // Observações do consultor
  const obs = (d.observacao ?? "").trim();
  if (obs) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    const ls = doc.splitTextToSize(limpar(obs), larg - 10) as string[];
    const oh = ls.length * 4.3 + 12;
    y = garantir(y, oh + 6);
    doc.setFillColor(250, 245, 228); doc.setDrawColor(...GOLD); doc.roundedRect(M, y, larg, oh, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...NAVY); doc.text("Observações do consultor", M + 5, y + 6.5);
    doc.setFont("helvetica", "normal"); doc.setTextColor(...TINTA); doc.text(ls, M + 5, y + 12);
    y += oh + 7;
  }

  // Premissas e notas
  const notas = [
    "Valores estimados com base nas informações disponíveis na data de emissão. O valor definitivo é apurado no PGDAS-D, após o fechamento do mês.",
    "Alíquota efetiva = (RBT12 x alíquota nominal - parcela a deduzir) / RBT12, conforme a tabela vigente do anexo.",
    d.previa.parcial ? `A prévia de ${nomeC} foi informada até o dia ${d.previa.dia} e projetada para o mês inteiro pela média diária.` : `A prévia de ${nomeC} foi informada para o mês inteiro.`,
    nomeU ? `O DAS estimado de ${nomeC} considera a mesma divisão por tipo de receita (ST, monofásico, retenções) de ${nomeU}.` : "",
    ...[...new Set(p.anexos.flatMap((x) => [...x.corrente.alertas, ...x.proximo.alertas]).map((a) => a.texto))].slice(0, 3),
  ].filter(Boolean).map(limpar);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.8);
  const altNotas = notas.reduce((s, n) => s + (doc.splitTextToSize(n, larg - 5) as string[]).length * 3.5 + 1, 0) + 8;
  y = titulo("Premissas e observações", garantir(y, Math.min(altNotas, 26))) + 1.5;
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.8); doc.setTextColor(...CINZA);
  for (const n of notas) {
    const ls = doc.splitTextToSize(n, larg - 5) as string[];
    y = garantir(y, ls.length * 3.5);
    doc.text("•", M + 1, y); doc.text(ls, M + 4.5, y); y += ls.length * 3.5 + 1;
  }

  // Assinatura
  const resp = (d.responsavel ?? "").trim();
  y = garantir(y + 6, 18);
  doc.setDrawColor(...CINZA); doc.setLineWidth(0.2); doc.line(M, y + 8, M + 75, y + 8);
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); doc.setTextColor(...NAVY);
  doc.text(limpar(resp || "Responsável técnico"), M, y + 12);
  doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(...CINZA);
  doc.text("Ecommtabil - Contabilidade e Consultoria", M, y + 15.5);

  // Rodapé
  const total = doc.getNumberOfPages();
  const geradoEm = emitido.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    doc.setDrawColor(...BORDA); doc.setLineWidth(0.2); doc.line(M, H - 13, W - M, H - 13);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.2); doc.setTextColor(...CINZA);
    const dir = limpar(`Gerado em ${geradoEm}  ·  Página ${pg} de ${total}`);
    doc.text(dir, W - M, H - 8.5, { align: "right" });
    const esq = doc.splitTextToSize(limpar(`Ecommtabil · ${e.razaoSocial || "Empresa"} · Projeção de ${nomeP}`), larg - doc.getTextWidth(dir) - 8)[0] as string;
    doc.text(esq, M, H - 8.5);
  }
  return doc.output("blob");
}

function caixa(doc: jsPDF, x: number, y: number, w: number, h: number, t: string) {
  doc.setDrawColor(...BORDA); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold"); doc.setFontSize(8.8); doc.setTextColor(...NAVY);
  doc.text(doc.splitTextToSize(limpar(t), w - 6)[0] as string, x + 3.5, y + 6);
}

/** Linha da alíquota efetiva mês a mês: meses fechados contínuos, mês corrente → projeção tracejado. */
function grafico(doc: jsPDF, d: DadosRelatorioProjecao, x: number, y: number, w: number, h: number) {
  const { empresa: e, projecao: p } = d;
  caixa(doc, x, y, w, h, "Alíquota efetiva mês a mês");
  const serie = p.serie;
  const px = x + 14, py = y + 11, pw = w - 19, ph = h - 25;
  const vals = serie.flatMap((s) => e.anexos.map((a) => s.ae[a]).filter((v): v is number => typeof v === "number"));
  if (!vals.length || serie.length < 1) {
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(...CINZA);
    doc.text("Sem alíquotas calculadas para exibir.", x + w / 2, y + h / 2, { align: "center" });
    return;
  }
  let min = Math.min(...vals), max = Math.max(...vals);
  const folga = Math.max((max - min) * 0.2, 0.002);
  min = Math.max(0, min - folga); max += folga;
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.2);
  for (let i = 0; i <= 4; i++) {
    const yy = py + ph - (ph * i) / 4;
    doc.setDrawColor(238, 240, 244); doc.setLineWidth(0.2); doc.line(px, yy, px + pw, yy);
    doc.setTextColor(...CINZA); doc.text(pct2(min + ((max - min) * i) / 4), px - 1.5, yy + 1, { align: "right" });
  }
  const n = serie.length;
  const sx = (i: number) => (n === 1 ? px + pw / 2 : px + 3 + ((pw - 6) * i) / (n - 1));
  const sy = (v: number) => py + ph - ((v - min) / (max - min)) * ph;
  const passo = Math.max(1, Math.ceil(n / 7));
  serie.forEach((s, i) => {
    if ((n - 1 - i) % passo !== 0) return;
    doc.setTextColor(...(s.tipo === "projetado" ? NAVY : CINZA));
    doc.setFont("helvetica", s.tipo === "projetado" ? "bold" : "normal");
    doc.text(limpar(rotuloMes(s.abs)), sx(i), py + ph + 4, { align: "center" });
  });
  for (const a of e.anexos) {
    const cor = hex(COR_ANEXO[a]);
    let ant: [number, number, string] | null = null;
    serie.forEach((s, i) => {
      const v = s.ae[a];
      if (typeof v !== "number") { ant = null; return; }
      const pt: [number, number, string] = [sx(i), sy(v), s.tipo];
      if (ant) {
        doc.setDrawColor(...cor); doc.setLineWidth(0.7);
        if (s.tipo === "projetado") doc.setLineDashPattern([1.4, 1.1], 0);
        doc.line(ant[0], ant[1], pt[0], pt[1]);
        doc.setLineDashPattern([], 0);
      }
      ant = pt;
    });
    serie.forEach((s, i) => {
      const v = s.ae[a];
      if (typeof v !== "number") return;
      if (s.tipo === "projetado") {
        doc.setFillColor(...GOLD); doc.setDrawColor(...cor); doc.setLineWidth(0.4); doc.circle(sx(i), sy(v), 1.3, "FD");
        doc.setFont("helvetica", "bold"); doc.setFontSize(6.8); doc.setTextColor(...NAVY);
        doc.text(pct2(v), Math.min(sx(i), px + pw - 1), sy(v) - 2.4, { align: "right" });
      } else {
        doc.setFillColor(...cor); doc.circle(sx(i), sy(v), s.tipo === "corrente" ? 1 : 0.7, "F");
      }
    });
  }
  doc.setLineWidth(0.2);
  // Legenda
  let lx = px; const ly = y + h - 4;
  doc.setFont("helvetica", "normal"); doc.setFontSize(6.5);
  const itens: Array<[string, RGB, boolean]> = [...e.anexos.map((a) => [e.anexos.length > 1 ? `Anexo ${a}` : "Realizado", hex(COR_ANEXO[a]), false] as [string, RGB, boolean]), ["Projeção", GOLD, true]];
  for (const [t, c, proj] of itens) {
    if (proj) { doc.setFillColor(...GOLD); doc.circle(lx + 1.1, ly - 0.9, 1.1, "F"); }
    else { doc.setDrawColor(...c); doc.setLineWidth(0.7); doc.line(lx, ly - 0.9, lx + 4, ly - 0.9); doc.setLineWidth(0.2); }
    doc.setTextColor(...CINZA); doc.text(limpar(t), lx + (proj ? 3.5 : 5.5), ly);
    lx += doc.getTextWidth(t) + 10;
  }
}

export type { AnexoId };
