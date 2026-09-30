/** Premissas-parâmetro (inputs editáveis do modelo) do Planejamento Orçamentário. */
import { uid } from "./types";

export interface CapexItem {
  id: string;
  nome: string;
  valor: number;
  mes: number; // 1-12
  vidaUtilMeses: number;
  mesesPagamento: number; // 0 = à vista
}

export interface EmprestimoItem {
  id: string;
  nome: string;
  tipo: "existente" | "novo";
  valor: number; // saldo inicial ou valor captado
  dataInicio: string; // yyyy-mm
  mesContratacao: number; // 1-12 (novos)
  jurosMensalPct: number;
  modoAmortizacao: "valor" | "parcelas";
  amortizacao: number; // R$/mês ou nº parcelas
}

export interface ParametrosPOB {
  vendas: {
    crescVolume: number;
    crescPreco: number;
    recebeMesmoMes: number;
    recebeMesSeguinte: number;
    /** Base (ano anterior) — opcionais para compatibilidade com cenários salvos. */
    quantidadeAnualBase?: number;
    precoBase?: number;
    mesBase?: number; // 1-12
    sazonalidade?: number[]; // 12 valores em %, soma 100
  };
  impostos: { pis: number; cofins: number; icms: number };
  producao: {
    capacidadeMensal: number;
    estoqueInicialPA: number;
    estoqueFinalPAPct: number;
    estoqueFinalPAAno: number;
    mpPorUnidade: number;
    estoqueFinalMPPct: number;
    estoqueInicialMP: number;
  };
  compras: { custoUnitarioMP: number; pagaMesmoMes: number; pagaMesSeguinte: number };
  mod: { horasPorUnidade: number; salarioHora: number; encargosPct: number; horasFuncionarioMes: number };
  cif: { materiaisIndiretosHora: number; moiFixa: number; outrosFixos: number; depreciacaoFabril: number };
  despesas: {
    salariosAdm: number;
    aluguel: number;
    energia: number;
    materialEscritorio: number;
    viagens: number;
    outrasFixas: number;
    depreciacaoAdm: number;
    propagandaPct: number;
    comissaoPct: number;
  };
  capex: CapexItem[];
  emprestimos: EmprestimoItem[];
  /** Saldos de abertura — opcionais para compatibilidade. */
  abertura?: { caixaInicial: number; capitalSocial: number; imobilizadoInicial: number; aliquotaIR: number };
}

export const ABERTURA_PADRAO = { caixaInicial: 50000, capitalSocial: 100000, imobilizadoInicial: 36000, aliquotaIR: 24 };

export function parametrosPadrao(ano = new Date().getFullYear()): ParametrosPOB {
  return {
    vendas: {
      crescVolume: 25,
      crescPreco: 5,
      recebeMesmoMes: 60,
      recebeMesSeguinte: 40,
      quantidadeAnualBase: 12000,
      precoBase: 320,
      mesBase: 1,
      sazonalidade: Array.from({ length: 12 }, () => 100 / 12),
    },
    impostos: { pis: 1.65, cofins: 7.6, icms: 4 },
    producao: {
      capacidadeMensal: 1800,
      estoqueInicialPA: 100,
      estoqueFinalPAPct: 20,
      estoqueFinalPAAno: 150,
      mpPorUnidade: 2,
      estoqueFinalMPPct: 15,
      estoqueInicialMP: 200,
    },
    compras: { custoUnitarioMP: 60, pagaMesmoMes: 60, pagaMesSeguinte: 40 },
    mod: { horasPorUnidade: 5, salarioHora: 6, encargosPct: 80, horasFuncionarioMes: 160 },
    cif: { materiaisIndiretosHora: 1.5, moiFixa: 5000, outrosFixos: 2500, depreciacaoFabril: 300 },
    despesas: {
      salariosAdm: 8000,
      aluguel: 2000,
      energia: 400,
      materialEscritorio: 200,
      viagens: 500,
      outrasFixas: 300,
      depreciacaoAdm: 150,
      propagandaPct: 2,
      comissaoPct: 3,
    },
    capex: [
      { id: uid(), nome: "Máquina de produção", valor: 60000, mes: 3, vidaUtilMeses: 120, mesesPagamento: 6 },
    ],
    emprestimos: [
      {
        id: uid(),
        nome: "Empréstimo existente",
        tipo: "existente",
        valor: 50000,
        dataInicio: `${ano}-01`,
        mesContratacao: 1,
        jurosMensalPct: 1.5,
        modoAmortizacao: "valor",
        amortizacao: 2500,
      },
    ],
  };
}

export interface LinhaEmprestimo {
  mes: number;
  saldoInicial: number;
  juros: number;
  amortizacao: number;
  saldoFinal: number;
}

/** Evolução mês a mês (12 meses do cenário) — amortização constante (SAC). */
export function evolucaoEmprestimo(e: EmprestimoItem): LinhaEmprestimo[] {
  const inicio = e.tipo === "novo" ? Math.min(12, Math.max(1, e.mesContratacao)) : 1;
  const amortMensal =
    e.modoAmortizacao === "parcelas" ? (e.amortizacao > 0 ? e.valor / e.amortizacao : 0) : e.amortizacao;
  const linhas: LinhaEmprestimo[] = [];
  let saldo = 0;
  for (let m = 1; m <= 12; m++) {
    const saldoInicial = saldo;
    let juros = 0;
    let amort = 0;
    if (m === inicio) saldo = e.valor;
    if (m > inicio || (e.tipo === "existente" && m === inicio)) {
      const base = e.tipo === "existente" && m === inicio ? e.valor : saldoInicial;
      juros = (base * e.jurosMensalPct) / 100;
      amort = Math.min(base, Math.max(0, amortMensal));
      saldo = base - amort;
    }
    linhas.push({
      mes: m,
      saldoInicial: e.tipo === "existente" && m === 1 ? e.valor : saldoInicial,
      juros,
      amortizacao: amort,
      saldoFinal: saldo,
    });
  }
  return linhas;
}
