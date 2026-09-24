export type Serie4 = [number, number, number, number];

export interface PremissasSS {
  cagr: Serie4;
  ipca: Serie4;
  crescSga: Serie4;
  receitaBruta: number;
  impostos: number;
  cmv: number;
  sgaFixa: number;
  despVar: number;
  inadimplencia: number;
  pme: number;
  pmr: number;
  pmp: number;
  taxaAplicacao: number;
  capex: number;
  crescCapex: number;
  depreciacao: number;
  aporte: number;
  emprestimo: number;
  jurosEmp: number;
  prazoAmort: number;
  dividendos: number;
  ir: number;
  rf: number;
  beta: number;
  erp: number;
  pesoE: number;
  pesoD: number;
  g: number;
  investimentoInicial: number;
  tma: number;
}

export const PREMISSAS_PADRAO: PremissasSS = {
  cagr: [0.07, 0.07, 0.07, 0.07],
  ipca: [0.047, 0.04, 0.035, 0.03],
  crescSga: [0.01, 0.01, 0.01, 0.01],
  receitaBruta: 8_880_000,
  impostos: 0.16,
  cmv: 0.51,
  sgaFixa: 1_200_000,
  despVar: 0.03,
  inadimplencia: 0.005,
  pme: 60,
  pmr: 60,
  pmp: 30,
  taxaAplicacao: 0.08,
  capex: 400_000,
  crescCapex: 0.05,
  depreciacao: 0.1,
  aporte: 700_000,
  emprestimo: 300_000,
  jurosEmp: 0.12,
  prazoAmort: 3,
  dividendos: 0.2,
  ir: 0.24,
  rf: 0.105,
  beta: 0.9,
  erp: 0.06,
  pesoE: 0.7,
  pesoD: 0.3,
  g: 0.03,
  investimentoInicial: 1_000_000,
  tma: 0.15,
};

export type S5 = number[];
const arr = () => [0, 0, 0, 0, 0];

export function npv(rate: number, flows: number[]) {
  return flows.reduce((a, f, t) => a + f / (1 + rate) ** t, 0);
}

