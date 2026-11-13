// Estatística pura do Estudo de Volatilidade (sem dependências de navegador).

export interface LimitesCV { baixo: number; moderado: number }
export type ClasseCV = "baixa" | "moderada" | "alta";

export interface Estatisticas {
  n: number;
  media: number;
  mediana: number;
  minimo: number;
  maximo: number;
  amplitude: number;
  desvio: number; // amostral (STDEV.S, divisor n−1)
  cv: number; // desvio / média
  moda: number[] | null; // null = sem moda
  assimetria: number | null; // SKEW do Excel (n ≥ 3)
  curtose: number | null; // KURT do Excel (n ≥ 4)
  jarqueBera: number | null;
  pNormalidade: number | null;
  aproxNormal: boolean | null;
  inclinacao: number; // R$ por mês (regressão linear)
  tendenciaMensal: number; // inclinação / média
}

export const LIMITES_CV_PADRAO: LimitesCV = { baixo: 0.1, moderado: 0.2 };

export function media(v: number[]): number {
  return v.length ? v.reduce((s, x) => s + x, 0) / v.length : 0;
}

export function mediana(v: number[]): number {
  if (!v.length) return 0;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

/** Desvio padrão amostral (STDEV.S). */
export function desvioAmostral(v: number[]): number {
  if (v.length < 2) return 0;
  const m = media(v);
  return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / (v.length - 1));
}

export function moda(v: number[]): number[] | null {
  const cont = new Map<number, number>();
  for (const x of v) {
    const k = Math.round(x * 100) / 100;
    cont.set(k, (cont.get(k) ?? 0) + 1);
  }
  const max = Math.max(0, ...cont.values());
  if (max < 2) return null;
  return [...cont.entries()].filter(([, c]) => c === max).map(([k]) => k).sort((a, b) => a - b);
}

/** Assimetria amostral ajustada (equivalente a SKEW do Excel). */
export function assimetria(v: number[]): number | null {
  const n = v.length;
  const s = desvioAmostral(v);
  if (n < 3 || s === 0) return null;
  const m = media(v);
  const soma = v.reduce((t, x) => t + ((x - m) / s) ** 3, 0);
  return (n / ((n - 1) * (n - 2))) * soma;
}

/** Curtose em excesso amostral (equivalente a KURT do Excel). */
export function curtose(v: number[]): number | null {
  const n = v.length;
  const s = desvioAmostral(v);
  if (n < 4 || s === 0) return null;
  const m = media(v);
  const soma = v.reduce((t, x) => t + ((x - m) / s) ** 4, 0);
  return ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * soma - (3 * (n - 1) ** 2) / ((n - 2) * (n - 3));
}

/** Teste de Jarque-Bera (momentos populacionais); p-valor pela qui-quadrado com 2 g.l. */
export function jarqueBera(v: number[]): { jb: number; p: number } | null {
  const n = v.length;
  if (n < 3) return null;
  const m = media(v);
  const m2 = v.reduce((t, x) => t + (x - m) ** 2, 0) / n;
  if (m2 === 0) return null;
  const m3 = v.reduce((t, x) => t + (x - m) ** 3, 0) / n;
  const m4 = v.reduce((t, x) => t + (x - m) ** 4, 0) / n;
  const s = m3 / m2 ** 1.5;
  const k = m4 / m2 ** 2 - 3;
  const jb = (n / 6) * (s ** 2 + k ** 2 / 4);
  return { jb, p: Math.exp(-jb / 2) };
}

/** Regressão linear simples y = a + b·x, com x = 0, 1, 2… */
export function inclinacao(v: number[]): number {
  const n = v.length;
  if (n < 2) return 0;
  const mx = (n - 1) / 2;
  const my = media(v);
  let num = 0;
  let den = 0;
  v.forEach((y, x) => { num += (x - mx) * (y - my); den += (x - mx) ** 2; });
  return den ? num / den : 0;
}

