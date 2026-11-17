import { describe, expect, it } from "vitest";
import { calcularEmpresa, calcularMesAnexo, calcularRbt12, faixaPorRbt12, partilhaEfetiva, aliquotaEfetiva, type DadosCalculo } from "./calculo";
import { tabelasPadrao, type AnexoId } from "./tabelas";

const T = tabelasPadrao();
const dados = (p: Partial<DadosCalculo> = {}): DadosCalculo => ({
  ano: 2025, anexos: ["I"], inicioAtividade: false, mesInicio: null,
  anoAnterior: Array(12).fill(0), receitas: {}, rbt12Manual: Array(12).fill(null), ...p,
});
const manual = (v: number) => ({ valor: v, origem: "manual" as const });

describe("caso de teste do enunciado (Anexo I, jan/2025, RBT12 400.000)", () => {
  const r = calcularMesAnexo("I", 0, { integral: 15199.02, st: 28248.73, stMono: 25171.93 }, manual(400000), T.I, false);
  it("faixa 3 e alíquota efetiva 6,0350%", () => {
    expect(r.faixa).toBe(3);
    expect(r.ae).toBeCloseTo(0.06035, 10);
  });
  it("imposto por tipo de receita", () => {
    expect(r.impostoPorColuna.integral).toBeCloseTo(917.26, 2);
    expect(r.impostoPorColuna.st).toBeCloseTo(1133.70, 2);
    expect(r.impostoPorColuna.stMono).toBeCloseTo(774.75, 2);
  });
  it("total do DAS = 2.825,71", () => {
    expect(Math.round(r.totalDas * 100) / 100).toBe(2825.71);
  });
  it("soma dos tributos em R$ = total do DAS e ICMS só sobre a receita integral", () => {
    const soma = Object.values(r.tributos).reduce((s, v) => s + v, 0);
    expect(soma).toBeCloseTo(r.totalDas, 8);
    expect(r.tributos.ICMS).toBeCloseTo(15199.02 * 0.06035 * 0.335, 8);
  });
});

describe("faixas", () => {
  it("limites das faixas", () => {
    expect(faixaPorRbt12(0)).toBe(0);
    expect(faixaPorRbt12(180000)).toBe(1);
    expect(faixaPorRbt12(180000.01)).toBe(2);
    expect(faixaPorRbt12(720000)).toBe(3);
    expect(faixaPorRbt12(3600000.01)).toBe(6);
    expect(faixaPorRbt12(4800000)).toBe(6);
    expect(faixaPorRbt12(4800000.01)).toBe(7);
  });
  it("acima de R$ 4,8 mi não calcula zero em silêncio", () => {
    const r = calcularMesAnexo("I", 0, { integral: 1000 }, manual(5_000_000), T.I, false);
    expect(r.calculado).toBe(false);
    expect(r.alertas.some((a) => a.nivel === "erro" && a.texto.includes("Excedeu o limite"))).toBe(true);
  });
  it("RBT12 zerado com receita gera alerta e não calcula", () => {
    const r = calcularMesAnexo("I", 0, { integral: 1000 }, manual(0), T.I, false);
    expect(r.calculado).toBe(false);
    expect(r.alertas[0].nivel).toBe("erro");
  });
  it("alerta de proximidade acima de 90% do limite da faixa", () => {
    const r = calcularMesAnexo("I", 0, { integral: 1000 }, manual(170000), T.I, false);
    expect(r.alertas.some((a) => a.texto.includes("limite da faixa 1"))).toBe(true);
  });
});

