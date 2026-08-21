import type { Cenario, EmpresaSimpl } from "./types";
import { aliquotaEfetivaSimples } from "./simples";

export interface LinhaMensal {
  mes: number;
  ano: number; // índice do ano (0-based)
  rotulo: string;
}

export interface ResultadoMes {
  receitaBruta: number;
  impostosVenda: number;
  detalheImpostos: Record<string, number>;
  receitaLiquida: number;
  custoPessoal: number;
  custoOpex: number;
  custos: number;
  lucroBruto: number;
  despPessoal: number;
  despOpex: number;
  despesas: number;
  ebitda: number;
  depreciacao: number;
  ebit: number;
  receitaFinanceira: number;
  despesaFinanceira: number;
  resultadoFinanceiro: number;
  lair: number;
  irpjCsll: number;
  lucroLiquido: number;
  // balanço
  caixa: number;
  contasReceber: number;
  estoques: number;
  adiantFornecedores: number;
  imobilizadoLiquido: number;
  ativoTotal: number;
  fornecedores: number;
  adiantClientes: number;
  tributosRecolher: number;
  obrigacoesTrabalhistas: number;
  dividaCP: number;
  dividaLP: number;
  rotativoSaldo: number;
  passivoTotal: number;
  capitalSocial: number;
  lucrosAcumulados: number;
  patrimonioLiquido: number;
  balanceCheck: number;
  // fluxo de caixa
  fco: number;
  fci: number;
  fcf: number;
  caixaInicial: number;
  variacaoNcg: number;
  ncg: number;
  capex: number;
  captacoes: number;
  amortizacoes: number;
  jurosPagos: number;
  aportes: number;
  unidades: number;
  aliquotaSimples: number;
  rbt12: number;
  mes: number;
  ano: number;
  rotulo: string;
}

export type ProjecaoAnual = ResultadoMes;

export interface Projecao {
  meses: LinhaMensal[];
  mensal: ResultadoMes[];
  anual: ProjecaoAnual[];
  volumePorProduto: Record<string, number[]>;
  receitaPorProduto: Record<string, number[]>;
  alertas: string[];
}

const MESES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function pmt(taxa: number, n: number, pv: number) {
  if (n <= 0) return 0;
  if (taxa === 0) return pv / n;
  return (pv * taxa) / (1 - Math.pow(1 + taxa, -n));
}

function zeros(n: number) {
  return Array.from({ length: n }, () => 0);
}

