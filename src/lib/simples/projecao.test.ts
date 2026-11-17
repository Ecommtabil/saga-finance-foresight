import { describe, expect, it } from "vitest";
import type { DadosCalculo } from "./calculo";
import { tabelasPadrao } from "./tabelas";
import { extrapolarMes, mesCorrentePadrao, projetarAliquota } from "./projecao";

const T = tabelasPadrao();
const tab = () => T;
// 2025: ano anterior 30.000/mês; jan–out/2025 40.000/mês no Anexo I (tributado integralmente).
const base = (): DadosCalculo => ({
  ano: 2025, anexos: ["I"], inicioAtividade: false, mesInicio: null,
  anoAnterior: Array(12).fill(30000),
  receitas: { I: Array.from({ length: 12 }, (_, i) => (i <= 9 ? { integral: 40000 } : {})) },
  rbt12Manual: Array(12).fill(null),
});
const NOV = 2025 * 12 + 10;

describe("projeção da alíquota do próximo mês", () => {
  const d = base();
  const p = projetarAliquota(d, tab, { mesCorrente: NOV, faturamento: { I: 50000 } });
  const a = p.anexos[0];

  it("mês corrente sugerido é o seguinte ao último fechado (novembro)", () => {
    expect(mesCorrentePadrao(d)).toBe(NOV);
  });
  it("último mês calculado é outubro: RBT12 450.000, alíquota 6,4200%", () => {
    expect(p.mesUltimo).toBe(NOV - 1);
    expect(a.ultimo?.rbt12).toBe(450000);
    expect(a.ultimo?.ae).toBeCloseTo(0.0642, 10);
    expect(p.dasUltimo).toBeCloseTo(40000 * 0.0642, 6);
  });
  it("novembro já tem alíquota definida (RBT12 460.000) e a prévia não muda isso", () => {
    expect(p.rbt12Corrente.valor).toBe(460000);
    expect(a.corrente.ae).toBeCloseTo(29840 / 460000, 10);
    const outra = projetarAliquota(d, tab, { mesCorrente: NOV, faturamento: { I: 999999 } });
    expect(outra.anexos[0].corrente.ae).toBeCloseTo(a.corrente.ae, 12);
  });
  it("DAS estimado de novembro = prévia × alíquota de novembro", () => {
    expect(p.dasCorrenteEstimado).toBeCloseTo(50000 * (29840 / 460000), 6);
  });
  it("dezembro projetado: RBT12 = 460.000 + 50.000 − 30.000 (nov/2024 sai) = 480.000, alíquota 6,6125%", () => {
    expect(p.ponte).toEqual({ entra: 50000, sai: 30000, mesSai: NOV - 12 });
    expect(p.rbt12Proximo.valor).toBe(480000);
    expect(a.proximo.faixa).toBe(3);
    expect(a.proximo.ae).toBeCloseTo(0.066125, 10);
  });
  it("folga até a faixa 4 e faturamento máximo para dezembro ficar na faixa 3", () => {
    expect(p.folgaFaixa).toBe(240000);
    expect(p.limiteParaManterFaixa).toBe(720000 - 430000);
  });
  it("série traz jan–out fechados + novembro corrente + dezembro projetado", () => {
    expect(p.serie).toHaveLength(12);
    expect(p.serie[10].tipo).toBe("corrente");
    expect(p.serie[11].tipo).toBe("projetado");
  });
});

describe("virada de ano", () => {
  it("dezembro corrente projeta janeiro do ano seguinte só com meses do ano da empresa", () => {
    const d = base();
    d.receitas.I![10] = { integral: 40000 };
    const p = projetarAliquota(d, tab, { mesCorrente: 2025 * 12 + 11, faturamento: { I: 60000 } });
    expect(p.rbt12Proximo.valor).toBe(11 * 40000 + 60000);
    expect(p.anexos[0].proximo.ae).toBeCloseTo((500000 * 0.095 - 13860) / 500000, 10);
  });
});

describe("prévia parcial", () => {
  it("R$ 34.000 até o dia 17 de um mês de 30 dias → R$ 60.000 no mês", () => {
    expect(extrapolarMes(34000, 17, 30)).toBeCloseTo(60000, 8);
  });
});
