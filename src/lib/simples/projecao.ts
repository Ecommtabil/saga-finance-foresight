// Projeção da alíquota do próximo mês a partir dos meses fechados + prévia do faturamento do mês corrente.
// Usa o mesmo motor (rbt12ParaMes / calcularMesAnexo / calcularEmpresa) — nenhuma regra é duplicada aqui.
import {
  calcularEmpresa, calcularMesAnexo, faixaPorRbt12, rbt12ParaMes, receitaAbsoluta, receitaAnexoMes, receitaEmpresaMes,
  MES_CURTO, type DadosCalculo, type MesReceita, type Rbt12Mes, type ResultadoMes,
} from "./calculo";
import { COLUNAS_ANEXO, COLUNA_PRINCIPAL, LIMITES_FAIXA, type AnexoId, type TabelasSimples } from "./tabelas";

export interface EntradaProjecao {
  /** Mês corrente pelo índice absoluto (ano*12 + mês 0..11). */
  mesCorrente: number;
  /** Faturamento do mês corrente por anexo, já para o mês inteiro. */
  faturamento: Partial<Record<AnexoId, number>>;
}

export interface ProjecaoAnexo {
  anexo: AnexoId;
  /** Último mês fechado (com receita lançada) antes do mês corrente. */
  ultimo: ResultadoMes | null;
  /** Mês corrente: alíquota já definida pelo RBT12; DAS estimado com a prévia. */
  corrente: ResultadoMes;
  /** Próximo mês: alíquota projetada com o RBT12 que inclui a prévia. */
  proximo: ResultadoMes;
}

export interface PontoSerie { abs: number; tipo: "fechado" | "corrente" | "projetado"; ae: Partial<Record<AnexoId, number | null>> }

export interface ResultadoProjecao {
  mesCorrente: number;
  mesProximo: number;
  mesUltimo: number | null;
  faturamentoCorrente: number;
  rbt12Corrente: Rbt12Mes;
  rbt12Proximo: Rbt12Mes;
  faixaCorrente: number;
  faixaProximo: number;
  /** RBT12 corrente + faturamento corrente − mês que sai da janela = RBT12 do próximo mês (só na regra dos 12 meses). */
  ponte: { entra: number; sai: number; mesSai: number } | null;
  /** Quanto o RBT12 do próximo mês ainda pode crescer antes de mudar de faixa. */
  folgaFaixa: number | null;
  /** Faturamento máximo do mês corrente para o próximo mês ficar na mesma faixa do mês corrente. */
  limiteParaManterFaixa: number | null;
  anexos: ProjecaoAnexo[];
  dasUltimo: number | null;
  receitaUltimo: number | null;
  dasCorrenteEstimado: number;
  serie: PontoSerie[];
}

export const rotuloMes = (abs: number) => `${MES_CURTO[((abs % 12) + 12) % 12]}/${Math.floor(abs / 12)}`;
export const diasNoMes = (abs: number) => new Date(Math.floor(abs / 12), (abs % 12) + 1, 0).getDate();

/** Faturamento parcial (até o dia X) extrapolado para o mês inteiro pela média diária. */
export function extrapolarMes(valor: number, dia: number, dias: number): number {
  if (!(dia > 0) || !(valor > 0)) return Math.max(0, valor || 0);
  return (valor / Math.min(dia, dias)) * dias;
}

/** Último mês do ano da empresa com receita lançada, antes de `antesDe` (abs). */
export function ultimoMesFechado(d: DadosCalculo, antesDe = d.ano * 12 + 12): number | null {
  for (let abs = Math.min(antesDe - 1, d.ano * 12 + 11); abs >= d.ano * 12; abs--) {
    if (receitaEmpresaMes(d, abs - d.ano * 12) > 0) return abs;
  }
  return null;
}

/** Mês corrente sugerido: o mês seguinte ao último fechado (ou janeiro do ano da empresa). */
export function mesCorrentePadrao(d: DadosCalculo): number {
  const u = ultimoMesFechado(d);
  return u === null ? d.ano * 12 : u + 1;
}

/** Mantém a divisão por tipo de receita do mês de referência, escalada para o novo total. */
function receitasComMix(anexo: AnexoId, total: number, referencia: MesReceita | undefined): MesReceita {
  const colunas = COLUNAS_ANEXO[anexo];
  const totalRef = referencia ? colunas.reduce((s, c) => s + Math.max(0, referencia[c] ?? 0), 0) : 0;
  if (!(totalRef > 0)) return { [COLUNA_PRINCIPAL[anexo]]: total };
  const r: MesReceita = {};
  for (const c of colunas) r[c] = (total * Math.max(0, referencia![c] ?? 0)) / totalRef;
  return r;
}

