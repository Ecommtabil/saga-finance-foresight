import type { DadosImportados, Premissas } from "./types";
import { safeDiv } from "./formatters";

export function margens(d: DadosImportados) {
  const rl = d.dre.receitaLiquida;
  return {
    bruta: d.dre.lucroBruto.map((v, i) => safeDiv(v, rl[i])),
    ebitda: d.dre.ebitda.map((v, i) => safeDiv(v, rl[i])),
    operacional: d.dre.ebit.map((v, i) => safeDiv(v, rl[i])),
    liquida: d.dre.lucroLiquido.map((v, i) => safeDiv(v, rl[i])),
  };
}

export function indicadoresLiquidez(d: DadosImportados) {
  if (!d.balanco) return null;
  const b = d.balanco;
  return {
    corrente: b.ativoCirculante.map((v, i) => safeDiv(v, b.passivoCirculante[i])),
    seca: b.ativoCirculante.map((v, i) =>
      safeDiv(v - b.estoques[i], b.passivoCirculante[i]),
    ),
    imediata: b.caixa.map((v, i) => safeDiv(v, b.passivoCirculante[i])),
  };
}

export function indicadoresEndividamento(d: DadosImportados) {
  if (!d.balanco) return null;
  const b = d.balanco;
  const dividaTot = b.emprestimosCP.map((v, i) => v + b.emprestimosLP[i]);
  return {
    dividaSobrePL: dividaTot.map((v, i) => safeDiv(v, b.patrimonioLiquido[i])),
    dividaSobreAtivo: dividaTot.map((v, i) => safeDiv(v, b.ativoTotal[i])),
    coberturaJuros: d.dre.ebit.map((v, i) =>
      safeDiv(v, Math.abs(d.dre.resultadoFinanceiro[i])),
    ),
  };
}

export function indicadoresRentabilidade(d: DadosImportados) {
  const b = d.balanco;
  return {
    roe: d.dre.lucroLiquido.map((v, i) => safeDiv(v, b?.patrimonioLiquido[i] ?? 0)),
    roa: d.dre.lucroLiquido.map((v, i) => safeDiv(v, b?.ativoTotal[i] ?? 0)),
    roic: d.dre.ebit.map((v, i) =>
      safeDiv(
        v * (1 - d.premissas.aliquotaIR),
        (b?.patrimonioLiquido[i] ?? 0) +
          (b?.emprestimosCP[i] ?? 0) +
          (b?.emprestimosLP[i] ?? 0),
      ),
    ),
  };
}

export function cicloCaixa(d: DadosImportados) {
  if (!d.balanco) return null;
  const b = d.balanco;
  const pmr = b.contasReceber.map((v, i) => safeDiv(v * 365, d.dre.receitaLiquida[i]));
  const pme = b.estoques.map((v, i) => safeDiv(v * 365, Math.abs(d.dre.cmv[i])));
  const pmp = b.fornecedores.map((v, i) => safeDiv(v * 365, Math.abs(d.dre.cmv[i])));
  return {
    pmr,
    pme,
    pmp,
    cicloOperacional: pmr.map((v, i) => v + pme[i]),
    cicloFinanceiro: pmr.map((v, i) => v + pme[i] - pmp[i]),
  };
}

export function crescimento(d: DadosImportados) {
  const receita = d.dre.receitaLiquida;
  const lucro = d.dre.lucroLiquido;
  const yoy = (arr: number[]) =>
    arr.map((v, i) => (i === 0 ? 0 : safeDiv(v - arr[i - 1], Math.abs(arr[i - 1]))));
  const cagr = (arr: number[]) => {
    const first = arr[0];
    const last = arr[arr.length - 1];
    if (!first || first * last <= 0) return 0;
    return Math.pow(last / first, 1 / (arr.length - 1)) - 1;
  };
  return {
    receitaYoY: yoy(receita),
    lucroYoY: yoy(lucro),
    cagrReceita: cagr(receita),
    cagrLucro: cagr(lucro),
  };
}

export function fluxoCaixaDireto(d: DadosImportados) {
  const rl = d.dre.receitaLiquida;
  const recebimentos = rl.map((v) => v * 0.98);
  const pagamentos = d.dre.cmv.map((v, i) => v + d.dre.despOperacionais[i]);
  const impostos = d.dre.impostos;
  const caixaOp = recebimentos.map((v, i) => v + pagamentos[i] + impostos[i]);
  const caixaInv = d.dre.depreciacao.map((v) => v * 1.5);
  const caixaFin = d.dre.resultadoFinanceiro;
  const variacao = caixaOp.map((v, i) => v + caixaInv[i] + caixaFin[i]);
  return { recebimentos, pagamentos, impostos, caixaOp, caixaInv, caixaFin, variacao };
}

export function fluxoCaixaIndireto(d: DadosImportados) {
  const ll = d.dre.lucroLiquido;
  const depr = d.dre.depreciacao.map((v) => Math.abs(v));
  const caixaOp = ll.map((v, i) => v + depr[i]);
  const caixaInv = d.dre.depreciacao.map((v) => v * 1.5);
  const caixaFin = d.dre.resultadoFinanceiro;
  const variacao = caixaOp.map((v, i) => v + caixaInv[i] + caixaFin[i]);
  return { lucroLiquido: ll, depreciacao: depr, caixaOp, caixaInv, caixaFin, variacao };
}

export function calcularWACC(p: Premissas): number {
  const ke = p.rf + p.beta * p.erp;
  const kd = p.custoDivida * (1 - p.aliquotaIR);
  const total = p.dividaTotal + p.equityMercado;
  if (!total) return ke;
  return (p.equityMercado / total) * ke + (p.dividaTotal / total) * kd;
}