export function projetar(empresa: EmpresaSimpl, cenario: Cenario): Projecao {
  const { premissas: p } = cenario;
  const N = Math.max(1, p.horizonteAnos) * 12;
  const alertas: string[] = [];

  const meses: LinhaMensal[] = Array.from({ length: N }, (_, m) => {
    const abs = p.mesInicio - 1 + m;
    const ano = p.anoInicio + Math.floor(abs / 12);
    return { mes: m, ano: Math.floor(m / 12), rotulo: `${MESES_ABREV[abs % 12]}/${String(ano).slice(2)}` };
  });

  const ipcaMes = (anoIdx: number) => Math.pow(1 + (p.ipca[anoIdx] ?? 0), 1 / 12) - 1;
  const selicMes = (anoIdx: number) => Math.pow(1 + (p.selic[anoIdx] ?? 0), 1 / 12) - 1;

  // ---------- Receitas ----------
  const volumePorProduto: Record<string, number[]> = {};
  const receitaPorProduto: Record<string, number[]> = {};
  const precoPorProduto: Record<string, number[]> = {};

  for (const prod of cenario.produtos) {
    const vol = zeros(N);
    const pre = zeros(N);
    const rec = zeros(N);
    for (let m = 0; m < N; m++) {
      const mi = m % 12;
      if (m < 12) {
        vol[m] = prod.volumeMes * (prod.sazonalidade[mi] ?? 1);
        pre[m] = prod.preco;
      } else {
        vol[m] = vol[m - 12] * (1 + prod.crescVolume);
        pre[m] = pre[m - 12] * (1 + prod.crescPreco);
      }
      rec[m] = vol[m] * pre[m];
    }
    volumePorProduto[prod.id] = vol;
    precoPorProduto[prod.id] = pre;
    receitaPorProduto[prod.id] = rec;
  }

  const receitaBruta = zeros(N);
  const unidades = zeros(N);
  for (const prod of cenario.produtos) {
    for (let m = 0; m < N; m++) {
      receitaBruta[m] += receitaPorProduto[prod.id][m];
      unidades[m] += volumePorProduto[prod.id][m];
    }
  }

  // RBT12 e alíquota do Simples
  const rbt12 = zeros(N);
  for (let m = 0; m < N; m++) {
    let soma = 0;
    for (let k = Math.max(0, m - 11); k <= m; k++) soma += receitaBruta[k];
    const mesesConsiderados = m + 1;
    // anualiza os primeiros meses (regra de início de atividade)
    rbt12[m] = mesesConsiderados < 12 ? (soma / mesesConsiderados) * 12 : soma;
  }

  // Impostos sobre venda
  const impostosVenda = zeros(N);
  const detalheImpostos: Record<string, number>[] = Array.from({ length: N }, () => ({}));
  const aliqSimples = zeros(N);

  for (let m = 0; m < N; m++) {
    if (empresa.regime === "simples") {
      const aliq = aliquotaEfetivaSimples(rbt12[m], empresa.anexoSimples);
      aliqSimples[m] = aliq;
      const das = receitaBruta[m] * aliq;
      impostosVenda[m] = das;
      detalheImpostos[m]["DAS (Simples Nacional)"] = das;
    } else {
      for (const prod of cenario.produtos) {
        const r = receitaPorProduto[prod.id][m];
        const add = (nome: string, v: number) => {
          if (!v) return;
          detalheImpostos[m][nome] = (detalheImpostos[m][nome] ?? 0) + v;
          impostosVenda[m] += v;
        };
        if (p.reformaTributaria) {
          add("IBS", r * prod.ibs);
          add("CBS", r * prod.cbs);
          add("IPI", r * prod.ipi);
        } else {
          add("ISS", r * prod.iss);
          add("ICMS", r * prod.icms);
          add("PIS/COFINS", r * prod.pisCofins);
          add("IPI", r * prod.ipi);
        }
      }
    }
  }

  // ---------- Pessoal ----------
  const custoPessoal = zeros(N);
  const despPessoal = zeros(N);
  for (const c of cenario.cargos) {
    const qtd = zeros(N);
    const sal = zeros(N);
    for (let m = 0; m < N; m++) {
      const anoIdx = Math.floor(m / 12);
      if (m < 12) {
        qtd[m] = c.qtd;
        sal[m] = c.salario;
      } else {
        qtd[m] = qtd[m - 12] * (1 + c.crescHeadcount);
        sal[m] = sal[m - 12] * (1 + (p.ipca[anoIdx] ?? 0));
      }
      const folha = qtd[m] * sal[m] * (1 + c.encargos);
      const beneficios = qtd[m] * c.beneficios;
      const decimoTerceiro = folha / 12;
      const ferias = (folha * (4 / 3)) / 12;
      const total = folha + beneficios + decimoTerceiro + ferias;
      if (c.alocacao === "custo") custoPessoal[m] += total;
      else despPessoal[m] += total;
    }
  }

  // ---------- OPEX ----------
  const custoOpex = zeros(N);
  const despOpex = zeros(N);
  for (const o of cenario.opex) {
    for (let m = 0; m < N; m++) {
      const anoIdx = Math.floor(m / 12);
      let v = 0;
      if (o.tipo === "fixo") {
        const correcao = Array.from({ length: anoIdx }, (_, i) => 1 + (p.ipca[i] ?? 0)).reduce(
          (a, b) => a * b,
          1,
        );
        v = o.valor * correcao;
      } else if (o.baseTipo === "unidade") {
        const base = o.produtoId ? (volumePorProduto[o.produtoId]?.[m] ?? 0) : unidades[m];
        v = o.valor * base;
      } else {
        const base = o.produtoId ? (receitaPorProduto[o.produtoId]?.[m] ?? 0) : receitaBruta[m];
        v = o.valor * base;
      }
      v = v * (1 - (o.creditoTributario ?? 0));
      if (o.classificacao === "custo") custoOpex[m] += v;
      else despOpex[m] += v;
    }
  }

  // ---------- CAPEX / Depreciação ----------
  const capexMes = zeros(N);
  const depreciacao = zeros(N);
  const imobBruto = zeros(N);
  const deprAcum = zeros(N);
  for (const inv of cenario.capex) {
    if (inv.mes < N) capexMes[inv.mes] += inv.valor;
    const mensal = (inv.valor * inv.taxaAA) / 12;
    let acum = 0;
    for (let m = inv.mes; m < N; m++) {
      const d = Math.min(mensal, Math.max(0, inv.valor - acum));
      acum += d;
      depreciacao[m] += d;
    }
  }
  for (let m = 0; m < N; m++) {
    imobBruto[m] = (m > 0 ? imobBruto[m - 1] : 0) + capexMes[m];
    deprAcum[m] = (m > 0 ? deprAcum[m - 1] : 0) + depreciacao[m];
  }

  // ---------- Dívidas ----------
  const captacoes = zeros(N);
  const amortizacoes = zeros(N);
  const jurosDivida = zeros(N);
  const saldoDivida = zeros(N);
  const amortProx12 = zeros(N);

  for (const d of cenario.dividas) {
    if (d.valor <= 0 || d.prazoMeses <= 0) continue;
    const i = Math.pow(1 + d.jurosAA, 1 / 12) - 1;
    if (d.mes < N) captacoes[d.mes] += d.valor;
    let saldo = d.valor;
    const parcela = pmt(i, d.prazoMeses, d.valor);
    const amortSac = d.valor / d.prazoMeses;
    const amortList: number[] = [];
    for (let k = 0; k < d.prazoMeses; k++) {
      const m = d.mes + 1 + k;
      const juros = saldo * i;
      const amort = d.sistema === "price" ? Math.max(0, parcela - juros) : amortSac;
      const amortReal = Math.min(amort, saldo);
      saldo -= amortReal;
      amortList[m] = amortReal;
      if (m < N) {
        amortizacoes[m] += amortReal;
        jurosDivida[m] += juros;
      }
    }
    for (let m = 0; m < N; m++) {
      let s = d.valor;
      for (let k = 0; k <= m; k++) s -= amortList[k] ?? 0;
      if (m >= d.mes) saldoDivida[m] += Math.max(0, s);
      let prox = 0;
      for (let k = m + 1; k <= m + 12; k++) prox += amortList[k] ?? 0;
      amortProx12[m] += prox;
    }
  }

  const aportesMes = zeros(N);
  for (const a of cenario.aportes) if (a.mes < N) aportesMes[a.mes] += a.valor;

  // ---------- Capital de giro / DRE / Caixa (loop sequencial) ----------
  const cg = cenario.capitalGiro;
  const res: ResultadoMes[] = [];
  let caixaAnt = cenario.caixaInicial;
  let ncgAnt = 0;
  let lucrosAcum = 0;
  let capitalSocial = cenario.capitalInicial;
  let rotativoSaldo = 0;

  for (let m = 0; m < N; m++) {
    const anoIdx = Math.floor(m / 12);
    const rb = receitaBruta[m];
    const imp = impostosVenda[m];
    const rl = rb - imp;
    const custos = custoPessoal[m] + custoOpex[m];
    const lucroBruto = rl - custos;
    const despesas = despPessoal[m] + despOpex[m];
    const ebitda = lucroBruto - despesas;
    const ebit = ebitda - depreciacao[m];

    const diaria = (v: number) => v / 30;
    const contasReceber = diaria(rb) * cg.pmr;
    const estoques = diaria(custos) * cg.pme;
    const adiantForn = diaria(custos + despesas) * cg.adiantFornecedores;
    const fornecedores = diaria(custos + despesas) * cg.pmp;
    const adiantCli = diaria(rb) * cg.adiantClientes;
    const tributosRecolher = imp; // recolhido no mês seguinte
    const obrigacoesTrab = (custoPessoal[m] + despPessoal[m]) / 2;

    const ncg =
      contasReceber + estoques + adiantForn - fornecedores - adiantCli - tributosRecolher - obrigacoesTrab;
    const variacaoNcg = ncg - ncgAnt;

    // financeiro
    const jurosRotativo = rotativoSaldo * (Math.pow(1 + cenario.rotativo.jurosAA, 1 / 12) - 1);
    const receitaFinanceira = Math.max(0, caixaAnt) * selicMes(anoIdx);
    const despesaFinanceira = jurosDivida[m] + jurosRotativo;
    const resultadoFinanceiro = receitaFinanceira - despesaFinanceira;
    const lair = ebit + resultadoFinanceiro;

    let irpjCsll = 0;
    if (empresa.regime === "real") {
      irpjCsll = lair > 0 ? lair * 0.34 : 0;
    } else if (empresa.regime === "presumido") {
      const baseIR = rb * empresa.presumidoBaseIRPJ;
      const baseCS = rb * empresa.presumidoBaseCSLL;
      const adicional = Math.max(0, baseIR - 20000) * 0.1;
      irpjCsll = baseIR * 0.15 + adicional + baseCS * 0.09;
    }
    const lucroLiquido = lair - irpjCsll;

    const fco = lucroLiquido + depreciacao[m] - variacaoNcg;
    const fci = -capexMes[m];
    let fcf = captacoes[m] - amortizacoes[m] + aportesMes[m];

    let caixa = caixaAnt + fco + fci + fcf;
    let novoRotativo = 0;
    let amortRotativo = 0;
    if (cenario.rotativo.ativo) {
      const alvo = cenario.rotativo.caixaMinimo;
      if (caixa < alvo) {
        novoRotativo = Math.min(alvo - caixa, Math.max(0, cenario.rotativo.limite - rotativoSaldo));
        caixa += novoRotativo;
      } else if (rotativoSaldo > 0) {
        amortRotativo = Math.min(rotativoSaldo, caixa - alvo);
        caixa -= amortRotativo;
      }
      fcf += novoRotativo - amortRotativo;
      rotativoSaldo = rotativoSaldo + novoRotativo - amortRotativo;
    } else if (caixa < 0) {
      alertas.push(`Caixa negativo em ${meses[m].rotulo}. Considere ativar o crédito rotativo.`);
    }

    capitalSocial += aportesMes[m];
    lucrosAcum += lucroLiquido;

    const imobilizadoLiquido = imobBruto[m] - deprAcum[m];
    const dividaTotal = saldoDivida[m];
    const dividaCP = Math.min(dividaTotal, amortProx12[m]);
    const dividaLP = Math.max(0, dividaTotal - dividaCP);

    const ativoTotal = caixa + contasReceber + estoques + adiantForn + imobilizadoLiquido;
    const passivoTotal =
      fornecedores + adiantCli + tributosRecolher + obrigacoesTrab + dividaCP + dividaLP + rotativoSaldo;
    const patrimonioLiquido = capitalSocial + lucrosAcum;

    res.push({
      receitaBruta: rb,
      impostosVenda: imp,
      detalheImpostos: detalheImpostos[m],
      receitaLiquida: rl,
      custoPessoal: custoPessoal[m],
      custoOpex: custoOpex[m],
      custos,
      lucroBruto,
      despPessoal: despPessoal[m],
      despOpex: despOpex[m],
      despesas,
      ebitda,
      depreciacao: depreciacao[m],
      ebit,
      receitaFinanceira,
      despesaFinanceira,
      resultadoFinanceiro,
      lair,
      irpjCsll,
      lucroLiquido,
      caixa,
      contasReceber,
      estoques,
      adiantFornecedores: adiantForn,
      imobilizadoLiquido,
      ativoTotal,
      fornecedores,
      adiantClientes: adiantCli,
      tributosRecolher,
      obrigacoesTrabalhistas: obrigacoesTrab,
      dividaCP,
      dividaLP,
      rotativoSaldo,
      passivoTotal,
      capitalSocial,
      lucrosAcumulados: lucrosAcum,
      patrimonioLiquido,
      balanceCheck: ativoTotal - (passivoTotal + patrimonioLiquido),
      fco,
      fci,
      fcf,
      caixaInicial: caixaAnt,
      variacaoNcg,
      ncg,
      capex: capexMes[m],
      captacoes: captacoes[m] + novoRotativo,
      amortizacoes: amortizacoes[m] + amortRotativo,
      jurosPagos: despesaFinanceira,
      aportes: aportesMes[m],
      unidades: unidades[m],
      aliquotaSimples: aliqSimples[m],
      rbt12: rbt12[m],
      mes: m,
      ano: anoIdx,
      rotulo: meses[m].rotulo,
    } as unknown as ResultadoMes);

    caixaAnt = caixa;
    ncgAnt = ncg;
  }

  // ---------- Consolidação anual ----------
  const fluxos: (keyof ResultadoMes)[] = [
    "receitaBruta", "impostosVenda", "receitaLiquida", "custoPessoal", "custoOpex", "custos",
    "lucroBruto", "despPessoal", "despOpex", "despesas", "ebitda", "depreciacao", "ebit",
    "receitaFinanceira", "despesaFinanceira", "resultadoFinanceiro", "lair", "irpjCsll",
    "lucroLiquido", "fco", "fci", "fcf", "capex", "captacoes", "amortizacoes", "jurosPagos",
    "aportes", "unidades", "variacaoNcg",
  ];
  const saldos: (keyof ResultadoMes)[] = [
    "caixa", "contasReceber", "estoques", "adiantFornecedores", "imobilizadoLiquido", "ativoTotal",
    "fornecedores", "adiantClientes", "tributosRecolher", "obrigacoesTrabalhistas", "dividaCP",
    "dividaLP", "rotativoSaldo", "passivoTotal", "capitalSocial", "lucrosAcumulados",
    "patrimonioLiquido", "balanceCheck", "ncg", "aliquotaSimples", "rbt12",
  ];

  const anual: ProjecaoAnual[] = [];
  for (let a = 0; a < p.horizonteAnos; a++) {
    const doAno = res.filter((r) => r.ano === a);
    if (!doAno.length) continue;
    const acc = {} as ProjecaoAnual;
    for (const k of fluxos) (acc as any)[k] = doAno.reduce((s, r) => s + ((r as any)[k] ?? 0), 0);
    const ultimo = doAno[doAno.length - 1];
    for (const k of saldos) (acc as any)[k] = (ultimo as any)[k];
    acc.detalheImpostos = doAno.reduce<Record<string, number>>((o, r) => {
      for (const [k, v] of Object.entries(r.detalheImpostos)) o[k] = (o[k] ?? 0) + v;
      return o;
    }, {});
    acc.caixaInicial = doAno[0].caixaInicial;
    acc.ano = a;
    acc.mes = ultimo.mes;
    acc.rotulo = String(p.anoInicio + a);
    anual.push(acc);
  }

  const desbalanceado = res.find((r) => Math.abs(r.balanceCheck) > 1);
  if (desbalanceado) alertas.push("Balanço não fechou em pelo menos um mês — revise as premissas.");

  return { meses, mensal: res, anual, volumePorProduto, receitaPorProduto, alertas };
}

