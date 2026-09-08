/**
 * Dados derivados para a tela Dashboard do modelo (MF2).
 * Base dinâmica por período x produto + provas reais de integridade + exportações.
 */
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { LinhaMes, ResultadoProjecao } from "./engine";
import type { ModeloMF2 } from "./types";
import { fmtNum, fmtPctTable, safeDiv } from "@/lib/saga/formatters";

export interface LinhaBaseProduto {
  ano: number;
  mes: number; // 1..12 calendário
  rotulo: string; // mm/aaaa
  produtoId: string;
  produto: string;
  volume: number;
  receita: number;
  ticketMedio: number;
  ebitda: number; // rateado pela participação na receita
}

/** Base tipo "tabela dinâmica": um registro por período x produto. */
export function baseProdutos(m: ModeloMF2, p: ResultadoProjecao): LinhaBaseProduto[] {
  const linhas: LinhaBaseProduto[] = [];
  for (const mes of p.meses) {
    for (const prod of m.produtos) {
      const receita = mes.receitaPorProduto[prod.id] ?? 0;
      const volume = mes.volumePorProduto[prod.id] ?? 0;
      linhas.push({
        ano: mes.ano,
        mes: mes.mesCalendario,
        rotulo: mes.rotulo,
        produtoId: prod.id,
        produto: prod.nome || "Produto",
        volume,
        receita,
        ticketMedio: safeDiv(receita, volume),
        ebitda: mes.ebitda * safeDiv(receita, mes.receitaBruta),
      });
    }
  }
  return linhas;
}

export interface AgregadoProduto {
  produtoId: string;
  produto: string;
  volume: number;
  receita: number;
  ticketMedio: number;
  ebitda: number;
  margemEbitda: number;
  participacao: number;
}

export function agregarProdutos(base: LinhaBaseProduto[]): AgregadoProduto[] {
  const mapa = new Map<string, AgregadoProduto>();
  for (const l of base) {
    const a =
      mapa.get(l.produtoId) ??
      ({
        produtoId: l.produtoId,
        produto: l.produto,
        volume: 0,
        receita: 0,
        ticketMedio: 0,
        ebitda: 0,
        margemEbitda: 0,
        participacao: 0,
      } as AgregadoProduto);
    a.volume += l.volume;
    a.receita += l.receita;
    a.ebitda += l.ebitda;
    mapa.set(l.produtoId, a);
  }
  const lista = [...mapa.values()];
  const total = lista.reduce((s, a) => s + a.receita, 0);
  for (const a of lista) {
    a.ticketMedio = safeDiv(a.receita, a.volume);
    a.margemEbitda = safeDiv(a.ebitda, a.receita);
    a.participacao = safeDiv(a.receita, total);
  }
  return lista.sort((x, y) => y.receita - x.receita);
}

export interface ResumoAno {
  ano: number;
  receitaLiquida: number;
  ebitda: number;
  margemEbitda: number;
  lucroLiquido: number;
  margemLiquida: number;
  caixaFinal: number;
  dividaLiquida: number;
  dlEbitda: number;
}

export function resumoAno(meses: LinhaMes[], ano: number): ResumoAno | null {
  const ms = meses.filter((m) => m.ano === ano);
  if (!ms.length) return null;
  const soma = (f: (l: LinhaMes) => number) => ms.reduce((a, l) => a + f(l), 0);
  const ultimo = ms[ms.length - 1];
  const receitaLiquida = soma((l) => l.receitaLiquida);
  const ebitda = soma((l) => l.ebitda);
  const lucroLiquido = soma((l) => l.lucroLiquido);
  const dividaBruta = ultimo.dividaCurtoPrazo + ultimo.dividaLongoPrazo + ultimo.saldoRevolvente;
  const dividaLiquida = dividaBruta - ultimo.caixaFinal;
  return {
    ano,
    receitaLiquida,
    ebitda,
    margemEbitda: safeDiv(ebitda, receitaLiquida),
    lucroLiquido,
    margemLiquida: safeDiv(lucroLiquido, receitaLiquida),
    caixaFinal: ultimo.caixaFinal,
    dividaLiquida,
    dlEbitda: safeDiv(dividaLiquida, ebitda),
  };
}

