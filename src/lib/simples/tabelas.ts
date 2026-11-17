// Tabelas do Simples Nacional (LC 123/2006, vigentes em 2025).
// Percentuais guardados como número (4 = 4%). Nunca texto: a regra do teto do ISS é tratada em código.

export type AnexoId = "I" | "II" | "III" | "IV" | "V";
export type Tributo = "CPP" | "IRPJ" | "CSLL" | "COFINS" | "PIS" | "ICMS" | "IPI" | "ISS";
export type ColunaReceita = "integral" | "st" | "mono" | "stMono" | "semRet" | "comRet";

export interface FaixaTabela {
  aliquota: number; // % nominal
  deducao: number; // R$
  partilha: Partial<Record<Tributo, number>>; // % de repartição
}
export type TabelaAnexo = FaixaTabela[]; // 6 faixas
export type TabelasSimples = Record<AnexoId, TabelaAnexo>;

export const ANEXOS: AnexoId[] = ["I", "II", "III", "IV", "V"];
export const NOME_ANEXO: Record<AnexoId, string> = {
  I: "Anexo I – Comércio",
  II: "Anexo II – Indústria",
  III: "Anexo III – Serviços",
  IV: "Anexo IV – Serviços",
  V: "Anexo V – Serviços",
};
export const NOME_CURTO_ANEXO: Record<AnexoId, string> = { I: "Comércio", II: "Indústria", III: "Serviços", IV: "Serviços", V: "Serviços" };

export const TRIBUTOS_ANEXO: Record<AnexoId, Tributo[]> = {
  I: ["CPP", "CSLL", "ICMS", "IRPJ", "COFINS", "PIS"],
  II: ["CPP", "IPI", "CSLL", "ICMS", "IRPJ", "COFINS", "PIS"],
  III: ["CPP", "ISS", "CSLL", "IRPJ", "COFINS", "PIS"],
  IV: ["ISS", "CSLL", "IRPJ", "COFINS", "PIS"],
  V: ["CPP", "ISS", "CSLL", "IRPJ", "COFINS", "PIS"],
};
export const ORDEM_TRIBUTOS: Tributo[] = ["CPP", "IRPJ", "CSLL", "COFINS", "PIS", "ICMS", "IPI", "ISS"];

export const COLUNAS_ANEXO: Record<AnexoId, ColunaReceita[]> = {
  I: ["integral", "st", "mono", "stMono"],
  II: ["integral", "st", "mono", "stMono"],
  III: ["semRet", "comRet"],
  IV: ["semRet", "comRet"],
  V: ["semRet", "comRet"],
};
export const NOME_COLUNA: Record<ColunaReceita, string> = {
  integral: "Tributada integralmente",
  st: "ST de ICMS",
  mono: "Monofásico PIS/COFINS",
  stMono: "ST ICMS + monofásico",
  semRet: "Serviço sem retenção de ISS",
  comRet: "Serviço com retenção de ISS",
};
export const AJUDA_COLUNA: Record<ColunaReceita, string> = {
  integral: "Receita sem nenhuma exclusão: paga todos os tributos do DAS.",
  st: "Mercadorias com ICMS já recolhido por substituição tributária: o ICMS sai do DAS.",
  mono: "Mercadorias com PIS e COFINS monofásicos: PIS e COFINS saem do DAS.",
  stMono: "Mercadorias com ST de ICMS e PIS/COFINS monofásicos: os três saem do DAS.",
  semRet: "Serviços em que o ISS é pago no próprio DAS.",
  comRet: "Serviços com ISS retido pelo tomador: o ISS sai do DAS.",
};
/** Tributos excluídos do DAS em cada tipo de receita. */
export const EXCLUSOES_COLUNA: Record<ColunaReceita, Tributo[]> = {
  integral: [],
  st: ["ICMS"],
  mono: ["COFINS", "PIS"],
  stMono: ["ICMS", "COFINS", "PIS"],
  semRet: [],
  comRet: ["ISS"],
};
/** Coluna usada quando só existe o total do mês, sem segregação. */
export const COLUNA_PRINCIPAL: Record<AnexoId, ColunaReceita> = { I: "integral", II: "integral", III: "semRet", IV: "semRet", V: "semRet" };

/** Limites superiores das 6 faixas (RBT12). */
export const LIMITES_FAIXA = [180_000, 360_000, 720_000, 1_800_000, 3_600_000, 4_800_000];
export const TETO_SIMPLES = 4_800_000;
export const SUBLIMITE = 3_600_000;
export const TETO_ISS = 0.05;

