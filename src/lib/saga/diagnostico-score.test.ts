import { describe, expect, it } from "vitest";
import { avaliarIndicador, mediaScores, scorePonderado } from "./diagnostico-score";

describe("pontuação proporcional do diagnóstico", () => {
  it("varia dentro da faixa de atenção em vez de repetir 60", () => {
    expect(avaliarIndicador(0.2, 0.4, 0.2)).toEqual({ status: "atencao", score: 40 });
    expect(avaliarIndicador(0.3, 0.4, 0.2).score).toBeCloseTo(55);
    expect(avaliarIndicador(0.35, 0.4, 0.2).score).toBeCloseTo(62.5);
  });
  it("continua proporcional acima do limite saudável, sem dar 100 imediatamente", () => {
    expect(avaliarIndicador(0.4, 0.4, 0.2)).toEqual({ status: "bom", score: 70 });
    expect(avaliarIndicador(0.5, 0.4, 0.2).score).toBeCloseTo(85);
    expect(avaliarIndicador(0.6, 0.4, 0.2).score).toBeCloseTo(100);
  });
  it("varia também na faixa crítica", () => {
    expect(avaliarIndicador(0.1, 0.4, 0.2)).toEqual({ status: "ruim", score: 25 });
    expect(avaliarIndicador(0, 0.4, 0.2).score).toBeCloseTo(10);
  });
  it("inverte a direção para dívida, em que menos é melhor", () => {
    expect(avaliarIndicador(1, 0.5, 1, false)).toEqual({ status: "atencao", score: 40 });
    expect(avaliarIndicador(0.75, 0.5, 1, false).score).toBeCloseTo(55);
    expect(avaliarIndicador(0.5, 0.5, 1, false)).toEqual({ status: "bom", score: 70 });
    expect(avaliarIndicador(0.25, 0.5, 1, false).score).toBeCloseTo(85);
    expect(avaliarIndicador(1.25, 0.5, 1, false).score).toBeCloseTo(25);
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
    expect(avaliarIndicador(-10, 0.4, 0.2).score).toBe(0);
    expect(avaliarIndicador(10, 0.4, 0.2).score).toBe(100);
    expect(avaliarIndicador(10, 0.5, 1, false).score).toBe(0);
    expect(avaliarIndicador(-10, 0.5, 1, false).score).toBe(100);
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