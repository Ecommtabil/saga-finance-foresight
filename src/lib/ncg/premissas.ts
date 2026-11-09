// Tipos e dados da aba "1. Premissas" da Calculadora de NCG – Simplificada

export type SegmentoNCG = "comercio" | "varejo" | "industria";

export interface SaldoConta {
  inicial: number;
  final: number;
}

export interface PremissasNCG {
  segmento: SegmentoNCG;
  dataInicial: string; // ISO yyyy-mm-dd ("" = não informada)
  dataFinal: string;
  diasManual: boolean;
  diasInformados: number;
  vendasBrutas: number;
  cmv: number;
  compras: number;
  despesasFixas: number;
  saldos: Record<string, SaldoConta>;
  prazoDespesas: number; // dias
  reservaMeses: number;
  caixaDisponivel: number;
}

export const CONTAS_PRINCIPAIS = [
  {
    chave: "clientes",
    rotulo: "Clientes / duplicatas a receber",
    tooltip: "Inclua recebíveis de cartão",
  },
  { chave: "estoques", rotulo: "Estoques", tooltip: "" },
  {
    chave: "fornecedores",
    rotulo: "Fornecedores – só mercadorias/insumos",
    tooltip: "Fora: imobilizado, serviços, empréstimos",
  },
] as const;

export const CONTAS_OPCIONAIS_ATIVO = [
  { chave: "impostosRecuperar", rotulo: "Impostos a recuperar", tooltip: "" },
  { chave: "adiantamentosFornecedores", rotulo: "Adiantamentos a fornecedores", tooltip: "" },
  { chave: "despesasAntecipadas", rotulo: "Despesas antecipadas", tooltip: "" },
] as const;

export const CONTAS_OPCIONAIS_PASSIVO = [
  { chave: "impostosRecolher", rotulo: "Impostos sobre vendas a recolher", tooltip: "" },
  { chave: "adiantamentosClientes", rotulo: "Adiantamentos de clientes", tooltip: "" },
  {
    chave: "provisoes",
    rotulo: "Provisões de férias, 13º e encargos",
    tooltip: "Não inclua a folha do mês – já entra pelo prazo",
  },
] as const;

const saldosZerados = (): Record<string, SaldoConta> => {
  const todas = [
    ...CONTAS_PRINCIPAIS,
    ...CONTAS_OPCIONAIS_ATIVO,
    ...CONTAS_OPCIONAIS_PASSIVO,
  ];
  return Object.fromEntries(todas.map((c) => [c.chave, { inicial: 0, final: 0 }]));
};

export const PREMISSAS_VAZIAS: PremissasNCG = {
  segmento: "comercio",
  dataInicial: "",
  dataFinal: "",
  diasManual: false,
  diasInformados: 0,
  vendasBrutas: 0,
  cmv: 0,
  compras: 0,
  despesasFixas: 0,
  saldos: saldosZerados(),
  prazoDespesas: 20,
  reservaMeses: 1,
  caixaDisponivel: 0,
};

export const PREMISSAS_EXEMPLO: PremissasNCG = {
  ...PREMISSAS_VAZIAS,
  diasManual: true,
  diasInformados: 90,
  vendasBrutas: 540000,
  cmv: 315000,
  compras: 315000,
  despesasFixas: 210000,
  saldos: {
    ...saldosZerados(),
    clientes: { inicial: 250000, final: 290000 },
    estoques: { inicial: 100000, final: 110000 },
    fornecedores: { inicial: 85000, final: 90000 },
  },
  prazoDespesas: 20,
  reservaMeses: 1,
  caixaDisponivel: 150000,
};

/** Dias do período (inclusive). Retorna 0 se datas inválidas ou invertidas. */
export function diasDoPeriodo(p: PremissasNCG): number {
  if (p.diasManual) return Math.max(0, Math.round(p.diasInformados));
  if (!p.dataInicial || !p.dataFinal) return 0;
  const ini = new Date(p.dataInicial + "T00:00:00");
  const fim = new Date(p.dataFinal + "T00:00:00");
  if (isNaN(ini.getTime()) || isNaN(fim.getTime())) return 0;
  const diff = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

export function saldoMedio(s: SaldoConta): number {
  return (s.inicial + s.final) / 2;
}

const fmtMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatarMoeda(v: number): string {
  return fmtMoeda.format(v);
}

/** Converte texto pt-BR ("1.234,56") em número. */
export function parseMoeda(texto: string): number {
  const limpo = texto.replace(/[^\d.,-]/g, "");
  if (!limpo) return 0;
  // remove separador de milhar e troca vírgula decimal por ponto
  const normalizado = limpo.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(normalizado);
  return isNaN(n) ? 0 : n;
}

/** Formata número para edição ("1234,56"). */
export function formatarEditavel(v: number): string {
  if (!v) return "";
  return v.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