export function classificarCV(cv: number, l: LimitesCV = LIMITES_CV_PADRAO): ClasseCV {
  if (cv <= l.baixo) return "baixa";
  if (cv <= l.moderado) return "moderada";
  return "alta";
}

export const ROTULO_CLASSE: Record<ClasseCV, string> = {
  baixa: "Baixa volatilidade",
  moderada: "Volatilidade moderada",
  alta: "Alta volatilidade",
};

export function estatisticas(v: number[]): Estatisticas {
  const n = v.length;
  const m = media(v);
  const s = desvioAmostral(v);
  const minimo = n ? Math.min(...v) : 0;
  const maximo = n ? Math.max(...v) : 0;
  const jb = jarqueBera(v);
  const b = inclinacao(v);
  return {
    n, media: m, mediana: mediana(v), minimo, maximo, amplitude: maximo - minimo,
    desvio: s, cv: m !== 0 ? s / Math.abs(m) : 0, moda: moda(v),
    assimetria: assimetria(v), curtose: curtose(v),
    jarqueBera: jb?.jb ?? null, pNormalidade: jb?.p ?? null, aproxNormal: jb ? jb.p >= 0.05 : null,
    inclinacao: b, tendenciaMensal: m !== 0 ? b / Math.abs(m) : 0,
  };
}

// ---------- Distribuição normal ----------

export function pdfNormal(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

/** Função erro (Abramowitz-Stegun 7.1.26 refinada por série para |x| pequeno). */
function erf(x: number): number {
  const sinal = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  if (a < 2.5) {
    // série de Taylor: precisão ~1e-12
    let soma = a, termo = a;
    for (let k = 1; k < 80; k++) {
      termo *= (-a * a) / k;
      const inc = termo / (2 * k + 1);
      soma += inc;
      if (Math.abs(inc) < 1e-16) break;
    }
    return sinal * (2 / Math.sqrt(Math.PI)) * soma;
  }
  // fração contínua para erfc em |x| grande
  let f = 0;
  for (let k = 60; k >= 1; k--) f = (k / 2) / (a + f);
  const erfc = Math.exp(-a * a) / Math.sqrt(Math.PI) / (a + f);
  return sinal * (1 - erfc);
}

export function cdfNormal(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) return x < mu ? 0 : 1;
  return 0.5 * (1 + erf((x - mu) / (sigma * Math.SQRT2)));
}

