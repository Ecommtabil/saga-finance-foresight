/** Estrutura das premissas do orçamento (12 meses). */

export type Meses12 = number[]; // sempre length 12

export const meses12 = (v = 0): Meses12 => Array.from({ length: 12 }, () => v);

export interface ProdutoPOB {
  id: string;
  nome: string;
  unidade: string;
  precoUnitario: number;
  volume: Meses12;
}

export interface ImpostosPOB {
  icms: number;
  iss: number;
  ipi: number;
  pisCofins: number;
  irpjCsll: number;
  creditos: number;
}

export interface ProducaoPOB {
  estoqueInicialAcabado: number;
  diasEstoqueAcabado: number;
  perdaProcessoPct: number;
}

export interface MateriaPrimaPOB {
  id: string;
  nome: string;
  unidade: string;
  custoUnitario: number;
  consumoPorUnidade: number;
  diasEstoque: number;
  diasPagamento: number;
}

export interface MaoDeObraPOB {
  id: string;
  cargo: string;
  tipo: "Direta" | "Indireta";
  quantidade: number;
  salarioMensal: number;
  encargosPct: number;
  beneficios: number;
}

export interface LinhaMensalPOB {
  id: string;
  descricao: string;
  valores: Meses12;
}

export interface CapexPOB {
  id: string;
  descricao: string;
  mes: number; // 1-12
  valor: number;
  depreciacaoAnualPct: number;
}

export interface EmprestimoPOB {
  id: string;
  nome: string;
  valor: number;
  mesCaptacao: number; // 1-12
  prazoMeses: number;
  jurosAnualPct: number;
}

export interface PremissasPOB {
  produtos: ProdutoPOB[];
  impostos: ImpostosPOB;
  producao: ProducaoPOB;
  materiasPrimas: MateriaPrimaPOB[];
  maoDeObra: MaoDeObraPOB[];
  custosIndiretos: LinhaMensalPOB[];
  despesas: LinhaMensalPOB[];
  capex: CapexPOB[];
  emprestimos: EmprestimoPOB[];
  importadoEm?: string;
}

export function premissasVazias(): PremissasPOB {
  return {
    produtos: [],
    impostos: { icms: 0, iss: 0, ipi: 0, pisCofins: 0, irpjCsll: 0, creditos: 0 },
    producao: { estoqueInicialAcabado: 0, diasEstoqueAcabado: 0, perdaProcessoPct: 0 },
    materiasPrimas: [],
    maoDeObra: [],
    custosIndiretos: [],
    despesas: [],
    capex: [],
    emprestimos: [],
  };
}

export function totalPremissas(p: PremissasPOB | undefined): number {
  if (!p) return 0;
  return (
    p.produtos.length +
    p.materiasPrimas.length +
    p.maoDeObra.length +
    p.custosIndiretos.length +
    p.despesas.length +
    p.capex.length +
    p.emprestimos.length
  );
}

export const somaMeses = (v: Meses12) => v.reduce((a, b) => a + (b || 0), 0);

export function receitaBrutaAnual(p: PremissasPOB): number {
  return p.produtos.reduce((acc, prod) => acc + somaMeses(prod.volume) * prod.precoUnitario, 0);
}

export function folhaMensal(p: PremissasPOB): number {
  return p.maoDeObra.reduce(
    (acc, c) => acc + (c.salarioMensal * (1 + c.encargosPct) + c.beneficios) * c.quantidade,
    0,
  );
}
