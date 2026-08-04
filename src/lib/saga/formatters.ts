export function fmtNum(n: number | null | undefined, decimals = 0): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const abs = Math.abs(n);
  const s = abs.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return n < 0 ? `(${s})` : s;
}

export function fmtMoney(n: number | null | undefined, moeda = "R$"): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${moeda} ${fmtNum(n, 0)}`;
}

export function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${(n * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
}

/** Percentual para tabelas: milhar, 1 casa decimal e negativos entre parênteses. */
export function fmtPctTable(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  const s = `${(Math.abs(n) * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`;
  return n < 0 ? `(${s})` : s;
}

export function fmtMult(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined || !isFinite(n)) return "—";
  return `${n.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}x`;
}

export function safeDiv(a: number, b: number): number {
  if (!b || !isFinite(b)) return 0;
  return a / b;
}