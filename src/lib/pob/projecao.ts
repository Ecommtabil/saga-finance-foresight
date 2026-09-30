/** Motor da Projeção Orçamentária (12 meses) a partir das Premissas do modelo. */
import { MESES_POB } from "./types";
import { ABERTURA_PADRAO, evolucaoEmprestimo, parametrosPadrao, type ParametrosPOB } from "./parametros";

const Z = () => Array.from({ length: 12 }, () => 0);

export function sazonalidadeDe(p: ParametrosPOB): number[] {
  const s = p.vendas.sazonalidade;
  return s && s.length === 12 ? s : Array.from({ length: 12 }, () => 100 / 12);
}

export function vendasBase(p: ParametrosPOB) {
  const d = parametrosPadrao().vendas;
  return {
    quantidadeAnualBase: p.vendas.quantidadeAnualBase ?? d.quantidadeAnualBase!,
    precoBase: p.vendas.precoBase ?? d.precoBase!,
    mesBase: p.vendas.mesBase ?? 1,
  };
}

/** Rótulos dos meses a partir do mês-base. */
export function rotulosMeses(mesBase: number, ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => {
    const idx = (mesBase - 1 + i) % 12;
    const a = ano + Math.floor((mesBase - 1 + i) / 12);
    return `${MESES_POB[idx]}/${String(a).slice(2)}`;
  });
}

