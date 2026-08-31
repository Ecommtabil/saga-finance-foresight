import type {
  ModeloMF2,
  Moeda,
  RegimeTributario,
  Serie5,
  TipoNegocio,
} from "./types";

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const zeros5 = (): Serie5 => [0, 0, 0, 0, 0];

export function tributacaoPadrao(regime: RegimeTributario) {
  return {
    regime,
    aliquotaDas: regime === "Simples Nacional" ? 0.06 : 0,
    aliquotaIcms: 0,
    aliquotaIss: 0,
    aliquotaIpi: 0,
    aliquotaPisCofins: regime === "Lucro Real" ? 0.0925 : 0.0365,
    aliquotaIrpjCsll: regime === "Lucro Real" ? 0.34 : 0.0308,
    percentualCreditosTributarios: 0,
  };
}

export function modeloPadrao(dados: {
  nomeEmpresa: string;
  unidadeMonetaria: Moeda;
  regimeTributario: RegimeTributario;
  tipoNegocio: TipoNegocio;
  dataInicioModelo: string;
}): ModeloMF2 {
  return {
    id: uid(),
    ...dados,
    createdAt: new Date().toISOString(),
    premissasMacro: [1, 2, 3, 4, 5].map((ano) => ({ ano, ipca: 0.045, selic: 0.1 })),
    produtos: [],
    sazonalidade: Array.from({ length: 12 }, (_, i) => ({
      mes: i + 1,
      percentual: 1 / 12,
    })),
    cargos: [],
    custosVariaveisPercentual: [],
    custosVariaveisUnitarios: [],
    custosFixos: [],
    despesasFixasSga: [],
    despesasVariaveisSga: [],
    tributacao: tributacaoPadrao(dados.regimeTributario),
    capitalGiro: { diasRecebimento: 30, diasEstoque: 0, diasPagamento: 30 },
    caixaCapital: { saldoCaixaInicial: 0, aportesReducaoCapital: zeros5() },
    ativos: [],
    dividas: [],
  };
}