describe("RBT12", () => {
  it("soma os 12 meses anteriores de todos os anexos", () => {
    const d = dados({
      anexos: ["I", "III"], anoAnterior: Array(12).fill(10000),
      receitas: { I: [{ integral: 5000 }], III: [{ semRet: 3000, comRet: 2000 }] },
    });
    const r = calcularRbt12(d);
    expect(r[0].valor).toBe(120000);
    expect(r[1].valor).toBe(110000 + 10000);
  });
  it("valor manual sobrescreve o calculado", () => {
    const rm = Array(12).fill(null); rm[2] = 250000;
    const r = calcularRbt12(dados({ anoAnterior: Array(12).fill(10000), rbt12Manual: rm }));
    expect(r[2]).toEqual({ valor: 250000, origem: "manual" });
  });
  it("início de atividade: primeiro mês × 12 e depois média dos meses × 12", () => {
    const receitas: { I: { integral: number }[] } = { I: [] };
    receitas.I[2] = { integral: 10000 };
    receitas.I[3] = { integral: 20000 };
    const r = calcularRbt12(dados({ inicioAtividade: true, mesInicio: "2025-03", receitas }));
    expect(r[1].origem).toBe("sem-atividade");
    expect(r[2]).toMatchObject({ valor: 120000, origem: "primeiro-mes" });
    expect(r[3]).toMatchObject({ valor: 120000, origem: "proporcional", mesesAtividade: 1 });
    expect(r[4]).toMatchObject({ valor: 180000, origem: "proporcional", mesesAtividade: 2 });
  });
});

describe("partilha e regras especiais", () => {
  it("teto do ISS de 5% com redistribuição proporcional aos federais (Anexo III, faixa 5)", () => {
    const f = T.III[4];
    const ae = aliquotaEfetiva(3_000_000, f);
    expect(ae * 0.335).toBeGreaterThan(0.05);
    const { partilha, issLimitado } = partilhaEfetiva("III", 5, f, ae);
    expect(issLimitado).toBe(true);
    expect(ae * (partilha.ISS ?? 0)).toBeCloseTo(0.05, 10);
    const soma = Object.values(partilha).reduce((s, v) => s + (v ?? 0), 0);
    expect(soma).toBeCloseTo(1, 10);
    // proporcional: CPP/IRPJ mantêm a mesma razão original
    expect((partilha.CPP ?? 0) / (partilha.IRPJ ?? 1)).toBeCloseTo(43.4 / 4, 10);
  });
  it("serviço com retenção: Receita × AE × (1 − %ISS)", () => {
    const r = calcularMesAnexo("III", 0, { comRet: 10000 }, manual(400000), T.III, false);
    const ae = (400000 * 0.135 - 17640) / 400000;
    expect(r.impostoPorColuna.comRet).toBeCloseTo(10000 * ae * (1 - 0.325), 8);
    expect(r.tributos.ISS).toBe(0);
  });
  it("faixa 6: ICMS fora do DAS e aviso de sublimite", () => {
    const r = calcularMesAnexo("I", 0, { integral: 100000 }, manual(4_000_000), T.I, false);
    expect(r.faixa).toBe(6);
    expect(r.tributos.ICMS).toBe(0);
    expect(r.sublimite).toBe(true);
    expect(r.alertas.some((a) => a.texto.includes("sublimite"))).toBe(true);
  });
  it("Anexo IV: CPP não entra no DAS", () => {
    const r = calcularMesAnexo("IV", 0, { semRet: 10000 }, manual(400000), T.IV, false);
    expect(r.tributos.CPP).toBe(0);
    expect(Object.values(r.tributos).reduce((s, v) => s + v, 0)).toBeCloseTo(r.totalDas, 8);
  });
});

describe("consolidado", () => {
  it("economia = imposto sem segregação − DAS e soma de todos os anexos", () => {
    const anexos: AnexoId[] = ["I"];
    const rm = Array(12).fill(null); rm[0] = 400000;
    const res = calcularEmpresa(dados({ anexos, rbt12Manual: rm, receitas: { I: [{ integral: 15199.02, st: 28248.73, stMono: 25171.93 }] } }), T);
    const receita = 15199.02 + 28248.73 + 25171.93;
    expect(res.consolidado.faturamento).toBeCloseTo(receita, 6);
    expect(res.consolidado.das).toBeCloseTo(2825.71, 2);
    expect(res.consolidado.economia).toBeCloseTo(receita * 0.06035 - res.consolidado.das, 6);
    expect(res.consolidado.aeMediaPonderada).toBeCloseTo(0.06035, 10);
  });
});