export function projetarFCFF(d: DadosImportados, crescimento: number, anos = 5) {
  const anoBase = d.anos[d.anos.length - 1];
  const ebitBase = d.dre.ebit[d.dre.ebit.length - 1];
  const deprBase = Math.abs(d.dre.depreciacao[d.dre.depreciacao.length - 1]);
  const rlBase = d.dre.receitaLiquida[d.dre.receitaLiquida.length - 1];
  const margem = safeDiv(ebitBase, rlBase);
  const t = d.premissas.aliquotaIR;
  const fcffList: number[] = [];
  const anosList: number[] = [];
  let rl = rlBase;
  for (let i = 1; i <= anos; i++) {
    rl = rl * (1 + crescimento);
    const ebit = rl * margem;
    const depr = deprBase * Math.pow(1 + crescimento, i);
    const capex = depr * 1.2;
    const deltaCG = rl * 0.02;
    const fcff = ebit * (1 - t) + depr - capex - deltaCG;
    fcffList.push(fcff);
    anosList.push(anoBase + i);
  }
  return { anos: anosList, fcff: fcffList };
}

export function calcularValuation(
  d: DadosImportados,
  waccOverride?: number,
  gOverride?: number,
  crescOverride?: number,
  margemOverride?: number,
) {
  const p = d.premissas;
  const wacc = waccOverride ?? calcularWACC(p);
  const g = gOverride ?? p.crescimentoPerp;
  const cresc = crescOverride ?? p.crescimentoProj;
  let proj = projetarFCFF(d, cresc, 5);
  if (margemOverride !== undefined) {
    // recalcular FCFF com margem override
    const rlBase = d.dre.receitaLiquida[d.dre.receitaLiquida.length - 1];
    const deprBase = Math.abs(d.dre.depreciacao[d.dre.depreciacao.length - 1]);
    const t = d.premissas.aliquotaIR;
    const anoBase = d.anos[d.anos.length - 1];
    const fcff: number[] = [];
    const anosProj: number[] = [];
    let rl = rlBase;
    for (let i = 1; i <= 5; i++) {
      rl = rl * (1 + cresc);
      const ebit = rl * margemOverride;
      const depr = deprBase * Math.pow(1 + cresc, i);
      const capex = depr * 1.2;
      const deltaCG = rl * 0.02;
      fcff.push(ebit * (1 - t) + depr - capex - deltaCG);
      anosProj.push(anoBase + i);
    }
    proj = { anos: anosProj, fcff };
  }
  const vp = proj.fcff.map((v, i) => v / Math.pow(1 + wacc, i + 1));
  const vpSum = vp.reduce((a, b) => a + b, 0);
  const fcffFinal = proj.fcff[proj.fcff.length - 1];
  const vt = wacc > g ? (fcffFinal * (1 + g)) / (wacc - g) : 0;
  const vpVt = vt / Math.pow(1 + wacc, proj.anos.length);
  const ev = vpSum + vpVt;
  const caixa = d.balanco?.caixa[d.balanco.caixa.length - 1] ?? 0;
  const divida = p.dividaTotal;
  const equity = ev + caixa - divida;
  return { wacc, g, anos: proj.anos, fcff: proj.fcff, vp, vpSum, vt, vpVt, ev, caixa, divida, equity };
}

export function sensibilidade(d: DadosImportados) {
  const baseWacc = calcularWACC(d.premissas);
  const baseG = d.premissas.crescimentoPerp;
  const waccs = [-0.02, -0.01, 0, 0.01, 0.02].map((x) => baseWacc + x);
  const gs = [-0.01, -0.005, 0, 0.005, 0.01].map((x) => baseG + x);
  const matriz = waccs.map((w) => gs.map((g) => calcularValuation(d, w, g).equity));
  return { waccs, gs, matriz };
}

export function estatisticaDescritiva(arr: number[]) {
  const n = arr.length;
  if (!n) return { media: 0, desvio: 0, min: 0, max: 0 };
  const media = arr.reduce((a, b) => a + b, 0) / n;
  const variancia = arr.reduce((a, b) => a + (b - media) ** 2, 0) / n;
  return { media, desvio: Math.sqrt(variancia), min: Math.min(...arr), max: Math.max(...arr) };
}

export function regressaoLinear(y: number[]) {
  const n = y.length;
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((a, xi, i) => a + (xi - mx) * (y[i] - my), 0);
  const den = x.reduce((a, xi) => a + (xi - mx) ** 2, 0);
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const yPred = x.map((xi) => intercept + slope * xi);
  const ssRes = y.reduce((a, yi, i) => a + (yi - yPred[i]) ** 2, 0);
  const ssTot = y.reduce((a, yi) => a + (yi - my) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2, yPred };
}

export function correlacao(a: number[], b: number[]) {
  const n = a.length;
  if (n < 2) return 0;
  const ma = a.reduce((x, y) => x + y, 0) / n;
  const mb = b.reduce((x, y) => x + y, 0) / n;
  const num = a.reduce((s, v, i) => s + (v - ma) * (b[i] - mb), 0);
  const da = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0));
  const db = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0));
  return da && db ? num / (da * db) : 0;
}

export function volatilidade(arr: number[]) {
  const retornos: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i - 1]) retornos.push((arr[i] - arr[i - 1]) / Math.abs(arr[i - 1]));
  }
  return estatisticaDescritiva(retornos).desvio;
}