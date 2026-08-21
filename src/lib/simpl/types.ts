export type Regime = "simples" | "presumido" | "real";
export type AnexoSimples = "I" | "II" | "III" | "IV" | "V";
export type Alocacao = "custo" | "despesa";

export interface Produto {
  id: string;
  nome: string;
  volumeMes: number;
  preco: number;
  crescVolume: number; // a.a.
  crescPreco: number; // a.a.
  sazonalidade: number[]; // 12 multiplicadores
  iss: number;
  icms: number;
  pisCofins: number;
  ipi: number;
  ibs: number;
  cbs: number;
  obs: string;
}

export interface Cargo {
  id: string;
  nome: string;
  alocacao: Alocacao;
  qtd: number;
  salario: number;
  encargos: number; // %
  beneficios: number; // R$/mês por pessoa
  crescHeadcount: number; // a.a.
  obs: string;
}

export interface OpexItem {
  id: string;
  descricao: string;
  classificacao: Alocacao;
  tipo: "fixo" | "variavel";
  baseTipo: "unidade" | "receita";
  produtoId: string; // "" = todos
  valor: number; // R$/mês (fixo) | R$/un ou % (variável)
  creditoTributario: number; // % recuperável
  obs: string;
}

export interface CapexItem {
  id: string;
  descricao: string;
  categoria: "imobilizado" | "intangivel";
  valor: number;
  mes: number; // índice do mês do modelo (0-based)
  taxaAA: number; // depreciação/amortização a.a.
  obs: string;
}

export interface Divida {
  id: string;
  descricao: string;
  valor: number;
  mes: number;
  prazoMeses: number;
  jurosAA: number;
  sistema: "price" | "sac";
  obs: string;
}

export interface Aporte {
  id: string;
  descricao: string;
  valor: number;
  mes: number;
  obs: string;
}

export interface CapitalGiro {
  pmr: number; // dias recebimento
  pmp: number; // dias pagamento fornecedores
  pme: number; // dias estocagem
  adiantFornecedores: number; // dias
  adiantClientes: number; // dias
}

export interface Rotativo {
  ativo: boolean;
  limite: number;
  jurosAA: number;
  caixaMinimo: number;
}

export interface PremissasSimpl {
  horizonteAnos: number; // 3..10
  anoInicio: number;
  mesInicio: number; // 1..12
  ipca: number[]; // por ano
  selic: number[]; // por ano
  reformaTributaria: boolean;
}

export interface ValuationIn {
  rf: number;
  beta: number;
  erp: number;
  riscoPais: number;
  riscoEspecifico: number;
  spreadDivida: number;
  pesoEquity: number; // 0..1
  gPerp: number;
  obs: string;
}

export interface Cenario {
  id: string;
  nome: string;
  premissas: PremissasSimpl;
  produtos: Produto[];
  cargos: Cargo[];
  opex: OpexItem[];
  capex: CapexItem[];
  dividas: Divida[];
  aportes: Aporte[];
  capitalGiro: CapitalGiro;
  rotativo: Rotativo;
  valuation: ValuationIn;
  caixaInicial: number;
  capitalInicial: number;
}

export interface EmpresaSimpl {
  id: string;
  nome: string;
  moeda: string;
  regime: Regime;
  anexoSimples: AnexoSimples;
  presumidoBaseIRPJ: number; // % presunção sobre receita
  presumidoBaseCSLL: number;
  criadoEm: string;
  cenarios: Cenario[];
  cenarioAtivoId: string;
}
