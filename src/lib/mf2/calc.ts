import type { ModeloMF2, Produto, SugestoesNegocio, TipoNegocio } from "./types";
import { somaSazonalidade } from "./types";

/** Sugestões típicas por tipo de negócio (percentuais em decimal). */
export const SUGESTOES_NEGOCIO: Record<TipoNegocio, SugestoesNegocio> = {
  "Comércio/Varejo": {
    adiantamentoClientes: 0.05,
    adiantamentoFornecedores: 0.1,
    tributosRecuperaveis: 0.08,
  },
  Indústria: {
    adiantamentoClientes: 0.1,
    adiantamentoFornecedores: 0.15,
    tributosRecuperaveis: 0.12,
  },
  Serviços: {
    adiantamentoClientes: 0.15,
    adiantamentoFornecedores: 0.05,
    tributosRecuperaveis: 0.02,
  },
  Tecnologia: {
    adiantamentoClientes: 0.25,
    adiantamentoFornecedores: 0.05,
    tributosRecuperaveis: 0.01,
  },
  "Construção/Engenharia": {
    adiantamentoClientes: 0.3,
    adiantamentoFornecedores: 0.2,
    tributosRecuperaveis: 0.05,
  },
  "Educação/Treinamento": {
    adiantamentoClientes: 0.35,
    adiantamentoFornecedores: 0.03,
    tributosRecuperaveis: 0.01,
  },
  Saúde: {
    adiantamentoClientes: 0.08,
    adiantamentoFornecedores: 0.07,
    tributosRecuperaveis: 0.04,
  },
};

export const SGA_SUGERIDAS = [
  "Aluguel e condomínio",
  "Softwares e ferramentas",
  "Serviços de terceiros",
  "Internet e telefonia",
  "Água e energia",
  "Manutenção",
  "Seguros",
  "Materiais de escritório",
  "Viagens e representação",
  "Marketing institucional",
  "Despesas bancárias",
];

export interface ProjecaoProduto {
  produto: Produto;
  volumes: number[]; // 5 anos
  precos: number[]; // 5 anos
  receitas: number[]; // 5 anos
}

export function projetarProduto(p: Produto): ProjecaoProduto {
  const volumes: number[] = [p.volumeAno1 || 0];
  const precos: number[] = [p.precoAno1 || 0];
  for (let i = 0; i < 4; i++) {
    volumes.push(volumes[i] * (1 + (p.crescimentoVolume?.[i] ?? 0)));
    precos.push(precos[i] * (1 + (p.crescimentoPreco?.[i] ?? 0)));
  }
  return { produto: p, volumes, precos, receitas: volumes.map((v, i) => v * precos[i]) };
}

export function projetarReceita(modelo: ModeloMF2) {
  const porProduto = modelo.produtos.map(projetarProduto);
  const total = [0, 1, 2, 3, 4].map((i) =>
    porProduto.reduce((acc, pp) => acc + pp.receitas[i], 0),
  );
  return { porProduto, total };
}

/** Percentual de preenchimento do formulário de premissas (0..1). */
export function progressoPreenchimento(m: ModeloMF2): number {
  const checks: boolean[] = [
    !!m.nomeEmpresa?.trim(),
    !!m.dataInicioModelo,
    !!m.unidadeMonetaria,
    !!m.regimeTributario,
    !!m.tipoNegocio,
    m.premissasMacro.some((p) => p.ipca > 0 || p.selic > 0),
    m.produtos.length > 0,
    m.produtos.every((p) => p.nome.trim() && p.volumeAno1 > 0 && p.precoAno1 > 0) &&
      m.produtos.length > 0,
    Math.abs(somaSazonalidade(m.sazonalidade) - 1) < 0.0001,
    m.cargos.length > 0,
    m.custosVariaveisPercentual.length > 0 || m.custosVariaveisUnitarios.length > 0,
    m.custosFixos.length > 0,
    m.despesasFixasSga.length > 0,
    m.despesasVariaveisSga.length > 0,
    tributacaoPreenchida(m),
    m.capitalGiro.diasRecebimento > 0 ||
      m.capitalGiro.diasEstoque > 0 ||
      m.capitalGiro.diasPagamento > 0,
    m.caixaCapital.saldoCaixaInicial !== 0 ||
      m.caixaCapital.aportesReducaoCapital.some((v) => v !== 0),
    m.ativos.some((a) => a.investimentoPorAno.some((v) => v !== 0)),
    m.dividas.length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

function tributacaoPreenchida(m: ModeloMF2): boolean {
  const t = m.tributacao;
  if (t.regime === "Simples Nacional") return t.aliquotaDas > 0;
  return t.aliquotaPisCofins > 0 || t.aliquotaIcms > 0 || t.aliquotaIss > 0;
}
