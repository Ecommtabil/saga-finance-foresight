import type { Cenario, EmpresaSimpl } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function cenarioPadrao(nome = "Base"): Cenario {
  const horizonteAnos = 5;
  return {
    id: uid(),
    nome,
    premissas: {
      horizonteAnos,
      anoInicio: new Date().getFullYear(),
      mesInicio: 1,
      ipca: Array.from({ length: horizonteAnos }, () => 0.045),
      selic: Array.from({ length: horizonteAnos }, () => 0.105),
      reformaTributaria: false,
    },
    produtos: [
      {
        id: uid(),
        nome: "Produto / Serviço 1",
        volumeMes: 100,
        preco: 500,
        crescVolume: 0.1,
        crescPreco: 0.05,
        sazonalidade: Array.from({ length: 12 }, () => 1),
        iss: 0,
        icms: 0.18,
        pisCofins: 0.0925,
        ipi: 0,
        ibs: 0.177,
        cbs: 0.088,
        obs: "",
      },
    ],
    cargos: [
      {
        id: uid(),
        nome: "Equipe operacional",
        alocacao: "custo",
        qtd: 5,
        salario: 3000,
        encargos: 0.35,
        beneficios: 600,
        crescHeadcount: 0.1,
        obs: "",
      },
      {
        id: uid(),
        nome: "Administrativo",
        alocacao: "despesa",
        qtd: 2,
        salario: 6000,
        encargos: 0.35,
        beneficios: 900,
        crescHeadcount: 0.05,
        obs: "",
      },
    ],
    opex: [
      {
        id: uid(),
        descricao: "Aluguel e utilidades",
        classificacao: "despesa",
        tipo: "fixo",
        baseTipo: "receita",
        produtoId: "",
        valor: 8000,
        creditoTributario: 0,
        obs: "",
      },
      {
        id: uid(),
        descricao: "Matéria-prima / insumos",
        classificacao: "custo",
        tipo: "variavel",
        baseTipo: "receita",
        produtoId: "",
        valor: 0.3,
        creditoTributario: 0,
        obs: "",
      },
    ],
    capex: [
      {
        id: uid(),
        descricao: "Equipamentos",
        categoria: "imobilizado",
        valor: 200000,
        mes: 0,
        taxaAA: 0.1,
        obs: "",
      },
    ],
    dividas: [
      {
        id: uid(),
        descricao: "Capital de giro bancário",
        valor: 150000,
        mes: 0,
        prazoMeses: 36,
        jurosAA: 0.18,
        sistema: "price",
        obs: "",
      },
    ],
    aportes: [],
    capitalGiro: {
      pmr: 30,
      pmp: 30,
      pme: 20,
      adiantFornecedores: 0,
      adiantClientes: 0,
    },
    rotativo: { ativo: true, limite: 500000, jurosAA: 0.24, caixaMinimo: 20000 },
    valuation: {
      rf: 0.105,
      beta: 1.1,
      erp: 0.055,
      riscoPais: 0.02,
      riscoEspecifico: 0.03,
      spreadDivida: 0.05,
      pesoEquity: 0.7,
      gPerp: 0.04,
      obs: "",
    },
    caixaInicial: 100000,
    capitalInicial: 100000,
  };
}

export function empresaPadrao(nome = "Nova empresa"): EmpresaSimpl {
  const c = cenarioPadrao();
  return {
    id: uid(),
    nome,
    moeda: "R$",
    regime: "simples",
    anexoSimples: "I",
    presumidoBaseIRPJ: 0.08,
    presumidoBaseCSLL: 0.12,
    criadoEm: new Date().toISOString(),
    cenarios: [c],
    cenarioAtivoId: c.id,
  };
}

export function ajustarHorizonte(c: Cenario, anos: number): Cenario {
  const fill = (arr: number[], v: number) =>
    Array.from({ length: anos }, (_, i) => arr[i] ?? arr[arr.length - 1] ?? v);
  return {
    ...c,
    premissas: {
      ...c.premissas,
      horizonteAnos: anos,
      ipca: fill(c.premissas.ipca, 0.045),
      selic: fill(c.premissas.selic, 0.105),
    },
  };
}