export interface ProvaReal {
  chave: string;
  titulo: string;
  descricao: string;
  ok: boolean;
  detalhe: string;
}

const TOL = 0.5;

export function provasReais(m: ModeloMF2, p: ResultadoProjecao): ProvaReal[] {
  const pior = (f: (l: LinhaMes) => number) => {
    let alvo: LinhaMes | null = null;
    let max = 0;
    for (const l of p.meses) {
      const v = Math.abs(f(l));
      if (v > max) {
        max = v;
        alvo = l;
      }
    }
    return { max, mes: alvo?.rotulo ?? "—" };
  };

  const bal = pior((l) => l.balanceCheck);
  const cx = pior((l) => l.provaRealCaixa);
  const aloc = pior(
    (l) =>
      l.custoDasVendas -
      (l.custoPessoal + l.custosVariaveis + l.custosFixos) +
      (l.despesasOperacionais -
        (l.despesaPessoal + l.despesasFixasSga + l.despesasVariaveisSga + l.depreciacao)),
  );

  // Dívidas: saldo deve zerar no último mês do prazo contratado
  let dividaOk = true;
  let detalheDivida = "Todas as dívidas amortizadas no prazo contratado.";
  p.schedules.dividas.forEach((sched, i) => {
    const d = m.dividas[i];
    if (!d || !d.valorCaptacao) return;
    const inicio = sched.linhas.findIndex((l) => l.captacao > 0);
    if (inicio < 0) return;
    const fim = Math.min(inicio + (d.prazoMeses || 0) - 1, sched.linhas.length - 1);
    const saldo = sched.linhas[fim]?.saldoFinal ?? 0;
    if (Math.abs(saldo) > TOL && dividaOk) {
      dividaOk = false;
      detalheDivida = `${d.nome || `Dívida ${i + 1}`}: saldo de ${fmtNum(saldo, 0)} em ${sched.linhas[fim]?.rotulo} (fim do prazo).`;
    }
  });

  return [
    {
      chave: "balanco",
      titulo: "Balanço Patrimonial fecha",
      descricao: "Total do Ativo = Total do Passivo + PL em todos os 60 meses.",
      ok: bal.max <= TOL,
      detalhe: bal.max <= TOL ? "Diferença zero em todos os meses." : `Diferença de ${fmtNum(bal.max, 0)} em ${bal.mes}.`,
    },
    {
      chave: "caixa",
      titulo: "Fluxo de Caixa bate com o Balanço",
      descricao: "Saldo final da DFC igual ao caixa do Balanço.",
      ok: cx.max <= TOL,
      detalhe: cx.max <= TOL ? "Prova real conciliada mês a mês." : `Diferença de ${fmtNum(cx.max, 0)} em ${cx.mes}.`,
    },
    {
      chave: "alocacao",
      titulo: "Custos e despesas totalmente alocados",
      descricao: "Somatório das linhas de custo e despesa igual aos totais da DRE.",
      ok: aloc.max <= TOL,
      detalhe: aloc.max <= TOL ? "100% dos custos e despesas alocados." : `Diferença de ${fmtNum(aloc.max, 0)} em ${aloc.mes}.`,
    },
    {
      chave: "divida",
      titulo: "Dívida amortizada até zerar no prazo",
      descricao: "Cada captação encerra com saldo zero ao fim do prazo contratado.",
      ok: dividaOk,
      detalhe: detalheDivida,
    },
  ];
}

/* --------------------------- Exportações --------------------------- */

