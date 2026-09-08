/**
 * Motor de cálculo do modelo financeiro (MF2).
 * Funções puras — sem dependência de UI — para reuso em telas, relatórios e exportações.
 * Projeção mensal de 60 meses (5 anos) a partir do mês de início definido nas Premissas.
 */
import type { Ativo, Divida, ModeloMF2 } from "./types";
import { totalMensalCargo } from "./types";

export const MESES_PROJECAO = 60;

export interface LinhaMes {
  indice: number; // 0..59
  ano: number; // 1..5
  mesCalendario: number; // 1..12
  anoCalendario: number;
  rotulo: string; // "mm/aaaa"

  // Receita
  volumeTotal: number;
  receitaBruta: number;
  receitaPorProduto: Record<string, number>;
  volumePorProduto: Record<string, number>;

  // DRE
  deducoes: number; // negativo
  receitaLiquida: number;
  custoPessoal: number;
  custosVariaveis: number;
  custosFixos: number;
  custoDasVendas: number;
  lucroBruto: number;
  despesaPessoal: number;
  despesasFixasSga: number;
  despesasVariaveisSga: number;
  depreciacao: number;
  despesasOperacionais: number;
  ebit: number;
  ebitda: number;
  receitasFinanceiras: number;
  despesasFinanceiras: number;
  resultadoFinanceiro: number;
  lucroAntesImpostos: number;
  irpjCsll: number;
  lucroLiquido: number;

  // Capital de giro
  contasReceber: number;
  estoques: number;
  tributosRecuperar: number;
  adiantFornecedores: number;
  contasPagar: number;
  obrigacoesTributarias: number;
  obrigacoesTrabalhistas: number;
  adiantClientes: number;

  // Ativos
  capex: number;
  imobilizadoLiquido: number;
  intangivelLiquido: number;
  investimentos: number;

  // Dívidas
  captacoes: number;
  amortizacoes: number;
  dividaCurtoPrazo: number;
  dividaLongoPrazo: number;
  saldoRevolvente: number;
  variacaoRevolvente: number;

  // Fluxo de caixa
  fluxoOperacional: number;
  fluxoInvestimento: number;
  fluxoFinanciamento: number;
  caixaInicial: number;
  caixaFinal: number;
  dividendos: number;
  aportes: number;

  // Balanço
  ativoCirculante: number;
  ativoNaoCirculante: number;
  ativoTotal: number;
  passivoCirculante: number;
  passivoNaoCirculante: number;
  capitalSocial: number;
  lucrosAcumulados: number;
  patrimonioLiquido: number;
  passivoTotal: number;
  balanceCheck: number; // ativoTotal - passivoTotal
  provaRealCaixa: number; // caixa DFC - caixa BP
}

export interface LinhaSchedDivida {
  rotulo: string;
  indice: number;
  mesAposCaptacao: number | null;
  saldoInicial: number;
  captacao: number;
  juros: number;
  pagamento: number;
  amortizacao: number;
  saldoFinal: number;
  curtoPrazo: number;
  longoPrazo: number;
}

export interface LinhaSchedAtivo {
  rotulo: string;
  indice: number;
  saldoInicial: number;
  capex: number;
  depreciacao: number;
  saldoFinal: number;
}

export interface LinhaSchedWC {
  rotulo: string;
  indice: number;
  tribInicial: number;
  tribGerado: number;
  tribFinal: number;
  trabInicial: number;
  trabProvisao: number;
  trabPago: number;
  trabFinal: number;
}

export interface SchedulesProjecao {
  dividas: { nome: string; linhas: LinhaSchedDivida[] }[];
  revolvente: LinhaSchedDivida[];
  ativos: { nome: string; tipo: string; linhas: LinhaSchedAtivo[] }[];
  capitalGiro: LinhaSchedWC[];
}

export interface ResultadoProjecao {
  meses: LinhaMes[];
  anuais: LinhaAno[];
  alertas: { mes: string; tipo: "balanco" | "caixa"; diferenca: number }[];
  balancoFecha: boolean;
  schedules: SchedulesProjecao;
}