export function projetarAliquota(d: DadosCalculo, tabelasPara: (ano: number) => TabelasSimples, e: EntradaProjecao): ResultadoProjecao {
  const corrente = e.mesCorrente;
  const proximo = corrente + 1;
  const fat = (a: AnexoId) => Math.max(0, Number(e.faturamento[a]) || 0);
  const faturamentoCorrente = d.anexos.reduce((s, a) => s + fat(a), 0);
  const receitaCom = (valor: number) => (abs: number) => (abs === corrente ? valor : receitaAbsoluta(d, abs));

  const rbt12Corrente = rbt12ParaMes(d, corrente, receitaCom(faturamentoCorrente));
  const rbt12Proximo = rbt12ParaMes(d, proximo, receitaCom(faturamentoCorrente));
  const faixaCorrente = faixaPorRbt12(rbt12Corrente.valor);
  const faixaProximo = faixaPorRbt12(rbt12Proximo.valor);

  const mesUltimo = ultimoMesFechado(d, corrente);
  const anual = calcularEmpresa(d, tabelasPara(d.ano));
  const idxUltimo = mesUltimo === null ? null : mesUltimo - d.ano * 12;

  const anexos: ProjecaoAnexo[] = d.anexos.map((a) => {
    const ultimo = idxUltimo === null ? null : anual.anexos[a]?.meses[idxUltimo] ?? null;
    const ref = idxUltimo !== null && receitaAnexoMes(d, a, idxUltimo) > 0 ? d.receitas[a]?.[idxUltimo] : undefined;
    const mesC = ((corrente % 12) + 12) % 12;
    const mesP = ((proximo % 12) + 12) % 12;
    return {
      anexo: a,
      ultimo,
      corrente: calcularMesAnexo(a, mesC, receitasComMix(a, fat(a), ref), rbt12Corrente, tabelasPara(Math.floor(corrente / 12))[a], d.inicioAtividade),
      proximo: calcularMesAnexo(a, mesP, undefined, rbt12Proximo, tabelasPara(Math.floor(proximo / 12))[a], d.inicioAtividade),
    };
  });

  const linear = rbt12Corrente.origem === "calculado" && rbt12Proximo.origem === "calculado";
  const sai = receitaAbsoluta(d, corrente - 12);
  const ponte = linear ? { entra: faturamentoCorrente, sai, mesSai: corrente - 12 } : null;
  const folgaFaixa = faixaProximo >= 1 && faixaProximo <= 5 ? LIMITES_FAIXA[faixaProximo - 1] - rbt12Proximo.valor : null;
  let limiteParaManterFaixa: number | null = null;
  if (rbt12Proximo.origem === "calculado" && faixaCorrente >= 1 && faixaCorrente <= 5) {
    const semPrevia = rbt12Proximo.valor - faturamentoCorrente;
    limiteParaManterFaixa = Math.max(0, LIMITES_FAIXA[faixaCorrente - 1] - semPrevia);
  }

  const serie: PontoSerie[] = [];
  for (let abs = d.ano * 12; abs < Math.min(corrente, d.ano * 12 + 12); abs++) {
    const i = abs - d.ano * 12;
    if (receitaEmpresaMes(d, i) <= 0) continue;
    const ae: PontoSerie["ae"] = {};
    for (const a of d.anexos) { const m = anual.anexos[a]?.meses[i]; ae[a] = m?.calculado ? m.ae : null; }
    serie.push({ abs, tipo: "fechado", ae });
  }
  serie.push({ abs: corrente, tipo: "corrente", ae: Object.fromEntries(anexos.map((x) => [x.anexo, x.corrente.calculado ? x.corrente.ae : null])) });
  serie.push({ abs: proximo, tipo: "projetado", ae: Object.fromEntries(anexos.map((x) => [x.anexo, x.proximo.calculado ? x.proximo.ae : null])) });

  return {
    mesCorrente: corrente, mesProximo: proximo, mesUltimo,
    faturamentoCorrente, rbt12Corrente, rbt12Proximo, faixaCorrente, faixaProximo,
    ponte, folgaFaixa, limiteParaManterFaixa, anexos,
    dasUltimo: idxUltimo === null ? null : anual.consolidado.dasMensal[idxUltimo].total,
    receitaUltimo: idxUltimo === null ? null : anual.consolidado.receitaMensal[idxUltimo],
    dasCorrenteEstimado: anexos.reduce((s, x) => s + x.corrente.totalDas, 0),
    serie,
  };
}
