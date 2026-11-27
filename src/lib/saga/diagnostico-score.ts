export type StatusDiagnostico = "bom" | "atencao" | "ruim" | "neutro";

/**
 * Curva logística contínua: 40 no limite de atenção e 70 no saudável.
 * A distância normalizada calibra a curva, sem notas aleatórias ou degraus.
 * Os extremos se aproximam de 0–100 gradualmente, sem saturação antecipada.
 * O semáforo conserva os limites financeiros; médias usam a precisão inteira.
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
  const distancia = (valor - atencao) / amplitude;
  const logitAtencao = Math.log(40 / 60);
  const logitBom = Math.log(70 / 30);
  const logit = logitAtencao + distancia * (logitBom - logitAtencao);
  // Avaliação estável também para valores muito distantes dos limites.
  const exponencial = Math.exp(logit < 0 ? logit : -logit);
  const score = valor === atencao ? 40 : valor === bom ? 70 : logit < 0
    ? 100 * exponencial / (1 + exponencial)
    : 100 / (1 + exponencial);
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