export interface LinhaAno {
  ano: number;
  receitaBruta: number;
  receitaLiquida: number;
  custoDasVendas: number;
  lucroBruto: number;
  despesasOperacionais: number;
  ebitda: number;
  ebit: number;
  resultadoFinanceiro: number;
  lucroAntesImpostos: number;
  irpjCsll: number;
  lucroLiquido: number;
  capex: number;
  fluxoOperacional: number;
  fluxoInvestimento: number;
  fluxoFinanciamento: number;
  caixaFinal: number;
}

const TOL = 0.5;

/** PMT tipo Price. */
export function pmt(taxaMensal: number, nPeriodos: number, valorPresente: number): number {
  if (nPeriodos <= 0) return valorPresente;
  if (!taxaMensal) return valorPresente / nPeriodos;
  return (valorPresente * taxaMensal) / (1 - Math.pow(1 + taxaMensal, -nPeriodos));
}

/** Taxa mensal equivalente composta a partir de uma taxa anual. */
export function taxaMensalEquivalente(anual: number): number {
  return Math.pow(1 + (anual || 0), 1 / 12) - 1;
}

function serieAnual(valores: number[] | undefined, ano: number): number {
  return valores?.[ano - 1] ?? 0;
}

function crescComposto(base: number, taxas: number[] | undefined, ano: number): number {
  let v = base || 0;
  for (let i = 0; i < ano - 1; i++) v *= 1 + (taxas?.[i] ?? 0);
  return v;
}

interface EstadoDivida {
  divida: Divida;
  saldo: number;
  mesInicio: number; // índice 0..59 (pode ser <0 = já captada)
  taxaMensal: number;
}

function indiceMesCaptacao(inicio: Date, iso: string): number {
  if (!iso) return 0;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return 0;
  return (d.getFullYear() - inicio.getFullYear()) * 12 + (d.getMonth() - inicio.getMonth());
}

