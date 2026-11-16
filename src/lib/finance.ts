// Motor financeiro puro (sem React, sem DOM). Usado por todos os Estudos de Viabilidade.
// Convenção: fluxos[0] é o Ano 0 (não descontado); fluxos[t] é descontado por (1+taxa)^t.

/** VPL no padrão Excel: =VPL(taxa; Ano1..AnoN) + Ano0. */
export function npv(taxa: number, fluxos: number[]): number {
  let total = fluxos[0] ?? 0;
  for (let t = 1; t < fluxos.length; t++) total += fluxos[t] / Math.pow(1 + taxa, t);
  return total;
}

function temTrocaDeSinal(fluxos: number[]): boolean {
  let pos = false;
  let neg = false;
  for (const f of fluxos) {
    if (f > 0) pos = true;
    else if (f < 0) neg = true;
  }
  return pos && neg;
}

/** TIR por Newton-Raphson com fallback por bisseção. Retorna null sem troca de sinal ou sem convergência. */
export function irr(fluxos: number[], chute = 0.1): number | null {
  if (fluxos.length < 2 || !temTrocaDeSinal(fluxos)) return null;
  const f = (r: number) => npv(r, fluxos);
  const df = (r: number) => {
    let d = 0;
    for (let t = 1; t < fluxos.length; t++) d -= (t * fluxos[t]) / Math.pow(1 + r, t + 1);
    return d;
  };
  let r = chute;
  for (let i = 0; i < 100; i++) {
    const v = f(r);
    const d = df(r);
    if (!Number.isFinite(v) || !Number.isFinite(d) || d === 0) break;
    const novo = r - v / d;
    if (!Number.isFinite(novo) || novo <= -0.9999) break;
    if (Math.abs(novo - r) < 1e-10) return Math.abs(f(novo)) < 1e-4 ? novo : null;
    r = novo;
  }
  // Fallback: procura um intervalo com troca de sinal e aplica bisseção
  const pontos = [-0.99, -0.9, -0.75, -0.5, -0.25, 0, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1, 1.5, 2, 3, 5, 10, 50, 100];
  for (let i = 0; i < pontos.length - 1; i++) {
    const a = pontos[i];
    const b = pontos[i + 1];
    if (Math.sign(f(a)) !== Math.sign(f(b))) return bissecao(f, a, b);
  }
  return null;
}

/** Raiz de f em [a, b] por bisseção. Retorna null se não houver troca de sinal. */
export function bissecao(f: (x: number) => number, a: number, b: number, tol = 1e-9, maxIter = 300): number | null {
  let fa = f(a);
  const fb = f(b);
  if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (Math.sign(fa) === Math.sign(fb)) return null;
  let lo = a;
  let hi = b;
  for (let i = 0; i < maxIter; i++) {
    const m = (lo + hi) / 2;
    const fm = f(m);
    if (fm === 0 || (hi - lo) / 2 < tol * Math.max(1, Math.abs(m))) return m;
    if (Math.sign(fm) === Math.sign(fa)) {
      lo = m;
      fa = fm;
    } else hi = m;
  }
  return (lo + hi) / 2;
}

function payback(fluxos: number[]): number | null {
  if (!fluxos.length) return null;
  let acumulado = fluxos[0];
  if (acumulado >= 0) return 0;
  for (let t = 1; t < fluxos.length; t++) {
    const anterior = acumulado;
    acumulado += fluxos[t];
    if (acumulado >= 0) return t - 1 + -anterior / fluxos[t];
  }
  return null;
}

/** Anos até o acumulado ficar >= 0, com interpolação linear dentro do ano. */
export function paybackSimples(fluxos: number[]): number | null {
  return payback(fluxos);
}

/** Payback sobre os fluxos descontados à taxa. */
export function paybackDescontado(taxa: number, fluxos: number[]): number | null {
  return payback(fluxos.map((f, t) => f / Math.pow(1 + taxa, t)));
}

/** VP dos fluxos do Ano 1 a N dividido pelo investimento do Ano 0 (em módulo). */
export function indiceRentabilidade(taxa: number, fluxos: number[]): number | null {
  const inv = Math.abs(fluxos[0] ?? 0);
  if (inv === 0) return null;
  return (npv(taxa, fluxos) - (fluxos[0] ?? 0)) / inv;
}

/** Custo Anual Uniforme Equivalente: vpl × [taxa(1+taxa)^n] / [(1+taxa)^n − 1]. */
export function caue(taxa: number, n: number, vpl: number): number {
  if (n <= 0) return 0;
  if (taxa === 0) return vpl / n;
  const f = Math.pow(1 + taxa, n);
  return (vpl * (taxa * f)) / (f - 1);
}

export function fatorCrescimento(taxa: number, t: number): number {
  return Math.pow(1 + taxa, t);
}

// ---------- Formatação pt-BR ----------
const brlFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 });

const limparEspacos = (s: string) => s.replace(/\u00a0/g, " ");

/** R$ 1.234,56 (negativo com sinal). */
export function formatBRL(v: number): string {
  const n = Object.is(v, -0) || Math.abs(v) < 0.005 ? 0 : v;
  return limparEspacos(brlFmt.format(n));
}

/** Formato contábil: negativos entre parênteses, ex.: (R$ 12.000,00). */
export function formatBRLContabil(v: number): string {
  if (Math.abs(v) < 0.005) return formatBRL(0);
  return v < 0 ? `(${formatBRL(-v)})` : formatBRL(v);
}

/** Recebe fração (0,12) e devolve "12,00%". */
export function formatPct(v: number, casas = 2): string {
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })}%`;
}

/** Percentual sem zeros à direita: 12% / 35,1%. */
export function formatPctCurto(v: number, casasMax = 1): string {
  return `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: casasMax })}%`;
}

export function formatAnos(v: number): string {
  return `${v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} anos`;
}

export function formatNumero(v: number, casas = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Converte "R$ 1.234,56", "1234,56", "1.234" ou "1234.56" em número. */
export function parseBRL(texto: string): number {
  let s = String(texto ?? "").replace(/R\$/gi, "").replace(/[\s\u00a0]/g, "");
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  if (s.startsWith("-") || s.startsWith("−")) {
    negativo = true;
    s = s.slice(1);
  }
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return negativo ? -n : n;
}
