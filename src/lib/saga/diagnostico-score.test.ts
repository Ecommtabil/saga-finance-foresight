import { describe, expect, it } from "vitest";
import { avaliarIndicador, mediaScores, scorePonderado } from "./diagnostico-score";

describe("pontuação gradual do diagnóstico", () => {
  it("varia dentro da faixa de atenção em vez de repetir 60", () => {
    expect(avaliarIndicador(0.2, 0.4, 0.2)).toEqual({ status: "atencao", score: 40 });
    expect(avaliarIndicador(0.3, 0.4, 0.2).score).toBeCloseTo(55.5006, 4);
    expect(avaliarIndicador(0.35, 0.4, 0.2).score).toBeCloseTo(63.0441, 4);
  });
  it("continua proporcional acima do limite saudável, sem dar 100 imediatamente", () => {
    expect(avaliarIndicador(0.4, 0.4, 0.2)).toEqual({ status: "bom", score: 70 });
    expect(avaliarIndicador(0.5, 0.4, 0.2).score).toBeCloseTo(81.3616, 4);
    expect(avaliarIndicador(0.6, 0.4, 0.2).score).toBeCloseTo(89.0909, 4);
  });
  it("varia também na faixa crítica", () => {
    expect(avaliarIndicador(0.1, 0.4, 0.2).status).toBe("ruim");
    expect(avaliarIndicador(0.1, 0.4, 0.2).score).toBeCloseTo(26.2726, 4);
    expect(avaliarIndicador(0, 0.4, 0.2).score).toBeCloseTo(16, 4);
  });
  it("inverte a direção para dívida, em que menos é melhor", () => {
    expect(avaliarIndicador(1, 0.5, 1, false)).toEqual({ status: "atencao", score: 40 });
    expect(avaliarIndicador(0.75, 0.5, 1, false).score).toBeCloseTo(55.5006, 4);
    expect(avaliarIndicador(0.5, 0.5, 1, false)).toEqual({ status: "bom", score: 70 });
    expect(avaliarIndicador(0.25, 0.5, 1, false).score).toBeCloseTo(81.3616, 4);
    expect(avaliarIndicador(1.25, 0.5, 1, false).score).toBeCloseTo(26.2726, 4);
  });
  it("não tem saltos ao atravessar os limites das faixas", () => {
    for (const limite of [0.2, 0.4]) {
      const esquerda = avaliarIndicador(limite - 1e-8, 0.4, 0.2).score;
      const direita = avaliarIndicador(limite + 1e-8, 0.4, 0.2).score;
      expect(esquerda).not.toBeNull();
      expect(direita).not.toBeNull();
      if (esquerda === null || direita === null) throw new Error("Nota indisponível");
      expect(Math.abs(direita - esquerda)).toBeLessThan(0.00001);
    }
  });
  it("limita extremos a 0–100", () => {
    for (const [valor, bom, atencao, maiorMelhor] of [
      [-10, 0.4, 0.2, true], [10, 0.4, 0.2, true],
      [10, 0.5, 1, false], [-10, 0.5, 1, false],
    ] as const) {
      const { score } = avaliarIndicador(valor, bom, atencao, maiorMelhor);
      if (score === null) throw new Error("Nota indisponível");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
  it("diferencia desempenhos fortes que antes empatavam em 100, sem aleatoriedade", () => {
    const notas = [0.6, 0.7, 0.8].map((valor) => {
      const { score } = avaliarIndicador(valor, 0.4, 0.2);
      if (score === null) throw new Error("Nota indisponível");
      expect(score).toBeGreaterThan(70);
      expect(score).toBeLessThan(100);
      expect(avaliarIndicador(valor, 0.4, 0.2).score).toBe(score);
      return score;
    });
    expect(new Set(notas.map((nota) => nota.toFixed(1))).size).toBe(3);
    expect(notas).toEqual([...notas].sort((a, b) => a - b));
  });
  it("responde a pequenas mudanças sem arredondar o indicador antes de pontuar", () => {
    const primeira = avaliarIndicador(0.301, 0.4, 0.2).score;
    const segunda = avaliarIndicador(0.302, 0.4, 0.2).score;
    if (primeira === null || segunda === null) throw new Error("Nota indisponível");
    expect(segunda).toBeGreaterThan(primeira);
    expect(segunda - primeira).toBeLessThan(1);
  });
  it("exclui valores indisponíveis sem tratá-los como nota zero", () => {
    for (const valor of [NaN, Infinity, -Infinity]) {
      expect(avaliarIndicador(valor, 0.4, 0.2)).toEqual({ status: "neutro", score: null });
    }
    expect(mediaScores([{ score: null }, { score: 55 }, { score: 70 }])).toBe(62.5);
    expect(mediaScores([{ score: null }])).toBeNull();
  });
  it("mantém pesos e usa as notas proporcionais sem arredondar antes da média", () => {
    expect(scorePonderado([{ score: 55.25, peso: 34 }, { score: 85, peso: 33 },
      { score: null, peso: 33 }])).toBeCloseTo((55.25 * 34 + 85 * 33) / 67);
    expect(scorePonderado([{ score: 55, peso: 0 }])).toBeNull();
  });
  it("recusa limites iguais ou na direção errada", () => {
    expect(avaliarIndicador(1, 1, 1).score).toBeNull();
    expect(avaliarIndicador(1, 0.5, 1).score).toBeNull();
    expect(avaliarIndicador(1, 1, 0.5, false).score).toBeNull();
  });
});