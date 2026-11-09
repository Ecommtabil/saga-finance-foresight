import { describe, expect, it } from "vitest";
import { PREMISSAS_EXEMPLO } from "./premissas";
import { simularNCG, SIMULACAO_NEUTRA } from "./simulacao";

describe("simulação de capital de giro", () => {
  it("sem alavancas reproduz o resultado atual", () => {
    const r = simularNCG(PREMISSAS_EXEMPLO, SIMULACAO_NEUTRA);
    expect(r.simulada).toEqual(r.atual);
    expect(r.variacao).toBe(0);
  });
  it("cada dia a menos de PMR libera R$ 6.000", () => {
    const r = simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pmr: -1 });
    expect(r.variacao).toBeCloseTo(-6000);
    expect(r.simulada.sobraFalta - r.atual.sobraFalta).toBeCloseTo(6000);
    expect(r.impactoDia.pmr).toBe(6000);
  });
  it("PME varia entre −30 e +30 dias e cada dia libera R$ 3.500", () => {
    expect(simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pme: -30 }).variacao).toBeCloseTo(-105000);
    expect(simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pme: 80 }).prazos.pme).toBe(60);
  });
  it("PMP varia entre −30 e +30 dias, sem prazo negativo", () => {
    const r = simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pmp: 30 });
    expect(r.variacao).toBeCloseTo(-105000);
    expect(simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pmp: -30 }).prazos.pmp).toBe(0);
  });
  it("PMR fica limitado a −30 e +30 dias", () => {
    expect(simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pmr: -80 }).prazos.pmr).toBe(15);
    expect(simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, pmr: 80 }).prazos.pmr).toBe(75);
  });
  it("vendas de −50% a +50% mantêm os prazos e escalam CMV e compras proporcionalmente", () => {
    for (const vendas of [-50, 50]) {
      const r = simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, vendas });
      expect(r.simulada.prazos).toEqual(r.atual.prazos);
      expect(r.simulada.bases.vendasDia).toBe(6000 * (1 + vendas / 100));
      expect(r.simulada.bases.cmvDia).toBe(3500 * (1 + vendas / 100));
      expect(r.simulada.reservaSeguranca).toBe(70000);
    }
    expect(simularNCG(PREMISSAS_EXEMPLO, { ...SIMULACAO_NEUTRA, vendas: 90 }).impactoDia.pmr).toBe(9000);
  });
  it("combina alavancas sem alterar premissas", () => {
    const copia = structuredClone(PREMISSAS_EXEMPLO);
    const r = simularNCG(copia, { pmr: -10, pme: -5, pmp: 5, vendas: 20 });
    expect(r.simulada.ncg.total).toBeCloseTo(184333.333333);
    expect(copia).toEqual(PREMISSAS_EXEMPLO);
  });
});