/** Inversa da normal padrão (algoritmo de Acklam, erro relativo < 1,2e-9). */
export function inversaNormalPadrao(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export function inversaNormal(p: number, mu: number, sigma: number): number {
  return mu + sigma * inversaNormalPadrao(p);
}

/** Probabilidade de ficar abaixo de x. */
export function probAbaixo(x: number, mu: number, sigma: number): number {
  return cdfNormal(x, mu, sigma);
}

/** Probabilidade de ficar entre a e b (ordem indiferente). */
export function probEntre(a: number, b: number, mu: number, sigma: number): number {
  const [lo, hi] = a <= b ? [a, b] : [b, a];
  return cdfNormal(hi, mu, sigma) - cdfNormal(lo, mu, sigma);
}

/** Valor que tem `confianca` de chance de ser atingido ou superado (piso de segurança). */
export function pisoSeguranca(confianca: number, mu: number, sigma: number): number {
  return inversaNormal(1 - confianca, mu, sigma);
}

// ---------- Faixas de probabilidade (regra empírica) ----------

export const REGRA_EMPIRICA = { um: 0.6827, umDois: 0.1359, doisTres: 0.0214, alemTres: 0.0013 } as const;

export interface FaixaProbabilidade {
  rotulo: string; // +3DP … −3DP
  k: number; // nível em desvios
  nivel: number; // média + k·DP
  inferior: number;
  superior: number;
  probabilidade: number; // da faixa
  acumulada: number; // P(X ≤ nível)
}

/**
 * Tabela simétrica por série. Cada linha ±k cobre a faixa entre (k−1)·DP e k·DP do seu lado;
 * a linha Média resume o intervalo central ±1DP. Cada série usa sua própria média e DP.
 */
export function faixasProbabilidade(mu: number, sigma: number): FaixaProbabilidade[] {
  const acum: Record<number, number> = { 3: 0.9987, 2: 0.9772, 1: 0.8413, 0: 0.5, [-1]: 0.1587, [-2]: 0.0228, [-3]: 0.0013 };
  const metade = REGRA_EMPIRICA.um / 2;
  const prob: Record<number, number> = { 3: REGRA_EMPIRICA.doisTres, 2: REGRA_EMPIRICA.umDois, 1: metade, 0: REGRA_EMPIRICA.um, [-1]: metade, [-2]: REGRA_EMPIRICA.umDois, [-3]: REGRA_EMPIRICA.doisTres };
  return [3, 2, 1, 0, -1, -2, -3].map(k => {
    const nivel = mu + k * sigma;
    const [inferior, superior] = k === 0
      ? [mu - sigma, mu + sigma]
      : k > 0 ? [mu + (k - 1) * sigma, nivel] : [nivel, mu + (k + 1) * sigma];
    return {
      rotulo: k === 0 ? "Média" : `${k > 0 ? "+" : "−"}${Math.abs(k)}DP`,
      k, nivel, inferior, superior, probabilidade: prob[k], acumulada: acum[k],
    };
  });
}

// ---------- Curva e histograma ----------

export interface ParametrosSerie { id: string; media: number; desvio: number }

/** Eixo X comum: do menor (média − 3DP) ao maior (média + 3DP) entre as séries. */
export function eixoCurva(series: ParametrosSerie[]): { min: number; max: number } | null {
  const validas = series.filter(s => s.desvio > 0);
  if (!validas.length) return null;
  return {
    min: Math.min(...validas.map(s => s.media - 3 * s.desvio)),
    max: Math.max(...validas.map(s => s.media + 3 * s.desvio)),
  };
}

export function pontosCurva(series: ParametrosSerie[], n = 200, normalizar = false): Array<Record<string, number>> {
  const eixo = eixoCurva(series);
  if (!eixo) return [];
  const pts = Math.max(2, Math.round(n));
  const passo = (eixo.max - eixo.min) / (pts - 1);
  return Array.from({ length: pts }, (_, i) => {
    const x = eixo.min + i * passo;
    const ponto: Record<string, number> = { x };
    for (const s of series) {
      if (s.desvio <= 0) continue;
      const pico = pdfNormal(s.media, s.media, s.desvio);
      ponto[s.id] = normalizar ? pdfNormal(x, s.media, s.desvio) / pico : pdfNormal(x, s.media, s.desvio);
    }
    return ponto;
  });
}

export interface ClasseHistograma { inicio: number; fim: number; centro: number; contagem: number; esperado: number }

/** Histograma pela regra de Sturges, com a contagem esperada pela normal teórica. */
export function histograma(v: number[], mu: number, sigma: number): ClasseHistograma[] {
  if (!v.length) return [];
  const min = Math.min(...v);
  const max = Math.max(...v);
  const k = Math.max(3, Math.ceil(Math.log2(v.length) + 1));
  const largura = max > min ? (max - min) / k : Math.max(1, Math.abs(min) * 0.1);
  return Array.from({ length: k }, (_, i) => {
    const inicio = min + i * largura;
    const fim = inicio + largura;
    const contagem = v.filter(x => (i === k - 1 ? x >= inicio && x <= fim + 1e-9 : x >= inicio && x < fim)).length;
    return { inicio, fim, centro: (inicio + fim) / 2, contagem, esperado: sigma > 0 ? probEntre(inicio, fim, mu, sigma) * v.length : 0 };
  });
}

/** Índices dos valores fora de ±k·DP. */
export function foraDeBanda(v: number[], mu: number, sigma: number, k = 2): number[] {
  if (sigma <= 0) return [];
  return v.flatMap((x, i) => (Math.abs(x - mu) > k * sigma ? [i] : []));
}