export function calcularProjecaoPOB(p: ParametrosPOB) {
  const { quantidadeAnualBase, precoBase } = vendasBase(p);
  const saz = sazonalidadeDe(p);
  const qtdAno = quantidadeAnualBase * (1 + p.vendas.crescVolume / 100);
  const preco = precoBase * (1 + p.vendas.crescPreco / 100);
  const aliq = (p.impostos.pis + p.impostos.cofins + p.impostos.icms) / 100;

  // Vendas
  const qtd = saz.map((s) => (qtdAno * s) / 100);
  const precoM = Z().map(() => preco);
  const fatBruto = qtd.map((q) => q * preco);
  const fatLiq = fatBruto.map((f) => f * (1 - aliq));
  const receb = fatLiq.map(
    (f, i) => f * (p.vendas.recebeMesmoMes / 100) + (i > 0 ? fatLiq[i - 1] * (p.vendas.recebeMesSeguinte / 100) : 0),
  );

  // Produção
  const estFinalPA = qtd.map((_, i) =>
    i < 11 ? (p.producao.estoqueFinalPAPct / 100) * qtd[i + 1] : p.producao.estoqueFinalPAAno,
  );
  const necTotal = qtd.map((q, i) => q + estFinalPA[i]);
  const estIniPA = qtd.map((_, i) => (i === 0 ? p.producao.estoqueInicialPA : estFinalPA[i - 1]));
  const producao = necTotal.map((n, i) => Math.max(0, n - estIniPA[i]));
  const capacidade = Z().map(() => p.producao.capacidadeMensal);
  const folga = producao.map((pr) => capacidade[0] - pr); // + ociosidade, − falta

  // Matéria-prima
  const necMP = producao.map((pr) => pr * p.producao.mpPorUnidade);
  const estFinalMP = necMP.map((n, i) => (p.producao.estoqueFinalMPPct / 100) * (i < 11 ? necMP[i + 1] : n));
  const necTotMP = necMP.map((n, i) => n + estFinalMP[i]);
  const estIniMP = necMP.map((_, i) => (i === 0 ? p.producao.estoqueInicialMP : estFinalMP[i - 1]));
  const compraMP = necTotMP.map((n, i) => Math.max(0, n - estIniMP[i]));
  const custoCompra = compraMP.map((c) => c * p.compras.custoUnitarioMP);
  const pagFornec = custoCompra.map(
    (c, i) => c * (p.compras.pagaMesmoMes / 100) + (i > 0 ? custoCompra[i - 1] * (p.compras.pagaMesSeguinte / 100) : 0),
  );

  // MOD
  const horas = producao.map((pr) => pr * p.mod.horasPorUnidade);
  const custoHora = p.mod.salarioHora * (1 + p.mod.encargosPct / 100);
  const custoMOD = horas.map((h) => h * custoHora);

  // CIF
  const cifVar = horas.map((h) => h * p.cif.materiaisIndiretosHora);
  const cifFixo = Z().map(() => p.cif.moiFixa + p.cif.outrosFixos);
  const cifTotal = cifVar.map((v, i) => v + cifFixo[i]);

  // Despesas
  const d = p.despesas;
  const despFixas = Z().map(
    () => d.salariosAdm + d.aluguel + d.energia + d.materialEscritorio + d.viagens + d.outrasFixas,
  );
  const despVar = fatLiq.map((f) => f * ((d.propagandaPct + d.comissaoPct) / 100));

  // Investimentos
  const aquisicoes = Z();
  const deprec = Z().map(() => p.cif.depreciacaoFabril + d.depreciacaoAdm);
  const desembolso = Z();
  for (const c of p.capex) {
    const m = Math.min(12, Math.max(1, c.mes)) - 1;
    aquisicoes[m] += c.valor;
    const dm = c.valor / Math.max(1, c.vidaUtilMeses);
    for (let i = m; i < 12; i++) deprec[i] += dm;
    const n = Math.max(0, c.mesesPagamento);
    if (n === 0) desembolso[m] += c.valor;
    else for (let i = m; i < Math.min(12, m + n); i++) desembolso[i] += c.valor / n;
  }

  // Empréstimos
  const saldo = Z();
  const amort = Z();
  const juros = Z();
  const captacao = Z();
  let emprestimosIniciais = 0;
  for (const e of p.emprestimos) {
    if (e.tipo === "novo") captacao[Math.min(12, Math.max(1, e.mesContratacao)) - 1] += e.valor;
    else emprestimosIniciais += e.valor;
    evolucaoEmprestimo(e).forEach((l, i) => {
      saldo[i] += l.saldoFinal;
      amort[i] += l.amortizacao;
      juros[i] += l.juros;
    });
  }

  return {
    qtdAno,
    preco,
    raw: {
      qtd, fatLiq, receb, producao, estIniPA, compraMP, custoCompra, pagFornec, estFinalMP,
      custoMOD, cifTotal, despFixas, despVar, aquisicoes, deprec, desembolso,
      saldo, amort, juros, captacao, emprestimosIniciais,
    },
    blocos: [
      {
        bloco: "Vendas",
        linhas: [
          { rotulo: "Quantidade vendida (un.)", valores: qtd, un: true },
          { rotulo: "Preço unitário", valores: precoM },
          { rotulo: "Faturamento bruto", valores: fatBruto, destaque: true },
          { rotulo: "Faturamento líquido", valores: fatLiq, destaque: true },
          { rotulo: "Recebimento operacional", valores: receb },
        ],
      },
      {
        bloco: "Produção",
        linhas: [
          { rotulo: "Estoque final desejado (un.)", valores: estFinalPA, un: true },
          { rotulo: "Necessidade total (un.)", valores: necTotal, un: true },
          { rotulo: "Estoque inicial (un.)", valores: estIniPA, un: true },
          { rotulo: "Produção do mês (un.)", valores: producao, un: true, destaque: true },
          { rotulo: "Capacidade produtiva (un.)", valores: capacidade, un: true },
          { rotulo: "Ociosidade / (falta) de capacidade", valores: folga, un: true, alerta: true },
        ],
      },
      {
        bloco: "Matéria-Prima",
        linhas: [
          { rotulo: "Necessidade de MP (un.)", valores: necMP, un: true },
          { rotulo: "Estoque final desejado MP (un.)", valores: estFinalMP, un: true },
          { rotulo: "Necessidade total de MP (un.)", valores: necTotMP, un: true },
          { rotulo: "Estoque inicial MP (un.)", valores: estIniMP, un: true },
          { rotulo: "Compra de MP (un.)", valores: compraMP, un: true },
          { rotulo: "Custo total de compra", valores: custoCompra, destaque: true },
          { rotulo: "Pagamento a fornecedores", valores: pagFornec },
        ],
      },
      {
        bloco: "Mão de Obra",
        linhas: [
          { rotulo: "Horas necessárias", valores: horas, un: true },
          { rotulo: "Custo total de MOD", valores: custoMOD, destaque: true },
        ],
      },
      {
        bloco: "Custos Indiretos",
        linhas: [
          { rotulo: "Custo indireto variável", valores: cifVar },
          { rotulo: "Custo indireto fixo", valores: cifFixo },
          { rotulo: "Custo indireto total", valores: cifTotal, destaque: true },
        ],
      },
      {
        bloco: "Despesas",
        linhas: [
          { rotulo: "Despesas fixas", valores: despFixas },
          { rotulo: "Despesas variáveis", valores: despVar },
        ],
      },
      {
        bloco: "Investimentos",
        linhas: [
          { rotulo: "Novas aquisições", valores: aquisicoes },
          { rotulo: "Depreciação total", valores: deprec },
          { rotulo: "Desembolso de caixa", valores: desembolso, destaque: true },
        ],
      },
      {
        bloco: "Empréstimos",
        linhas: [
          { rotulo: "Saldo devedor", valores: saldo, destaque: true },
          { rotulo: "Amortização", valores: amort },
          { rotulo: "Juros", valores: juros },
        ],
      },
    ] as {
      bloco: string;
      linhas: { rotulo: string; valores: number[]; un?: boolean; destaque?: boolean; alerta?: boolean }[];
    }[],
  };
}

