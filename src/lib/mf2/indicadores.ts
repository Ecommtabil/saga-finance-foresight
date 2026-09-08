import type { LinhaMes, ResultadoProjecao } from "./engine";

export interface IndicadorMes {
  rotulo: string;
  indice: number;
  ano: number;
  // Endividamento
  dividaBruta: number;
  caixa: number;
  dividaLiquida: number;
  ebitda12m: number;
  dividaLiquidaEbitda: number | null;
  // Rentabilidade
  lucro12m: number;
  patrimonioLiquido: number;
  ativoTotal: number;
  roe: number | null;
  roa: number | null;
  // Capital de giro
  ativosGiro: number;
  passivosGiro: number;
  capitalGiroLiquido: number;
  cglSobreReceita: number | null;
  // Margem de contribuição / ponto de equilíbrio
  receitaLiquida: number;
  custosVariaveisTotais: number;
  margemContribuicao: number;
  margemContribuicaoPct: number | null;
  custosFixosTotais: number;
  pontoEquilibrioValor: number | null;
  pontoEquilibrioVolume: number | null;
  volume: number;
  precoMedio: number | null;
  coberturaPE: number | null; // receita líquida / ponto de equilíbrio
}

function janela12(meses: LinhaMes[], i: number, f: (l: LinhaMes) => number): number {
  let soma = 0;
  for (let k = Math.max(0, i - 11); k <= i; k++) soma += f(meses[k]);
  const n = i - Math.max(0, i - 11) + 1;
  // anualiza quando ainda não há 12 meses de histórico
  return n === 12 ? soma : (soma / n) * 12;
}

const div = (a: number, b: number) => (Math.abs(b) < 1e-9 ? null : a / b);

export function calcularIndicadores(projecao: ResultadoProjecao): IndicadorMes[] {
  const meses = projecao.meses;
  return meses.map((l, i) => {
    const dividaBruta = l.dividaCurtoPrazo + l.dividaLongoPrazo + l.saldoRevolvente;
    const caixa = l.caixaFinal;
    const ebitda12m = janela12(meses, i, (x) => x.ebitda);
    const lucro12m = janela12(meses, i, (x) => x.lucroLiquido);

    const ativosGiro = l.contasReceber + l.estoques + l.tributosRecuperar + l.adiantFornecedores;
    const passivosGiro =
      l.contasPagar + l.obrigacoesTributarias + l.obrigacoesTrabalhistas + l.adiantClientes;

    const custosVariaveisTotais = l.custosVariaveis + l.despesasVariaveisSga;
    const margemContribuicao = l.receitaLiquida - custosVariaveisTotais;
    const mcPct = div(margemContribuicao, l.receitaLiquida);
    const custosFixosTotais =
      l.custoPessoal + l.custosFixos + l.despesaPessoal + l.despesasFixasSga + l.depreciacao;
    const pe = mcPct && mcPct > 0 ? custosFixosTotais / mcPct : null;
    const precoMedio = div(l.receitaBruta, l.volumeTotal);

    return {
      rotulo: l.rotulo,
      indice: l.indice,
      ano: l.ano,
      dividaBruta,
      caixa,
      dividaLiquida: dividaBruta - caixa,
      ebitda12m,
      dividaLiquidaEbitda: ebitda12m > 0 ? (dividaBruta - caixa) / ebitda12m : null,
      lucro12m,
      patrimonioLiquido: l.patrimonioLiquido,
      ativoTotal: l.ativoTotal,
      roe: div(lucro12m, l.patrimonioLiquido),
      roa: div(lucro12m, l.ativoTotal),
      ativosGiro,
      passivosGiro,
      capitalGiroLiquido: ativosGiro - passivosGiro,
      cglSobreReceita: div(ativosGiro - passivosGiro, l.receitaLiquida),
      receitaLiquida: l.receitaLiquida,
      custosVariaveisTotais,
      margemContribuicao,
      margemContribuicaoPct: mcPct,
      custosFixosTotais,
      pontoEquilibrioValor: pe,
      pontoEquilibrioVolume: pe && precoMedio ? pe / precoMedio : null,
      volume: l.volumeTotal,
      precoMedio,
      coberturaPE: pe ? l.receitaLiquida / pe : null,
    };
  });
}
