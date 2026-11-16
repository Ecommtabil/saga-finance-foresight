import { describe, expect, it } from "vitest";
import {
  bissecao, caue, fatorCrescimento, formatAnos, formatBRL, formatBRLContabil, formatPct,
  indiceRentabilidade, irr, npv, parseBRL, paybackDescontado, paybackSimples,
} from "./finance";

const fcl = [-300000, 126480, 126480, 126480, 126480, 216480];

describe("npv", () => {
  it("replica =VPL(taxa; Ano1..AnoN) + Ano0 (Ano 0 não descontado)", () => {
    expect(npv(0.12, fcl)).toBeCloseTo(207000.51, 2);
    expect(npv(0.1, [-100, 110])).toBeCloseTo(0, 10);
  });
});

describe("irr", () => {
  it("encontra a TIR do fluxo padrão", () => {
    expect(irr(fcl)!).toBeCloseTo(0.3515, 3);
    expect(irr([-100, 110])!).toBeCloseTo(0.1, 8);
  });
  it("retorna null sem troca de sinal", () => {
    expect(irr([100, 50, 20])).toBeNull();
    expect(irr([-100, -50])).toBeNull();
  });
  it("usa bisseção quando Newton não converge a partir do chute", () => {
    const r = irr([-1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100000], 50);
    expect(r).not.toBeNull();
    expect(npv(r!, [-1000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100000])).toBeCloseTo(0, 4);
  });
});

describe("payback", () => {
  it("simples com interpolação linear (2,37 anos)", () => {
    expect(paybackSimples(fcl)!).toBeCloseTo(2.372, 3);
  });
  it("descontado é maior que o simples", () => {
    const d = paybackDescontado(0.12, fcl)!;
    expect(d).toBeGreaterThan(2.372);
    expect(d).toBeCloseTo(2.958, 2);
  });
  it("retorna null se nunca recuperar", () => {
    expect(paybackSimples([-100, 10, 10])).toBeNull();
    expect(paybackDescontado(0.5, [-100, 60, 60])).toBeNull();
  });
});

describe("índice de rentabilidade, CAUE e fator", () => {
  it("IR = VP(1..N) / |Ano 0|", () => {
    expect(indiceRentabilidade(0.12, fcl)!).toBeCloseTo((207000.51 + 300000) / 300000, 4);
    expect(indiceRentabilidade(0.12, [0, 10])).toBeNull();
  });
  it("CAUE", () => {
    expect(caue(0.12, 5, -119909.2756)).toBeCloseTo(-33264, 2);
    expect(caue(0, 4, 100)).toBe(25);
  });
  it("fator de crescimento", () => {
    expect(fatorCrescimento(0.05, 2)).toBeCloseTo(1.1025, 10);
  });
  it("bisseção", () => {
    expect(bissecao((x) => x * x - 2, 0, 2)!).toBeCloseTo(Math.SQRT2, 8);
    expect(bissecao((x) => x * x + 1, 0, 2)).toBeNull();
  });
});

describe("formatação pt-BR", () => {
  it("moeda, contábil, percentual e anos", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
    expect(formatBRLContabil(-12000)).toBe("(R$ 12.000,00)");
    expect(formatPct(0.12)).toBe("12,00%");
    expect(formatAnos(2.37)).toBe("2,4 anos");
  });
  it("parseBRL", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRL("1.234")).toBe(1234);
    expect(parseBRL("1234.5")).toBe(1234.5);
    expect(parseBRL("(R$ 12.000,00)")).toBe(-12000);
    expect(parseBRL("abc")).toBe(0);
  });
});