export type LinhaDem = { rotulo: string; valores: number[]; tipo?: "total" | "sub" | "neg" };

/** DRE, Fluxo de Caixa direto e Balanço mensais — fechamento garantido por construção. */
export function calcularDemonstrativosPOB(p: ParametrosPOB) {
  const { raw: r } = calcularProjecaoPOB(p);
  const ab = { ...ABERTURA_PADRAO, ...(p.abertura ?? {}) };
  const custoMP = p.compras.custoUnitarioMP;
  const n = 12;

  // Estoques em valor (MP ao custo; PA ao custo médio de produção do mês)
  const estMPIni0 = p.producao.estoqueInicialMP * custoMP;
  const estMPFin = r.estFinalMP.map((q) => q * custoMP);
  const consumoMP = Z();
  const custoProd = Z();
  const estPAFin = Z();
  const cpv = Z();
  const unit0 = (() => {
    const i = r.producao.findIndex((x) => x > 0);
    if (i < 0) return 0;
    return ((r.producao[i] * p.producao.mpPorUnidade * custoMP) + r.custoMOD[i] + r.cifTotal[i]) / r.producao[i];
  })();
  const estPAIni0 = p.producao.estoqueInicialPA * unit0;
  let qtdPA = p.producao.estoqueInicialPA;
  for (let i = 0; i < n; i++) {
    const mpIni = i === 0 ? estMPIni0 : estMPFin[i - 1];
    consumoMP[i] = mpIni + r.custoCompra[i] - estMPFin[i];
    custoProd[i] = consumoMP[i] + r.custoMOD[i] + r.cifTotal[i];
    const paIni = i === 0 ? estPAIni0 : estPAFin[i - 1];
    qtdPA = Math.max(0, qtdPA + r.producao[i] - r.qtd[i]);
    const unit = r.producao[i] > 0 ? custoProd[i] / r.producao[i] : unit0;
    estPAFin[i] = qtdPA * unit;
    cpv[i] = paIni + custoProd[i] - estPAFin[i];
  }

  // DRE
  const receita = r.fatLiq;
  const lucroBruto = receita.map((v, i) => v - cpv[i]);
  const despOp = r.despFixas.map((v, i) => v + r.despVar[i]);
  const ebitda = lucroBruto.map((v, i) => v - despOp[i]);
  const ebit = ebitda.map((v, i) => v - r.deprec[i]);
  const lair = ebit.map((v, i) => v - r.juros[i]);
  const ir = lair.map((v) => (v > 0 ? (v * ab.aliquotaIR) / 100 : 0));
  const ll = lair.map((v, i) => v - ir[i]);

  // Fluxo de caixa
  const irPago = ir.map((_, i) => (i > 0 ? ir[i - 1] : 0));
  const fco = r.receb.map((v, i) => v - r.pagFornec[i] - r.custoMOD[i] - r.cifTotal[i] - despOp[i] - irPago[i]);
  const fci = r.desembolso.map((v) => -v);
  const fcf = r.captacao.map((v, i) => v - r.amort[i] - r.juros[i]);
  const saldoIni = Z();
  const saldoFin = Z();
  for (let i = 0; i < n; i++) {
    saldoIni[i] = i === 0 ? ab.caixaInicial : saldoFin[i - 1];
    saldoFin[i] = saldoIni[i] + fco[i] + fci[i] + fcf[i];
  }

  // Balanço
  let arAcc = 0, fornAcc = 0, capexAcc = 0, imob = ab.imobilizadoInicial;
  const ar = Z(), forn = Z(), capexPagar = Z(), imobL = Z();
  for (let i = 0; i < n; i++) {
    arAcc += receita[i] - r.receb[i];
    fornAcc += r.custoCompra[i] - r.pagFornec[i];
    capexAcc += r.aquisicoes[i] - r.desembolso[i];
    imob += r.aquisicoes[i] - r.deprec[i];
    ar[i] = arAcc; forn[i] = fornAcc; capexPagar[i] = capexAcc; imobL[i] = imob;
  }
  const impPagar = ir;
  const ac = saldoFin.map((v, i) => v + ar[i] + estPAFin[i] + estMPFin[i]);
  const at = ac.map((v, i) => v + imobL[i]);
  const pc = forn.map((v, i) => v + impPagar[i] + capexPagar[i]);
  const pnc = r.saldo;
  const capital = Z().map(() => ab.capitalSocial);
  // Lucros acumulados de abertura fecham o balanço inicial
  const lucrosIni =
    ab.caixaInicial + estPAIni0 + estMPIni0 + ab.imobilizadoInicial - r.emprestimosIniciais - ab.capitalSocial;
  const lucrosAc = Z();
  let acc = lucrosIni;
  for (let i = 0; i < n; i++) { acc += ll[i]; lucrosAc[i] = acc; }
  const pl = capital.map((v, i) => v + lucrosAc[i]);
  const ppl = pc.map((v, i) => v + pnc[i] + pl[i]);
  const diferenca = at.map((v, i) => v - ppl[i]);

  const neg = (a: number[]) => a.map((v) => -v);
  return {
    lucrosIni,
    diferenca,
    dre: [
      { rotulo: "Receita (faturamento líquido)", valores: receita, tipo: "sub" },
      { rotulo: "(−) Custos dos produtos vendidos", valores: neg(cpv), tipo: "neg" },
      { rotulo: "(=) Lucro bruto", valores: lucroBruto, tipo: "total" },
      { rotulo: "(−) Despesas operacionais", valores: neg(despOp), tipo: "neg" },
      { rotulo: "(=) EBITDA", valores: ebitda, tipo: "total" },
      { rotulo: "(−) Depreciação", valores: neg(r.deprec), tipo: "neg" },
      { rotulo: "(=) EBIT", valores: ebit, tipo: "total" },
      { rotulo: "(−) Despesas financeiras", valores: neg(r.juros), tipo: "neg" },
      { rotulo: "(=) Lucro antes do imposto", valores: lair, tipo: "total" },
      { rotulo: `(−) IR/CSLL (${ab.aliquotaIR}%)`, valores: neg(ir), tipo: "neg" },
      { rotulo: "(=) Lucro líquido", valores: ll, tipo: "total" },
    ] as LinhaDem[],
    fluxo: [
      { rotulo: "Saldo inicial de caixa", valores: saldoIni, tipo: "sub" },
      { rotulo: "(+) Recebimento operacional", valores: r.receb },
      { rotulo: "(−) Pagamento a fornecedores de MP", valores: neg(r.pagFornec), tipo: "neg" },
      { rotulo: "(−) Pagamento de MOD", valores: neg(r.custoMOD), tipo: "neg" },
      { rotulo: "(−) Pagamento de CIF", valores: neg(r.cifTotal), tipo: "neg" },
      { rotulo: "(−) Despesas operacionais", valores: neg(despOp), tipo: "neg" },
      { rotulo: "(−) Impostos pagos (IR/CSLL)", valores: neg(irPago), tipo: "neg" },
      { rotulo: "(=) Atividades operacionais", valores: fco, tipo: "total" },
      { rotulo: "(+) Entradas de investimento", valores: Z() },
      { rotulo: "(−) Desembolso com CAPEX", valores: fci, tipo: "neg" },
      { rotulo: "(=) Atividades de investimento", valores: fci, tipo: "total" },
      { rotulo: "(+) Novos empréstimos", valores: r.captacao },
      { rotulo: "(−) Amortização", valores: neg(r.amort), tipo: "neg" },
      { rotulo: "(−) Juros pagos", valores: neg(r.juros), tipo: "neg" },
      { rotulo: "(=) Atividades de financiamento", valores: fcf, tipo: "total" },
      { rotulo: "Saldo final de caixa", valores: saldoFin, tipo: "total" },
    ] as LinhaDem[],
    balancoAtivo: [
      { rotulo: "Caixa", valores: saldoFin },
      { rotulo: "Contas a receber", valores: ar },
      { rotulo: "Estoque de produtos acabados", valores: estPAFin },
      { rotulo: "Estoque de matéria-prima", valores: estMPFin },
      { rotulo: "Ativo circulante", valores: ac, tipo: "sub" },
      { rotulo: "Imobilizado líquido", valores: imobL },
      { rotulo: "Ativo total", valores: at, tipo: "total" },
    ] as LinhaDem[],
    balancoPassivo: [
      { rotulo: "Fornecedores a pagar", valores: forn },
      { rotulo: "Impostos a pagar", valores: impPagar },
      { rotulo: "Contas a pagar de investimentos", valores: capexPagar },
      { rotulo: "Passivo circulante", valores: pc, tipo: "sub" },
      { rotulo: "Empréstimos e financiamentos", valores: pnc },
      { rotulo: "Passivo não circulante", valores: pnc, tipo: "sub" },
      { rotulo: "Capital social", valores: capital },
      { rotulo: "Lucros acumulados", valores: lucrosAc },
      { rotulo: "Patrimônio líquido", valores: pl, tipo: "sub" },
      { rotulo: "Passivo + PL total", valores: ppl, tipo: "total" },
    ] as LinhaDem[],
  };
}