export function validarCenario(empresa: EmpresaSimpl, c: Cenario): string[] {
  const av: string[] = [];
  if (c.premissas.horizonteAnos < 3 || c.premissas.horizonteAnos > 10)
    av.push("Horizonte de projeção deve ficar entre 3 e 10 anos.");
  if (!c.produtos.length) av.push("Nenhum produto/serviço cadastrado — a receita será zero.");
  for (const prod of c.produtos) {
    const soma = prod.iss + prod.icms + prod.pisCofins + prod.ipi;
    if (empresa.regime !== "simples" && soma > 0.6)
      av.push(`Alíquotas de "${prod.nome}" somam ${(soma * 100).toFixed(1)}% — verifique.`);
    const somaSaz = prod.sazonalidade.reduce((s, v) => s + v, 0);
    if (Math.abs(somaSaz - 12) > 0.6)
      av.push(`Sazonalidade de "${prod.nome}" soma ${somaSaz.toFixed(2)} (esperado ≈ 12).`);
  }
  if (Math.abs(c.valuation.pesoEquity) > 1)
    av.push("Estrutura de capital: % de capital próprio deve ficar entre 0 e 100%.");
  if (c.valuation.gPerp >= 0.15) av.push("Crescimento na perpetuidade acima de 15% é implausível.");
  return av;
}
