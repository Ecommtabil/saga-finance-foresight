import { describe, expect, it } from "vitest";
import { PREMISSAS_EXEMPLO } from "./premissas";
import { cascataNCG, faixaCobertura, resultadoDasPremissas } from "./apresentacao";

describe("apresentação da NCG", () => {
  it("conecta os saldos médios das premissas ao resultado", () => {
    const r = resultadoDasPremissas(PREMISSAS_EXEMPLO);
    expect(r.ncg.clientes).toBe(270000);
    expect(r.sobraFalta).toBeCloseTo(-160833.33, 1);
  });
  it("cobertura abaixo de 70% é crítica", () => { expect(faixaCobertura(0.69999)).toBe("critica"); });
  it("cobertura de 70% até menos de 100% é atenção", () => {
    expect(faixaCobertura(0.7)).toBe("atencao");
    expect(faixaCobertura(0.99999)).toBe("atencao");
  });
  it("cobertura a partir de 100% está coberta", () => {
    expect(faixaCobertura(1)).toBe("coberta");
    expect(faixaCobertura(1.5)).toBe("coberta");
  });
  it("a cascata conserva a soma da NCG e separa caixa e saldo final", () => {
    const r = resultadoDasPremissas(PREMISSAS_EXEMPLO);
    const dados = cascataNCG(r, PREMISSAS_EXEMPLO);
    expect(dados.slice(0, 6).reduce((s, c) => s + c.valor, 0)).toBeCloseTo(r.ncg.total);
    expect(dados[7].intervalo[1]).toBeCloseTo(r.capitalGiroTotal);
    expect(dados[9].valor - dados[8].valor).toBeCloseTo(dados[10].valor);
  });
});