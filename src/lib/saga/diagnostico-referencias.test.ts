import { describe, expect, it } from "vitest";
import { avaliarIndicador } from "./diagnostico-score";
import {
  INDICADORES_DIAGNOSTICO, avaliarReferencia, converterLimite,
  normalizarReferencias, referenciasPadrao, validarLimites,
} from "./diagnostico-referencias";

describe("referências parametrizadas do diagnóstico", () => {
  it("preserva as referências anteriores dos 12 indicadores ao iniciar", () => {
    const referencias = referenciasPadrao();
    expect(Object.keys(referencias)).toHaveLength(12);
    expect(referencias.mBruta).toEqual({ bom: 0.4, atencao: 0.2 });
    expect(referencias.divPL).toEqual({ bom: 0.5, atencao: 1 });
    for (const i of INDICADORES_DIAGNOSTICO) {
      expect(validarLimites(i.id, referencias[i.id])).toBeNull();
      expect(avaliarReferencia(i.bom, i.id, referencias)).toEqual({ status: "bom", score: 70 });
      expect(avaliarReferencia(i.atencao, i.id, referencias)).toEqual({ status: "atencao", score: 40 });
    }
  });
  it("recalibra nota e semáforo de margem bruta pelos limites personalizados", () => {
    const referencias = referenciasPadrao();
    expect(avaliarReferencia(0.4, "mBruta", referencias)).toEqual({ status: "bom", score: 70 });
    referencias.mBruta = { bom: 0.5, atencao: 0.3 };
    expect(avaliarReferencia(0.4, "mBruta", referencias).status).toBe("atencao");
    expect(avaliarReferencia(0.4, "mBruta", referencias).score).toBeCloseTo(55.5006, 4);
    expect(avaliarReferencia(0.29, "mBruta", referencias).status).toBe("ruim");
    expect(avaliarReferencia(0.5, "mBruta", referencias)).toEqual({ status: "bom", score: 70 });
  });
  it("mantém a direção menor é melhor nas faixas de endividamento", () => {
    const referencias = referenciasPadrao();
    referencias.divPL = { bom: 0.4, atencao: 0.8 };
    expect(avaliarReferencia(0.4, "divPL", referencias)).toEqual({ status: "bom", score: 70 });
    expect(avaliarReferencia(0.8, "divPL", referencias)).toEqual({ status: "atencao", score: 40 });
    expect(avaliarReferencia(0.81, "divPL", referencias).status).toBe("ruim");
    expect(avaliarReferencia(0.3, "divPL", referencias).status).toBe("bom");
  });
  it("reutiliza o motor logístico para todos os indicadores personalizados", () => {
    const referencias = referenciasPadrao();
    for (const i of INDICADORES_DIAGNOSTICO) {
      referencias[i.id] = { bom: i.bom * 1.2, atencao: i.atencao * 1.2 };
      expect(avaliarReferencia(i.bom, i.id, referencias))
        .toEqual(avaliarIndicador(i.bom, i.bom * 1.2, i.atencao * 1.2, i.maiorMelhor));
    }
  });
  it("impede faixas iguais, invertidas e valores indisponíveis", () => {
    expect(validarLimites("mBruta", { bom: 0.2, atencao: 0.2 })).not.toBeNull();
    expect(validarLimites("mBruta", { bom: 0.1, atencao: 0.2 })).not.toBeNull();
    expect(validarLimites("divPL", { bom: 1, atencao: 0.5 })).not.toBeNull();
    expect(validarLimites("divPL", { bom: 1, atencao: 1 })).not.toBeNull();
    expect(validarLimites("mBruta", { bom: NaN, atencao: 0.2 })).not.toBeNull();
    expect(validarLimites("mBruta", { bom: Infinity, atencao: 0.2 })).not.toBeNull();
  });
  it("converte percentuais brasileiros sem alterar múltiplos nem restringir margens negativas", () => {
    expect(converterLimite("40", true)).toBe(0.4);
    expect(converterLimite("12,5", true)).toBe(0.125);
    expect(converterLimite("1,5", false)).toBe(1.5);
    expect(converterLimite("-5", true)).toBe(-0.05);
    expect(validarLimites("mLiq", { bom: 0, atencao: -0.05 })).toBeNull();
    for (const texto of ["", " ", "texto", "1,2,3", "Infinity"]) {
      expect(Number.isNaN(converterLimite(texto, true))).toBe(true);
    }
  });
  it("recupera dados salvos sem aceitar faixas corrompidas nem perder referências válidas", () => {
    const salvas = { mBruta: { bom: 0.5, atencao: 0.3 }, divPL: { bom: 2, atencao: 1 } };
    const referencias = normalizarReferencias(JSON.parse(JSON.stringify(salvas)));
    expect(referencias.mBruta).toEqual(salvas.mBruta);
    expect(referencias.divPL).toEqual({ bom: 0.5, atencao: 1 });
    expect(referencias.roa).toEqual({ bom: 0.08, atencao: 0.04 });
    expect(normalizarReferencias(null)).toEqual(referenciasPadrao());
  });
  it("restaurar padrões não altera a configuração personalizada original", () => {
    const referencias = referenciasPadrao();
    referencias.mBruta.bom = 0.5;
    expect(referenciasPadrao().mBruta.bom).toBe(0.4);
    expect(referencias.mBruta.bom).toBe(0.5);
  });
});