/** Projeção mensal completa de 60 meses. */
export function projetarModelo(m: ModeloMF2): ResultadoProjecao {
  const inicio = m.dataInicioModelo
    ? new Date(`${m.dataInicioModelo}T00:00:00`)
    : new Date(new Date().getFullYear(), 0, 1);
  const t = m.tributacao;
  const regime = m.regimeTributario;
  const diasRec = m.capitalGiro.diasRecebimento || 0;
  const diasEst = m.capitalGiro.diasEstoque || 0;
  const diasPag = m.capitalGiro.diasPagamento || 0;
  const pctAdiantClientes = m.adiantamentoClientes ?? 0;
  const pctAdiantForn = m.adiantamentoFornecedores ?? 0;
  const pctTribRec = m.tributosRecuperaveis ?? 0;
  const pctDividendos = m.percentualDividendos ?? 0;

  // Sazonalidade normalizada
  const sazon = Array.from({ length: 12 }, (_, i) => {
    const s = m.sazonalidade.find((x) => x.mes === i + 1);
    return s?.percentual ?? 1 / 12;
  });
  const somaSaz = sazon.reduce((a, b) => a + b, 0) || 1;

  // Pessoal
  const pessoalCusto = m.cargos
    .filter((c) => c.tipo === "Custo")
    .reduce((a, c) => a + totalMensalCargo(c), 0);
  const pessoalDespesa = m.cargos
    .filter((c) => c.tipo === "Despesa")
    .reduce((a, c) => a + totalMensalCargo(c), 0);
  const folhaTotal = pessoalCusto + pessoalDespesa;

  // Ativos
  const ativosEstado = m.ativos.map((a: Ativo) => ({ ativo: a, saldo: 0 }));

  // Dívidas
  const dividas: EstadoDivida[] = m.dividas.map((d) => ({
    divida: d,
    saldo: 0,
    mesInicio: indiceMesCaptacao(inicio, d.mesCaptacao),
    taxaMensal: (d.taxaJurosAnual || 0) / 12,
  }));

  let caixa = m.caixaCapital.saldoCaixaInicial || 0;
  let revolvente = 0;
  let capitalSocial = m.caixaCapital.saldoCaixaInicial || 0;
  let lucrosAcumulados = 0;
  let obrigTrabalhistas = 0;
  let lucroTrimestre = 0;

  const prev = {
    ar: 0,
    est: 0,
    trib: 0,
    adiForn: 0,
    ap: 0,
    obTrib: 0,
    obTrab: 0,
    adiCli: 0,
  };

  const meses: LinhaMes[] = [];
  const schedDividas: { nome: string; linhas: LinhaSchedDivida[] }[] = m.dividas.map((d, i2) => ({
    nome: d.nome || `Dívida ${i2 + 1}`,
    linhas: [],
  }));
  const schedRevolvente: LinhaSchedDivida[] = [];
  const schedAtivos: { nome: string; tipo: string; linhas: LinhaSchedAtivo[] }[] = m.ativos.map(
    (a) => ({ nome: a.tipo, tipo: a.tipo, linhas: [] }),
  );
  const schedWC: LinhaSchedWC[] = [];

  for (let i = 0; i < MESES_PROJECAO; i++) {
    const ano = Math.floor(i / 12) + 1;
    const data = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1);
    const mesCal = data.getMonth() + 1;
    const rotuloMes = `${String(mesCal).padStart(2, "0")}/${data.getFullYear()}`;
    const pctSaz = sazon[data.getMonth()] / somaSaz;

    // --- 1. Receita
    const receitaPorProduto: Record<string, number> = {};
    const volumePorProduto: Record<string, number> = {};
    let receitaBruta = 0;
    let volumeTotal = 0;
    for (const p of m.produtos) {
      const volAno = crescComposto(p.volumeAno1, p.crescimentoVolume, ano);
      const preco = crescComposto(p.precoAno1, p.crescimentoPreco, ano);
      const volMes = volAno * pctSaz;
      const rec = volMes * preco;
      volumePorProduto[p.id] = volMes;
      receitaPorProduto[p.id] = rec;
      volumeTotal += volMes;
      receitaBruta += rec;
    }

    // --- 2. DRE
    let aliqSobreReceita = 0;
    if (regime === "Simples Nacional") {
      aliqSobreReceita = t.aliquotaDas || 0;
    } else {
      aliqSobreReceita =
        (t.aliquotaIcms || 0) + (t.aliquotaIss || 0) + (t.aliquotaIpi || 0) + (t.aliquotaPisCofins || 0);
    }
    const creditos =
      regime === "Lucro Real" ? receitaBruta * (t.percentualCreditosTributarios || 0) : 0;
    const deducoes = -(receitaBruta * aliqSobreReceita) + creditos;
    const receitaLiquida = receitaBruta + deducoes;

    const custosVarPct = m.custosVariaveisPercentual.reduce(
      (a, l) => a + receitaBruta * serieAnual(l.valores, ano),
      0,
    );
    const custosVarUnit = m.custosVariaveisUnitarios.reduce(
      (a, l) => a + volumeTotal * serieAnual(l.valores, ano),
      0,
    );
    const custosVariaveis = custosVarPct + custosVarUnit;
    const custosFixos = m.custosFixos.reduce((a, l) => a + serieAnual(l.valores, ano), 0);
    const custoDasVendas = pessoalCusto + custosVariaveis + custosFixos;
    const lucroBruto = receitaLiquida - custoDasVendas;

    // --- 3. Schedule de ativos
    let capex = 0;
    let depreciacao = 0;
    for (const [idxA, est] of ativosEstado.entries()) {
      const saldoInicial = est.saldo;
      const invMes = serieAnual(est.ativo.investimentoPorAno, ano) / 12;
      const dep =
        est.ativo.tipo === "Investimentos"
          ? 0
          : est.saldo * ((est.ativo.taxaDepreciacaoAnual || 0) / 12);
      capex += invMes;
      depreciacao += dep;
      est.saldo = est.saldo + invMes - dep;
      schedAtivos[idxA].linhas.push({
        rotulo: rotuloMes,
        indice: i,
        saldoInicial,
        capex: invMes,
        depreciacao: dep,
        saldoFinal: est.saldo,
      });
    }

    const despesasFixasSga = m.despesasFixasSga.reduce((a, l) => a + serieAnual(l.valores, ano), 0);
    const despesasVariaveisSga = m.despesasVariaveisSga.reduce(
      (a, l) => a + receitaBruta * serieAnual(l.valores, ano),
      0,
    );
    const despesasOperacionais =
      pessoalDespesa + despesasFixasSga + despesasVariaveisSga + depreciacao;
    const ebit = lucroBruto - despesasOperacionais;
    const ebitda = ebit + depreciacao;

    // --- 4. Schedule de dívidas (juros calculados sobre saldo inicial)
    const selicAno = m.premissasMacro.find((p) => p.ano === ano)?.selic ?? 0;
    const selicMes = taxaMensalEquivalente(selicAno);
    const receitasFinanceiras = Math.max(caixa, 0) * selicMes;

    let jurosDividas = 0;
    let captacoes = 0;
    let amortizacoes = 0;
    let cpDividas = 0;
    let lpDividas = 0;
    for (const [idx, d] of dividas.entries()) {
      const saldoInicial = d.saldo;
      let captacaoMes = 0;
      let juros = 0;
      let parcela = 0;
      let amort = 0;
      let cp = 0;
      if (i === d.mesInicio) {
        d.saldo += d.divida.valorCaptacao || 0;
        captacoes += d.divida.valorCaptacao || 0;
        captacaoMes = d.divida.valorCaptacao || 0;
      }
      if (d.saldo > 0.0001 && i >= d.mesInicio) {
        const prazoRestante = Math.max((d.divida.prazoMeses || 0) - (i - d.mesInicio), 1);
        juros = d.saldo * d.taxaMensal;
        parcela = Math.min(pmt(d.taxaMensal, prazoRestante, d.saldo), d.saldo + juros);
        amort = parcela - juros;
        jurosDividas += juros;
        amortizacoes += Math.max(amort, 0);
        d.saldo = Math.max(d.saldo + juros - parcela, 0);
        // Curto x longo prazo: amortizações dos próximos 12 meses
        const prazoRest2 = Math.max(prazoRestante - 1, 0);
        const parcelaFutura = prazoRest2 > 0 ? pmt(d.taxaMensal, prazoRest2, d.saldo) : 0;
        cp = Math.min(
          d.saldo,
          Math.max(parcelaFutura * Math.min(prazoRest2, 12) - d.saldo * d.taxaMensal * 12, 0),
        );
        cpDividas += cp;
        lpDividas += Math.max(d.saldo - cp, 0);
      }
      schedDividas[idx].linhas.push({
        rotulo: rotuloMes,
        indice: i,
        mesAposCaptacao: i >= d.mesInicio ? i - d.mesInicio + 1 : null,
        saldoInicial,
        captacao: captacaoMes,
        juros,
        pagamento: parcela,
        amortizacao: Math.max(amort, 0),
        saldoFinal: d.saldo,
        curtoPrazo: cp,
        longoPrazo: Math.max(d.saldo - cp, 0),
      });
    }
    const jurosRevolvente = revolvente * ((selicAno || 0.12) / 12 + 0.005);
    const despesasFinanceiras = jurosDividas + jurosRevolvente;
    const resultadoFinanceiro = receitasFinanceiras - despesasFinanceiras;
    const lucroAntesImpostos = ebit + resultadoFinanceiro;

    let irpjCsll = 0;
    if (regime === "Lucro Presumido") irpjCsll = receitaBruta * (t.aliquotaIrpjCsll || 0);
    else if (regime === "Lucro Real")
      irpjCsll = Math.max(lucroAntesImpostos, 0) * (t.aliquotaIrpjCsll || 0);
    const lucroLiquido = lucroAntesImpostos - irpjCsll;

    // --- 5. Capital de giro (níveis)
    const contasReceber = (receitaLiquida / 30) * diasRec;
    const estoques = (custoDasVendas / 30) * diasEst;
    const baseFornecedores = Math.max(
      custoDasVendas - pessoalCusto + (despesasOperacionais - pessoalDespesa - depreciacao),
      0,
    );
    const contasPagar = (baseFornecedores / 30) * diasPag;
    const tributosRecuperar = receitaBruta * pctTribRec;
    const adiantFornecedores = custoDasVendas * pctAdiantForn;
    const adiantClientes = receitaBruta * pctAdiantClientes;
    const obrigacoesTributarias = Math.abs(Math.min(deducoes, 0)) + irpjCsll;
    const trabInicial = obrigTrabalhistas;
    const trabProvisao = folhaTotal / 12;
    obrigTrabalhistas += trabProvisao; // provisão de 13º
    if (mesCal === 11) obrigTrabalhistas *= 0.5;
    else if (mesCal === 12) obrigTrabalhistas = 0;
    const obrigacoesTrabalhistas = obrigTrabalhistas;
    schedWC.push({
      rotulo: rotuloMes,
      indice: i,
      tribInicial: prev.trib,
      tribGerado: tributosRecuperar - prev.trib,
      tribFinal: tributosRecuperar,
      trabInicial,
      trabProvisao,
      trabPago: trabInicial + trabProvisao - obrigacoesTrabalhistas,
      trabFinal: obrigacoesTrabalhistas,
    });

    // --- 7. Fluxo de caixa (indireto)
    const varAtivosWC =
      contasReceber -
      prev.ar +
      (estoques - prev.est) +
      (tributosRecuperar - prev.trib) +
      (adiantFornecedores - prev.adiForn);
    const varPassivosWC =
      contasPagar -
      prev.ap +
      (obrigacoesTributarias - prev.obTrib) +
      (obrigacoesTrabalhistas - prev.obTrab) +
      (adiantClientes - prev.adiCli);

    const fluxoOperacional = lucroLiquido + depreciacao - varAtivosWC + varPassivosWC;
    const fluxoInvestimento = -capex;

    const aportes = i % 12 === 0 ? m.caixaCapital.aportesReducaoCapital[ano - 1] || 0 : 0;
    capitalSocial += aportes;

    lucroTrimestre += lucroLiquido;
    let dividendos = 0;
    if ([3, 6, 9, 12].includes(mesCal)) {
      if (lucroTrimestre > 0 && pctDividendos > 0) dividendos = lucroTrimestre * pctDividendos;
      lucroTrimestre = 0;
    }

    const fluxoFinanciamentoBase = captacoes - amortizacoes + aportes - dividendos;
    const caixaInicial = caixa;
    const antesRevolvente =
      caixaInicial + fluxoOperacional + fluxoInvestimento + fluxoFinanciamentoBase;

    let variacaoRevolvente = 0;
    const revolventeInicial = revolvente;
    if (antesRevolvente < 0) variacaoRevolvente = -antesRevolvente;
    else if (revolvente > 0) variacaoRevolvente = -Math.min(revolvente, antesRevolvente);
    revolvente = Math.max(revolvente + variacaoRevolvente, 0);
    schedRevolvente.push({
      rotulo: rotuloMes,
      indice: i,
      mesAposCaptacao: null,
      saldoInicial: revolventeInicial,
      captacao: Math.max(variacaoRevolvente, 0),
      juros: jurosRevolvente,
      pagamento: Math.max(-variacaoRevolvente, 0),
      amortizacao: Math.max(-variacaoRevolvente, 0),
      saldoFinal: revolvente,
      curtoPrazo: revolvente,
      longoPrazo: 0,
    });

    const fluxoFinanciamento = fluxoFinanciamentoBase + variacaoRevolvente;
    const caixaFinal = caixaInicial + fluxoOperacional + fluxoInvestimento + fluxoFinanciamento;
    caixa = caixaFinal;

    lucrosAcumulados += lucroLiquido - dividendos;

    // --- 6. Balanço
    const imobilizadoLiquido = ativosEstado
      .filter((a) => a.ativo.tipo === "Imobilizado")
      .reduce((s, a) => s + a.saldo, 0);
    const intangivelLiquido = ativosEstado
      .filter((a) => a.ativo.tipo === "Intangível")
      .reduce((s, a) => s + a.saldo, 0);
    const investimentos = ativosEstado
      .filter((a) => a.ativo.tipo === "Investimentos")
      .reduce((s, a) => s + a.saldo, 0);

    const ativoCirculante =
      caixaFinal + contasReceber + estoques + tributosRecuperar + adiantFornecedores;
    const ativoNaoCirculante = imobilizadoLiquido + intangivelLiquido + investimentos;
    const ativoTotal = ativoCirculante + ativoNaoCirculante;
    const passivoCirculante =
      cpDividas +
      revolvente +
      contasPagar +
      obrigacoesTributarias +
      obrigacoesTrabalhistas +
      adiantClientes;
    const passivoNaoCirculante = lpDividas;
    const patrimonioLiquido = capitalSocial + lucrosAcumulados;
    const passivoTotal = passivoCirculante + passivoNaoCirculante + patrimonioLiquido;

    meses.push({
      indice: i,
      ano,
      mesCalendario: mesCal,
      anoCalendario: data.getFullYear(),
      rotulo: `${String(mesCal).padStart(2, "0")}/${data.getFullYear()}`,
      volumeTotal,
      receitaBruta,
      receitaPorProduto,
      volumePorProduto,
      deducoes,
      receitaLiquida,
      custoPessoal: pessoalCusto,
      custosVariaveis,
      custosFixos,
      custoDasVendas,
      lucroBruto,
      despesaPessoal: pessoalDespesa,
      despesasFixasSga,
      despesasVariaveisSga,
      depreciacao,
      despesasOperacionais,
      ebit,
      ebitda,
      receitasFinanceiras,
      despesasFinanceiras,
      resultadoFinanceiro,
      lucroAntesImpostos,
      irpjCsll,
      lucroLiquido,
      contasReceber,
      estoques,
      tributosRecuperar,
      adiantFornecedores,
      contasPagar,
      obrigacoesTributarias,
      obrigacoesTrabalhistas,
      adiantClientes,
      capex,
      imobilizadoLiquido,
      intangivelLiquido,
      investimentos,
      captacoes,
      amortizacoes,
      dividaCurtoPrazo: cpDividas,
      dividaLongoPrazo: lpDividas,
      saldoRevolvente: revolvente,
      variacaoRevolvente,
      fluxoOperacional,
      fluxoInvestimento,
      fluxoFinanciamento,
      caixaInicial,
      caixaFinal,
      dividendos,
      aportes,
      ativoCirculante,
      ativoNaoCirculante,
      ativoTotal,
      passivoCirculante,
      passivoNaoCirculante,
      capitalSocial,
      lucrosAcumulados,
      patrimonioLiquido,
      passivoTotal,
      balanceCheck: ativoTotal - passivoTotal,
      provaRealCaixa: caixaFinal - (caixaInicial + fluxoOperacional + fluxoInvestimento + fluxoFinanciamento),
    });

    prev.ar = contasReceber;
    prev.est = estoques;
    prev.trib = tributosRecuperar;
    prev.adiForn = adiantFornecedores;
    prev.ap = contasPagar;
    prev.obTrib = obrigacoesTributarias;
    prev.obTrab = obrigacoesTrabalhistas;
    prev.adiCli = adiantClientes;
  }

  const alertas: ResultadoProjecao["alertas"] = [];
  for (const l of meses) {
    if (Math.abs(l.balanceCheck) > TOL)
      alertas.push({ mes: l.rotulo, tipo: "balanco", diferenca: l.balanceCheck });
    if (Math.abs(l.provaRealCaixa) > TOL)
      alertas.push({ mes: l.rotulo, tipo: "caixa", diferenca: l.provaRealCaixa });
  }

  return { meses, anuais: agregarAnual(meses), alertas, balancoFecha: alertas.length === 0 };
}

