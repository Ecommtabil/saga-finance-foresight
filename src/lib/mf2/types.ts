export type Moeda = "BRL" | "USD" | "EUR";

export type RegimeTributario = "Simples Nacional" | "Lucro Presumido" | "Lucro Real";

export type TipoNegocio =
  | "Comércio/Varejo"
  | "Indústria"
  | "Serviços"
  | "Tecnologia"
  | "Construção/Engenharia"
  | "Educação/Treinamento"
  | "Saúde";

export type TipoCargo = "Custo" | "Despesa";

export type TipoAtivo = "Imobilizado" | "Intangível" | "Investimentos";

/** Série de 5 anos (ano 1 a ano 5). */
export type Serie5 = [number, number, number, number, number];

export interface PremissaMacro {
  ano: number; // 1..5
  ipca: number; // % a.a. (decimal, ex.: 0.045)
  selic: number; // % a.a. (decimal)
}

export interface Produto {
  id: string;
  nome: string;
  unidadeMedida: string;
  volumeAno1: number;
  crescimentoVolume: [number, number, number, number]; // anos 2..5
  precoAno1: number;
  crescimentoPreco: [number, number, number, number]; // anos 2..5
}

export interface Sazonalidade {
  mes: number; // 1..12
  percentual: number; // % do volume anual (decimal)
}

export interface Cargo {
  id: string;
  nomeCargo: string;
  tipo: TipoCargo;
  quantidade: number;
  salarioMensal: number;
  encargosPercentual: number; // decimal
  beneficiosValor: number; // R$/mês por pessoa
}

/** Linha genérica com valor por ano (1..5). */
export interface LinhaAnual {
  id: string;
  descricao: string;
  valores: Serie5;
}

export interface Tributacao {
  regime: RegimeTributario;
  aliquotaDas: number;
  aliquotaIcms: number;
  aliquotaIss: number;
  aliquotaIpi: number;
  aliquotaPisCofins: number;
  aliquotaIrpjCsll: number;
  percentualCreditosTributarios: number;
}

export interface CapitalGiro {
  diasRecebimento: number;
  diasEstoque: number;
  diasPagamento: number;
}

export interface CaixaCapital {
  saldoCaixaInicial: number;
  aportesReducaoCapital: Serie5;
}

export interface Ativo {
  id: string;
  tipo: TipoAtivo;
  investimentoPorAno: Serie5;
  taxaDepreciacaoAnual: number; // decimal
}

export interface Divida {
  id: string;
  nome: string;
  valorCaptacao: number;
  mesCaptacao: string; // ISO date (yyyy-mm-dd)
  prazoMeses: number;
  taxaJurosAnual: number; // decimal
}

export interface ModeloMF2 {
  id: string;
  nomeEmpresa: string;
  unidadeMonetaria: Moeda;
  regimeTributario: RegimeTributario;
  tipoNegocio: TipoNegocio;
  dataInicioModelo: string; // ISO date
  createdAt: string;
  premissasMacro: PremissaMacro[]; // 5 anos
  produtos: Produto[]; // quantidade dinâmica
  sazonalidade: Sazonalidade[]; // 12 meses
  cargos: Cargo[]; // máx. 15
  custosVariaveisPercentual: LinhaAnual[];
  custosVariaveisUnitarios: LinhaAnual[];
  custosFixos: LinhaAnual[];
  despesasFixasSga: LinhaAnual[];
  despesasVariaveisSga: LinhaAnual[];
  tributacao: Tributacao;
  capitalGiro: CapitalGiro;
  caixaCapital: CaixaCapital;
  ativos: Ativo[];
  dividas: Divida[]; // máx. 5
}


export const MAX_CARGOS = 15;
export const MAX_DIVIDAS = 5;

export const MOEDAS: Moeda[] = ["BRL", "USD", "EUR"];
export const REGIMES: RegimeTributario[] = [
  "Simples Nacional",
  "Lucro Presumido",
  "Lucro Real",
];
export const TIPOS_NEGOCIO: TipoNegocio[] = [
  "Comércio/Varejo",
  "Indústria",
  "Serviços",
  "Tecnologia",
  "Construção/Engenharia",
  "Educação/Treinamento",
  "Saúde",
];

/** Selic real = (1+selic)/(1+ipca)-1 — calculada, nunca armazenada. */
export function selicReal(selic: number, ipca: number): number {
  return (1 + selic) / (1 + ipca) - 1;
}

/** Total mensal de um cargo = (salário*(1+encargos)+benefícios)*quantidade. */
export function totalMensalCargo(c: Cargo): number {
  return (c.salarioMensal * (1 + c.encargosPercentual) + c.beneficiosValor) * c.quantidade;
}

/** Soma dos 12 meses de sazonalidade (deve fechar em 1 = 100%). */
export function somaSazonalidade(s: Sazonalidade[]): number {
  return s.reduce((a, b) => a + b.percentual, 0);
}
