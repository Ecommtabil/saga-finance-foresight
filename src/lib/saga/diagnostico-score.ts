export type StatusDiagnostico = "bom" | "atencao" | "ruim" | "neutro";

/**
 * Escala contínua: 40 no limite de atenção e 70 no limite saudável.
 * A distância entre esses limites vale 30 pontos também fora da faixa.
 * A nota é limitada a 0–100; o semáforo conserva os limites financeiros.
 */
export function avaliarIndicador(
  valor: number,
  bom: number,
  atencao: number,
  maiorMelhor = true,
): { status: StatusDiagnostico; score: number | null } {
  const amplitude = bom - atencao;
  if (
    !Number.isFinite(valor) || !Number.isFinite(bom) || !Number.isFinite(atencao) ||
    (maiorMelhor ? amplitude <= 0 : amplitude >= 0)
  ) return { status: "neutro", score: null };

  const status = maiorMelhor
    ? valor >= bom ? "bom" : valor >= atencao ? "atencao" : "ruim"
    : valor <= bom ? "bom" : valor <= atencao ? "atencao" : "ruim";
  const score = Math.max(0, Math.min(100, 40 + 30 * ((valor - atencao) / amplitude)));
  return { status, score };
}

export function mediaScores(cards: { score: number | null }[]): number | null {
  const scores = cards.map((c) => c.score)
    .filter((score): score is number => score !== null && Number.isFinite(score));
  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

export function scorePonderado(grupos: { score: number | null; peso: number }[]): number | null {
  const ativos = grupos.filter((g): g is { score: number; peso: number } =>
    g.score !== null && Number.isFinite(g.score) && Number.isFinite(g.peso) && g.peso > 0);
  const pesoTotal = ativos.reduce((sum, grupo) => sum + grupo.peso, 0);
  if (pesoTotal === 0) return null;
  return ativos.reduce((sum, grupo) => sum + grupo.score * grupo.peso, 0) / pesoTotal;
}