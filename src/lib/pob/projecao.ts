/** Motor da Projeção Orçamentária (12 meses) a partir das Premissas do modelo. */
import { MESES_POB } from "./types";
import { evolucaoEmprestimo, parametrosPadrao, type ParametrosPOB } from "./parametros";

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
  for (const e of p.emprestimos) {
    evolucaoEmprestimo(e).forEach((l, i) => {
      saldo[i] += l.saldoFinal;
      amort[i] += l.amortizacao;
      juros[i] += l.juros;
    });
  }

  return {
    qtdAno,
    preco,
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