export function irr(flows: number[]): number | null {
  let lo = -0.99, hi = 10;
  const f = (r: number) => npv(r, flows);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

const div = (a: number, b: number) => (b ? a / b : 0);

export function calcular(p: PremissasSS) {
  const rb = arr(), imp = arr(), rl = arr(), cmv = arr(), lb = arr(), sga = arr(), dv = arr(),
    inad = arr(), ebitda = arr(), capex = arr(), dep = arr(), ebit = arr(), recFin = arr(),
    juros = arr(), lair = arr(), ir = arr(), ll = arr(), divid = arr();
  const ar = arr(), est = arr(), ap = arr(), imob = arr(), empSaldo = arr(), pl = arr(), caixa = arr(),
    ativo = arr(), passivoPl = arr();
  const fco = arr(), fci = arr(), fcf = arr(), varCaixa = arr(), amort = arr(), captacao = arr(), aporte = arr();
  const dAr = arr(), dEst = arr(), dAp = arr();

  let imobBruto = 0, depAcum = 0, saldoEmp = 0, plAcum = 0, caixaAnt = 0;
  const amortAnual = p.prazoAmort > 0 ? p.emprestimo / p.prazoAmort : p.emprestimo;

  for (let i = 0; i < 5; i++) {
    rb[i] = i === 0 ? p.receitaBruta : rb[i - 1] * (1 + p.cagr[i - 1]);
    imp[i] = rb[i] * p.impostos;
    rl[i] = rb[i] - imp[i];
    cmv[i] = rl[i] * p.cmv;
    lb[i] = rl[i] - cmv[i];
    sga[i] = i === 0 ? p.sgaFixa : sga[i - 1] * (1 + p.ipca[i - 1]) * (1 + p.crescSga[i - 1]);
    dv[i] = rl[i] * p.despVar;
    inad[i] = rb[i] * p.inadimplencia;
    ebitda[i] = lb[i] - sga[i] - dv[i] - inad[i];

    capex[i] = p.capex * (1 + p.crescCapex) ** i;
    imobBruto += capex[i];
    dep[i] = Math.min(imobBruto * p.depreciacao, imobBruto - depAcum);
    depAcum += dep[i];
    ebit[i] = ebitda[i] - dep[i];

    captacao[i] = i === 0 ? p.emprestimo : 0;
    aporte[i] = i === 0 ? p.aporte : 0;
    const saldoIni = saldoEmp + captacao[i];
    juros[i] = saldoIni * p.jurosEmp;
    amort[i] = Math.min(amortAnual, saldoIni);
    saldoEmp = saldoIni - amort[i];
    empSaldo[i] = saldoEmp;

    recFin[i] = caixaAnt * p.taxaAplicacao;
    lair[i] = ebit[i] + recFin[i] - juros[i];
    ir[i] = Math.max(0, lair[i]) * p.ir;
    ll[i] = lair[i] - ir[i];
    divid[i] = Math.max(0, ll[i]) * p.dividendos;

    ar[i] = (rb[i] * p.pmr) / 360;
    est[i] = (cmv[i] * p.pme) / 360;
    ap[i] = (cmv[i] * p.pmp) / 360;
    dAr[i] = ar[i] - (i ? ar[i - 1] : 0);
    dEst[i] = est[i] - (i ? est[i - 1] : 0);
    dAp[i] = ap[i] - (i ? ap[i - 1] : 0);

    fco[i] = ll[i] + dep[i] - dAr[i] - dEst[i] + dAp[i];
    fci[i] = -capex[i];
    fcf[i] = aporte[i] + captacao[i] - amort[i] - divid[i];
    varCaixa[i] = fco[i] + fci[i] + fcf[i];
    caixa[i] = caixaAnt + varCaixa[i];
    caixaAnt = caixa[i];

    imob[i] = imobBruto - depAcum;
    plAcum += aporte[i] + ll[i] - divid[i];
    pl[i] = plAcum;
    ativo[i] = caixa[i] + ar[i] + est[i] + imob[i];
    passivoPl[i] = ap[i] + empSaldo[i] + pl[i];
  }

  // Valuation
  const ke = p.rf + p.beta * p.erp;
  const kd = p.jurosEmp * (1 - p.ir);
  const wacc = p.pesoE * ke + p.pesoD * kd;
  const ncg = ar.map((v, i) => v + est[i] - ap[i]);
  const dNcg = ncg.map((v, i) => v - (i ? ncg[i - 1] : 0));
  const nopat = ebit.map((v) => v * (1 - p.ir));
  const fcff = nopat.map((v, i) => v + dep[i] - capex[i] - dNcg[i]);
  const fator = fcff.map((_, i) => 1 / (1 + wacc) ** (i + 1));
  const vpFcff = fcff.map((v, i) => v * fator[i]);
  const tv = wacc > p.g ? (fcff[4] * (1 + p.g)) / (wacc - p.g) : 0;
  const vpTv = tv * fator[4];
  const firmValue = vpFcff.reduce((a, b) => a + b, 0) + vpTv;
  const dividaLiquida = empSaldo[0] - caixa[0];
  const equityValue = firmValue - dividaLiquida;

  // Viabilidade
  const fluxo = [-p.investimentoInicial, ...fcff];
  const vpl = npv(p.tma, fluxo);
  const tir = irr(fluxo);
  const il = div(vpl + p.investimentoInicial, p.investimentoInicial);
  let payback: number | null = null;
  let acum = fluxo[0];
  const acumulado = [acum];
  for (let t = 1; t < fluxo.length; t++) {
    const prev = acum;
    acum += fluxo[t];
    acumulado.push(acum);
    if (payback === null && prev < 0 && acum >= 0) payback = t - 1 + -prev / fluxo[t];
  }

  // Indicadores
  const ac = caixa.map((c, i) => c + ar[i] + est[i]);
  const passivoTotal = ap.map((v, i) => v + empSaldo[i]);
  const mc = rl.map((v, i) => v - cmv[i] - dv[i] - inad[i]);
  const mcPct = mc.map((v, i) => div(v, rl[i]));
  const ciclo = p.pme + p.pmr - p.pmp;
  const ind = {
    rb, rl,
    cmvPct: cmv.map((v, i) => div(v, rl[i])),
    lb, mcPct, ebitda,
    margemEbitda: ebitda.map((v, i) => div(v, rl[i])),
    ll,
    margemLiq: ll.map((v, i) => div(v, rl[i])),
    ac, pc: ap, pnc: empSaldo,
    liqGeral: ac.map((v, i) => div(v, ap[i] + empSaldo[i])),
    liqCorrente: ac.map((v, i) => div(v, ap[i])),
    liqSeca: ac.map((v, i) => div(v - est[i], ap[i])),
    pl,
    partTerceiros: passivoTotal.map((v, i) => div(v, pl[i])),
    endividamento: passivoTotal.map((v, i) => div(v, ativo[i])),
    composicao: ap.map((v, i) => div(v, passivoTotal[i])),
    imobPl: imob.map((v, i) => div(v, pl[i])),
    despFixas: sga,
    pe: sga.map((v, i) => div(v, mcPct[i])),
    roe: ll.map((v, i) => div(v, pl[i])),
    roa: ll.map((v, i) => div(v, ativo[i])),
    roic: nopat.map((v, i) => div(v, pl[i] + empSaldo[i])),
    geracaoCaixa: varCaixa,
    geracaoCaixaPct: varCaixa.map((v, i) => div(v, rl[i])),
    caixa,
    ciclo,
    giroCaixa: div(360, ciclo),
    ncg,
    ncgPct: ncg.map((v, i) => div(v, rb[i])),
  };

  return {
    dre: { rb, imp, rl, cmv, lb, sga, dv, inad, ebitda, dep, ebit, recFin, juros, lair, ir, ll, divid },
    bp: { caixa, ar, est, imob, ativo, ap, empSaldo, pl, passivoPl },
    fc: { ll, dep, dAr, dEst, dAp, fco, capex, fci, aporte, captacao, amort, divid, fcf, varCaixa, caixa },
    val: { ke, kd, wacc, nopat, dep, capex, dNcg, fcff, fator, vpFcff, tv, vpTv, firmValue, dividaLiquida, equityValue },
    via: { fluxo, acumulado, vpl, tir, il, payback },
    ind,
  };
}

export type ResultadoSS = ReturnType<typeof calcular>;