export function exportarDashboardExcel(
  modelo: ModeloMF2,
  p: ResultadoProjecao,
  base: LinhaBaseProduto[],
) {
  const wb = XLSX.utils.book_new();

  const resumo = [1, 2, 3, 4, 5]
    .map((a) => resumoAno(p.meses, a))
    .filter((r): r is ResumoAno => !!r)
    .map((r) => ({
      Ano: r.ano,
      "Receita líquida": r.receitaLiquida,
      EBITDA: r.ebitda,
      "Margem EBITDA": r.margemEbitda,
      "Lucro líquido": r.lucroLiquido,
      "Margem líquida": r.margemLiquida,
      "Caixa final": r.caixaFinal,
      "Dívida líquida": r.dividaLiquida,
      "Dív. líq./EBITDA": r.dlEbitda,
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), "Resumo anual");

  const mensal = p.meses.map((m) => ({
    Período: m.rotulo,
    Ano: m.ano,
    "Receita líquida": m.receitaLiquida,
    EBITDA: m.ebitda,
    "Lucro líquido": m.lucroLiquido,
    "Caixa final": m.caixaFinal,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(mensal), "Mensal");

  const baseSheet = base.map((l) => ({
    Período: l.rotulo,
    Ano: l.ano,
    Mês: l.mes,
    Produto: l.produto,
    Volume: l.volume,
    "Ticket médio": l.ticketMedio,
    Receita: l.receita,
    "EBITDA rateado": l.ebitda,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(baseSheet), "Base produtos");

  const provas = provasReais(modelo, p).map((pr) => ({
    Prova: pr.titulo,
    Situação: pr.ok ? "OK" : "Erro",
    Detalhe: pr.detalhe,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(provas), "Provas reais");

  XLSX.writeFile(wb, `Dashboard_${modelo.nomeEmpresa.replace(/\s+/g, "_")}.xlsx`);
}

export function exportarDashboardPdf(
  modelo: ModeloMF2,
  p: ResultadoProjecao,
  base: LinhaBaseProduto[],
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margem = 40;
  doc.setFontSize(16);
  doc.text(`Dashboard — ${modelo.nomeEmpresa}`, margem, 50);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    `Projeção de 60 meses · ${modelo.regimeTributario} · gerado em ${new Date().toLocaleString("pt-BR")}`,
    margem,
    66,
  );
  doc.setTextColor(0);

  const resumo = [1, 2, 3, 4, 5]
    .map((a) => resumoAno(p.meses, a))
    .filter((r): r is ResumoAno => !!r);

  autoTable(doc, {
    startY: 84,
    head: [["Ano", "Receita líq.", "EBITDA", "Mg. EBITDA", "Lucro líq.", "Mg. líq.", "Caixa", "DL/EBITDA"]],
    body: resumo.map((r) => [
      `Ano ${r.ano}`,
      fmtNum(r.receitaLiquida, 0),
      fmtNum(r.ebitda, 0),
      fmtPctTable(r.margemEbitda),
      fmtNum(r.lucroLiquido, 0),
      fmtPctTable(r.margemLiquida),
      fmtNum(r.caixaFinal, 0),
      fmtNum(r.dlEbitda, 1),
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [42, 53, 102] },
  });

  const agregados = agregarProdutos(base);
  autoTable(doc, {
    head: [["Produto", "Volume", "Ticket médio", "Receita", "EBITDA", "Mg. EBITDA", "Part. %"]],
    body: agregados.map((a) => [
      a.produto,
      fmtNum(a.volume, 0),
      fmtNum(a.ticketMedio, 2),
      fmtNum(a.receita, 0),
      fmtNum(a.ebitda, 0),
      fmtPctTable(a.margemEbitda),
      fmtPctTable(a.participacao),
    ]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [42, 53, 102] },
  });

  autoTable(doc, {
    head: [["Prova real do modelo", "Situação", "Detalhe"]],
    body: provasReais(modelo, p).map((pr) => [pr.titulo, pr.ok ? "OK" : "ERRO", pr.detalhe]),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [42, 53, 102] },
    columnStyles: { 2: { cellWidth: 230 } },
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(`Página ${i} de ${total}`, doc.internal.pageSize.getWidth() - margem, doc.internal.pageSize.getHeight() - 20, {
      align: "right",
    });
  }
  doc.save(`Dashboard_${modelo.nomeEmpresa.replace(/\s+/g, "_")}.pdf`);
}
