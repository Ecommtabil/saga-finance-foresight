import { describe, expect, it } from "vitest";
import { calcularNCG, type EntradasNCG } from "./engine";

// Exemplo do app: 90 dias; vendas 540.000; CMV 315.000; compras 315.000;
// despesas fixas 210.000; clientes médio 270.000; estoques médio 105.000;
// fornecedores médio 87.500; prazo desp. fixas 20; reserva 1 mês; caixa 150.000.
const EXEMPLO: EntradasNCG = {
  dias: 90,
  vendas: 540000,
  cmv: 315000,
  compras: 315000,
  despesasFixas: 210000,
  clientesMedio: 270000,
  estoquesMedio: 105000,
  fornecedoresMedio: 87500,
  outrosAtivos: [0, 0, 0],
  outrosPassivos: [0, 0, 0],
  prazoDespFixas: 20,
  mesesReserva: 1,
  caixa: 150000,
};

describe("motor de cálculo da NCG – exemplo do app", () => {
  const r = calcularNCG(EXEMPLO);

  it("prazos médios: PMR 45, PME 30, PMP 25", () => {
    expect(r.prazos.pmr).toBeCloseTo(45, 1);
    expect(r.prazos.pme).toBeCloseTo(30, 1);
    expect(r.prazos.pmp).toBeCloseTo(25, 1);
  });

  it("ciclo operacional 75 e ciclo financeiro 50", () => {
    expect(r.prazos.cicloOperacional).toBeCloseTo(75, 1);
    expect(r.prazos.cicloFinanceiro).toBeCloseTo(50, 1);
  });

  it("componentes da NCG operacional", () => {
    expect(r.ncg.clientes).toBeCloseTo(270000, 0);
    expect(r.ncg.estoques).toBeCloseTo(105000, 0);
    expect(r.ncg.fornecedores).toBeCloseTo(-87500, 0);
    expect(r.ncg.despesasFixasAPagar).toBeCloseTo(-46666.67, 1);
  });

  it("NCG operacional 240.833,33", () => {
    expect(r.ncg.total).toBeCloseTo(240833.33, 1);
  });

  it("reserva 70.000, total 310.833,33 e falta de 160.833,33", () => {
    expect(r.reservaSeguranca).toBeCloseTo(70000, 0);
    expect(r.capitalGiroTotal).toBeCloseTo(310833.33, 1);
    expect(r.sobraFalta).toBeCloseTo(-160833.33, 1);
    expect(r.giroCoberto).toBe(false);
  });

  it("indicadores: 40,1 dias de venda, 11,1% s/ vendas anualizadas, cobertura 48,3%", () => {
    expect(r.ncgDiasVenda).toBeCloseTo(40.1, 1);
    expect(r.ncgSobreVendasAnualizadas).toBeCloseTo(0.111, 3);
    expect(r.coberturaCaixa).toBeCloseTo(0.483, 3);
  });

  it("método simplificado 291.666,67 e diferença 50.833,33", () => {
    expect(r.ncgSimplificada).toBeCloseTo(291666.67, 1);
    expect(r.diferencaSimplificada).toBeCloseTo(50833.33, 1);
  });
});

describe("divisão por zero retorna 0 sem erro", () => {
  it("entradas zeradas não quebram o cálculo", () => {
    const r = calcularNCG({
      dias: 0,
      vendas: 0,
      cmv: 0,
      compras: 0,
      despesasFixas: 0,
      clientesMedio: 0,
      estoquesMedio: 0,
      fornecedoresMedio: 0,
      outrosAtivos: [],
      outrosPassivos: [],
      prazoDespFixas: 0,
      mesesReserva: 0,
      caixa: 0,
    });
    expect(r.prazos.pmr).toBe(0);
    expect(r.ncg.total).toBe(0);
    expect(r.ncgDiasVenda).toBe(0);
    expect(r.coberturaCaixa).toBe(0);
    expect(r.giroCoberto).toBe(true); // sobra = 0 ≥ 0
  });
});