/** Consolida a projeção mensal em 5 anos. */
export function agregarAnual(meses: LinhaMes[]): LinhaAno[] {
  return [1, 2, 3, 4, 5].map((ano) => {
    const ms = meses.filter((m) => m.ano === ano);
    const soma = (f: (l: LinhaMes) => number) => ms.reduce((a, l) => a + f(l), 0);
    return {
      ano,
      receitaBruta: soma((l) => l.receitaBruta),
      receitaLiquida: soma((l) => l.receitaLiquida),
      custoDasVendas: soma((l) => l.custoDasVendas),
      lucroBruto: soma((l) => l.lucroBruto),
      despesasOperacionais: soma((l) => l.despesasOperacionais),
      ebitda: soma((l) => l.ebitda),
      ebit: soma((l) => l.ebit),
      resultadoFinanceiro: soma((l) => l.resultadoFinanceiro),
      lucroAntesImpostos: soma((l) => l.lucroAntesImpostos),
      irpjCsll: soma((l) => l.irpjCsll),
      lucroLiquido: soma((l) => l.lucroLiquido),
      capex: soma((l) => l.capex),
      fluxoOperacional: soma((l) => l.fluxoOperacional),
      fluxoInvestimento: soma((l) => l.fluxoInvestimento),
      fluxoFinanciamento: soma((l) => l.fluxoFinanciamento),
      caixaFinal: ms.length ? ms[ms.length - 1].caixaFinal : 0,
    };
  });
}