type Linha = [number, number, number[]];
function montar(tributos: Tributo[], linhas: Linha[]): TabelaAnexo {
  return linhas.map(([aliquota, deducao, p]) => ({
    aliquota,
    deducao,
    partilha: Object.fromEntries(tributos.map((t, i) => [t, p[i] ?? 0])) as Partial<Record<Tributo, number>>,
  }));
}

export function tabelasPadrao(): TabelasSimples {
  const pI1 = [41.5, 3.5, 34, 5.5, 12.74, 2.76];
  const pI3 = [42, 3.5, 33.5, 5.5, 12.74, 2.76];
  const pII = [37.5, 7.5, 3.5, 32, 5.5, 11.51, 2.49];
  return {
    // CPP / CSLL / ICMS / IRPJ / COFINS / PIS
    I: montar(TRIBUTOS_ANEXO.I, [
      [4, 0, pI1], [7.3, 5940, pI1], [9.5, 13860, pI3], [10.7, 22500, pI3], [14.3, 87300, pI3],
      [19, 378000, [42.1, 10, 0, 13.5, 28.27, 6.13]],
    ]),
    // CPP / IPI / CSLL / ICMS / IRPJ / COFINS / PIS
    II: montar(TRIBUTOS_ANEXO.II, [
      [4.5, 0, pII], [7.8, 5940, pII], [10, 13860, pII], [11.2, 22500, pII], [14.7, 85500, pII],
      [30, 720000, [23.5, 35, 7.5, 0, 8.5, 20.96, 4.54]],
    ]),
    // CPP / ISS / CSLL / IRPJ / COFINS / PIS
    III: montar(TRIBUTOS_ANEXO.III, [
      [6, 0, [43.4, 33.5, 3.5, 4, 12.82, 2.78]],
      [11.2, 9360, [43.4, 32, 3.5, 4, 14.05, 3.05]],
      [13.5, 17640, [43.4, 32.5, 3.5, 4, 13.64, 2.96]],
      [16, 35640, [43.4, 32.5, 3.5, 4, 13.64, 2.96]],
      [21, 125640, [43.4, 33.5, 3.5, 4, 12.82, 2.78]],
      [33, 648000, [30.5, 0, 15, 35, 16.03, 3.47]],
    ]),
    // ISS / CSLL / IRPJ / COFINS / PIS
    IV: montar(TRIBUTOS_ANEXO.IV, [
      [4.5, 0, [44.5, 15.2, 18.8, 17.67, 3.83]],
      [9, 8100, [40, 15.2, 19.8, 20.55, 4.45]],
      [10.2, 12420, [40, 15.2, 20.8, 19.73, 4.27]],
      [14, 39780, [40, 19.2, 17.8, 18.9, 4.1]],
      [22, 183780, [40, 19.2, 18.8, 18.08, 3.92]],
      [33, 828000, [0, 21.5, 53.5, 20.55, 4.45]],
    ]),
    // CPP / ISS / CSLL / IRPJ / COFINS / PIS
    V: montar(TRIBUTOS_ANEXO.V, [
      [15.5, 0, [28.85, 14, 15, 25, 14.1, 3.05]],
      [18, 4500, [27.85, 17, 15, 23, 14.1, 3.05]],
      [19.5, 9900, [23.85, 19, 15, 24, 14.92, 3.23]],
      [20.5, 17100, [23.85, 21, 15, 21, 15.74, 3.41]],
      [23, 62100, [23.85, 23.5, 12.5, 23, 14.1, 3.05]],
      [30.5, 540000, [29.5, 0, 15.5, 35, 16.44, 3.56]],
    ]),
  };
}

export const ANO_TABELA_PADRAO = 2025;

/** Soma da partilha (%) de uma faixa. */
export function somaPartilha(f: FaixaTabela): number {
  return Object.values(f.partilha).reduce<number>((s, v) => s + (Number(v) || 0), 0);
}

/** Tabela vigente para o ano: a versão do próprio ano ou a mais recente anterior. */
export function tabelaParaAno(porAno: Record<string, TabelasSimples>, ano: number): { ano: number; tabelas: TabelasSimples } {
  const anos = Object.keys(porAno).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (anos.length === 0) return { ano: ANO_TABELA_PADRAO, tabelas: tabelasPadrao() };
  const anteriores = anos.filter((a) => a <= ano);
  const escolhido = anteriores.length ? anteriores[anteriores.length - 1] : anos[0];
  return { ano: escolhido, tabelas: porAno[String(escolhido)] };
}
