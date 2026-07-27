export type Modo = "completa" | "basica";

export interface Empresa {
  nome: string;
  setor: string;
  porte: string;
  moeda: string;
}

export interface DRE {
  receitaBruta: number[];
  deducoes: number[];
  receitaLiquida: number[];
  cmv: number[];
  lucroBruto: number[];
  despOperacionais: number[];
  ebitda: number[];
  depreciacao: number[];
  ebit: number[];
  resultadoFinanceiro: number[];
  lair: number[];
  impostos: number[];
  lucroLiquido: number[];
}

export interface Balanco {
  caixa: number[];
  contasReceber: number[];
  estoques: number[];
  ativoCirculante: number[];
  ativoNaoCirculante: number[];
  ativoTotal: number[];
  fornecedores: number[];
  emprestimosCP: number[];
  passivoCirculante: number[];
  emprestimosLP: number[];
  passivoNaoCirculante: number[];
  patrimonioLiquido: number[];
  passivoTotal: number[];
}

export interface Premissas {
  selic: number;
  cdi: number;
  ipca: number;
  rf: number;
  beta: number;
  erp: number;
  aliquotaIR: number;
  custoDivida: number;
  dividaTotal: number;
  equityMercado: number;
  crescimentoPerp: number;
  crescimentoProj: number;
}

export interface DadosImportados {
  modo: Modo;
  empresaPlanilha: string;
  anos: number[];
  dre: DRE;
  balanco: Balanco | null; // null quando modo básico
  premissas: Premissas;
}