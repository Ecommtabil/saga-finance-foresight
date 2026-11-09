// Motor de cálculo da NCG – Calculadora de NCG Simplificada
// Funções puras e tipadas. Qualquer divisão por zero retorna 0.

export interface EntradasNCG {
  dias: number;
  vendas: number;
  cmv: number;
  compras: number;
  despesasFixas: number;
  clientesMedio: number;
  estoquesMedio: number;
  fornecedoresMedio: number;
  outrosAtivos: number[]; // saldos médios: impostos a recuperar, adiant. fornecedores, despesas antecipadas
  outrosPassivos: number[]; // saldos médios: impostos a recolher, adiant. clientes, provisões
  prazoDespFixas: number; // dias
  mesesReserva: number;
  caixa: number;
}

export interface PrazosMedios {
  pmr: number;
  pme: number;
  pmp: number;
  cicloOperacional: number;
  cicloFinanceiro: number;
}

export interface BasesDiarias {
  vendasDia: number;
  cmvDia: number;
  comprasDia: number;
  despFixasDia: number;
}

export interface NcgOperacional {
  clientes: number;
  estoques: number;
  outrosAtivos: number;
  fornecedores: number; // negativo
  despesasFixasAPagar: number; // negativo
  outrosPassivos: number; // negativo
  total: number;
}

export interface ResultadoNCG {
  prazos: PrazosMedios;
  bases: BasesDiarias;
  ncg: NcgOperacional;
  reservaSeguranca: number;
  capitalGiroTotal: number;
  sobraFalta: number; // positivo = sobra, negativo = falta
  giroCoberto: boolean;
  ncgDiasVenda: number;
  ncgSobreVendasAnualizadas: number; // fração (0,111 = 11,1%)
  coberturaCaixa: number; // fração (0,483 = 48,3%)
  ncgSimplificada: number;
  diferencaSimplificada: number;
}

/** Divisão segura: denominador zero retorna 0. */
function div(numerador: number, denominador: number): number {
  if (!denominador || !isFinite(denominador)) return 0;
  const r = numerador / denominador;
  return isFinite(r) ? r : 0;
}

export function calcularPrazosMedios(e: EntradasNCG): PrazosMedios {
  const pmr = div(e.clientesMedio, e.vendas) * e.dias;
  const pme = div(e.estoquesMedio, e.cmv) * e.dias;
  const pmp = div(e.fornecedoresMedio, e.compras) * e.dias;
  return {
    pmr,
    pme,
    pmp,
    cicloOperacional: pmr + pme,
    cicloFinanceiro: pmr + pme - pmp,
  };
}

export function calcularBasesDiarias(e: EntradasNCG): BasesDiarias {
  return {
    vendasDia: div(e.vendas, e.dias),
    cmvDia: div(e.cmv, e.dias),
    comprasDia: div(e.compras, e.dias),
    despFixasDia: div(e.despesasFixas, e.dias),
  };
}

export function calcularNcgOperacional(
  e: EntradasNCG,
  bases: BasesDiarias,
  prazos: PrazosMedios
): NcgOperacional {
  const clientes = bases.vendasDia * prazos.pmr;
  const estoques = bases.cmvDia * prazos.pme;
  const outrosAtivos = e.outrosAtivos.reduce((s, v) => s + v, 0);
  const fornecedores = -(bases.comprasDia * prazos.pmp);
  const despesasFixasAPagar = -(bases.despFixasDia * e.prazoDespFixas);
  const outrosPassivos = -e.outrosPassivos.reduce((s, v) => s + v, 0);
  const total =
    clientes + estoques + outrosAtivos + fornecedores + despesasFixasAPagar + outrosPassivos;
  return { clientes, estoques, outrosAtivos, fornecedores, despesasFixasAPagar, outrosPassivos, total };
}

export function calcularNCG(e: EntradasNCG): ResultadoNCG {
  const prazos = calcularPrazosMedios(e);
  const bases = calcularBasesDiarias(e);
  const ncg = calcularNcgOperacional(e, bases, prazos);

  const reservaSeguranca = bases.despFixasDia * 30 * e.mesesReserva;
  const capitalGiroTotal = ncg.total + reservaSeguranca;
  const sobraFalta = e.caixa - capitalGiroTotal;

  const ncgDiasVenda = div(ncg.total, bases.vendasDia);
  const ncgSobreVendasAnualizadas = div(ncg.total, bases.vendasDia * 360);
  const coberturaCaixa = div(e.caixa, capitalGiroTotal);

  const ncgSimplificada = prazos.cicloFinanceiro * (bases.comprasDia + bases.despFixasDia);
  const diferencaSimplificada = ncgSimplificada - ncg.total;

  return {
    prazos,
    bases,
    ncg,
    reservaSeguranca,
    capitalGiroTotal,
    sobraFalta,
    giroCoberto: sobraFalta >= 0,
    ncgDiasVenda,
    ncgSobreVendasAnualizadas,
    coberturaCaixa,
    ncgSimplificada,
    diferencaSimplificada,
  };
}
