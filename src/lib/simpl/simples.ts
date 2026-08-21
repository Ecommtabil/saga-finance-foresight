import type { AnexoSimples } from "./types";

interface Faixa {
  ate: number;
  aliquota: number;
  deduzir: number;
}

/** Tabelas oficiais do Simples Nacional (LC 123/2006, anexos I a V). */
export const TABELAS_SIMPLES: Record<AnexoSimples, Faixa[]> = {
  I: [
    { ate: 180000, aliquota: 0.04, deduzir: 0 },
    { ate: 360000, aliquota: 0.073, deduzir: 5940 },
    { ate: 720000, aliquota: 0.095, deduzir: 13860 },
    { ate: 1800000, aliquota: 0.107, deduzir: 22500 },
    { ate: 3600000, aliquota: 0.143, deduzir: 87300 },
    { ate: 4800000, aliquota: 0.19, deduzir: 378000 },
  ],
  II: [
    { ate: 180000, aliquota: 0.045, deduzir: 0 },
    { ate: 360000, aliquota: 0.078, deduzir: 5940 },
    { ate: 720000, aliquota: 0.1, deduzir: 13860 },
    { ate: 1800000, aliquota: 0.112, deduzir: 22500 },
    { ate: 3600000, aliquota: 0.147, deduzir: 85500 },
    { ate: 4800000, aliquota: 0.3, deduzir: 720000 },
  ],
  III: [
    { ate: 180000, aliquota: 0.06, deduzir: 0 },
    { ate: 360000, aliquota: 0.112, deduzir: 9360 },
    { ate: 720000, aliquota: 0.135, deduzir: 17640 },
    { ate: 1800000, aliquota: 0.16, deduzir: 35640 },
    { ate: 3600000, aliquota: 0.21, deduzir: 125640 },
    { ate: 4800000, aliquota: 0.33, deduzir: 648000 },
  ],
  IV: [
    { ate: 180000, aliquota: 0.045, deduzir: 0 },
    { ate: 360000, aliquota: 0.09, deduzir: 8100 },
    { ate: 720000, aliquota: 0.102, deduzir: 12420 },
    { ate: 1800000, aliquota: 0.14, deduzir: 39780 },
    { ate: 3600000, aliquota: 0.22, deduzir: 183780 },
    { ate: 4800000, aliquota: 0.33, deduzir: 828000 },
  ],
  V: [
    { ate: 180000, aliquota: 0.155, deduzir: 0 },
    { ate: 360000, aliquota: 0.18, deduzir: 4500 },
    { ate: 720000, aliquota: 0.195, deduzir: 9900 },
    { ate: 1800000, aliquota: 0.205, deduzir: 17100 },
    { ate: 3600000, aliquota: 0.23, deduzir: 62100 },
    { ate: 4800000, aliquota: 0.3055, deduzir: 540000 },
  ],
};

/** Alíquota efetiva = (RBT12 × alíquota nominal − parcela a deduzir) / RBT12. */
export function aliquotaEfetivaSimples(rbt12: number, anexo: AnexoSimples): number {
  if (rbt12 <= 0) return TABELAS_SIMPLES[anexo][0].aliquota;
  const tabela = TABELAS_SIMPLES[anexo];
  const faixa = tabela.find((f) => rbt12 <= f.ate) ?? tabela[tabela.length - 1];
  const efetiva = (rbt12 * faixa.aliquota - faixa.deduzir) / rbt12;
  return Math.max(0, efetiva);
}

export function faixaSimples(rbt12: number, anexo: AnexoSimples) {
  const tabela = TABELAS_SIMPLES[anexo];
  const idx = tabela.findIndex((f) => rbt12 <= f.ate);
  const i = idx === -1 ? tabela.length - 1 : idx;
  return { indice: i + 1, ...tabela[i] };
}
