import { describe, expect, it } from "vitest";
import { calcularPVM, ErroPVM, intervalo, pvmMesAMes, type NivelPVM, type RegistroPVM } from "./pvm";

const reg = (unidade: string, categoria: string, produto: string, mes: string, q: number, r: number): RegistroPVM[] => [
  { unidade, categoria, produto, metrica: "Quantidade", mes, valor: q },
  { unidade, categoria, produto, metrica: "Receita", mes, valor: r },
];

// Totais por unidade de Janeiro × Fevereiro. Fortaleza vem direto da planilha; Cuiabá e Maranhão foram
// reconstruídos a partir dos efeitos e totais de conferência informados (quantidade total 58.385 → 51.533).
const planilha: RegistroPVM[] = [
  ...reg("Fortaleza", "-", "-", "2026-01", 15435, 473038.29), ...reg("Fortaleza", "-", "-", "2026-02", 12651, 397113.0),
  ...reg("Cuiabá", "-", "-", "2026-01", 17948, 579477.27), ...reg("Cuiabá", "-", "-", "2026-02", 15724, 518129.66),
  ...reg("Maranhão", "-", "-", "2026-01", 25002, 844046.42), ...reg("Maranhão", "-", "-", "2026-02", 23158, 748281.91),
];
const perto = (v: number, esperado: number) => expect(Math.abs(v - esperado)).toBeLessThan(0.01);

describe("valores da planilha original — nível Unidade, Janeiro × Fevereiro", () => {
  const r = calcularPVM(planilha, { base: ["2026-01"], atual: ["2026-02"], nivel: "unidade" });
  const item = (n: string) => r.itens.find(i => i.item === n)!;
  it("Fortaleza", () => {
    const f = item("Fortaleza");
    expect([f.q0, f.q1]).toEqual([15435, 12651]);
    perto(f.r0, 473038.29); perto(f.r1, 397113);
    perto(f.volume, -90434.68); perto(f.preco, 9396.29); perto(f.mix, 1786.21); perto(f.total, -79252.17);
  });
  it("Cuiabá", () => {
    const c = item("Cuiabá");
    perto(c.volume, -72243.79); perto(c.preco, 10457.46); perto(c.mix, 23.21); perto(c.total, -61763.12);
  });
  it("Maranhão", () => {
    const m = item("Maranhão");
    perto(m.volume, -59899.98); perto(m.preco, -33512.62); perto(m.mix, 1390.49); perto(m.total, -92022.11);
  });
  it("TOTAL e conciliação", () => {
    perto(r.total.r0, 1896561.98); perto(r.total.r1, 1663524.57);
    perto(r.total.volume, -222578.45); perto(r.total.preco, -13658.87); perto(r.total.mix, 3199.91); perto(r.total.total, -233037.41);
    expect(r.total.dQ).toBe(-6852);
    expect(r.conciliado).toBe(true);
  });
});

// Base pequena calculada à mão
const pequena: RegistroPVM[] = [
  ...reg("U1", "C1", "A", "2026-01", 10, 100), ...reg("U1", "C1", "A", "2026-02", 12, 132),
  ...reg("U1", "C2", "B", "2026-01", 30, 600), ...reg("U1", "C2", "B", "2026-02", 20, 420),
  ...reg("U2", "C2", "B", "2026-01", 20, 400), ...reg("U2", "C2", "B", "2026-02", 28, 560),
  ...reg("U2", "C1", "N", "2026-02", 5, 75), // produto novo
  ...reg("U2", "C1", "D", "2026-01", 4, 40), // produto descontinuado
];

describe("fórmulas exatas", () => {
  it("calcula mix, preços e efeitos por item", () => {
    const r = calcularPVM(pequena, { base: ["2026-01"], atual: ["2026-02"], nivel: "produto" });
    const P0 = 1140 / 64; // R0 / Q0
    const a = r.itens.find(i => i.item === "A")!;
    expect(a.p0).toBe(10); expect(a.p1).toBe(11);
    expect(a.mix0).toBeCloseTo(10 / 64, 12); expect(a.mix1).toBeCloseTo(12 / 65, 12);
    expect(a.volume).toBeCloseTo(2 * P0, 9);
    expect(a.preco).toBeCloseTo(1 * 12, 9);
    expect(a.mix).toBeCloseTo((12 / 65 - 10 / 64) * (10 - P0) * 65, 9);
  });
  it("produto novo e descontinuado não dividem por zero", () => {
    const r = calcularPVM(pequena, { base: ["2026-01"], atual: ["2026-02"], nivel: "produto" });
    const n = r.itens.find(i => i.item === "N")!, d = r.itens.find(i => i.item === "D")!;
    expect(n.status).toBe("novo"); expect(d.status).toBe("descontinuado");
    expect(n.p0).toBeCloseTo(r.total.p0, 12); expect(d.p1).toBeCloseTo(r.total.p1, 12);
    expect(Number.isFinite(n.total) && Number.isFinite(d.total)).toBe(true);
    expect(r.conciliado).toBe(true);
  });
  it("concilia em todos os níveis e o Volume é igual nos três", () => {
    const vols = (["unidade", "categoria", "produto"] as NivelPVM[]).map(nivel => {
      const r = calcularPVM(pequena, { base: ["2026-01"], atual: ["2026-02"], nivel });
      expect(Math.abs(r.diferenca)).toBeLessThan(0.01);
      return r.total.volume;
    });
    expect(vols[1]).toBeCloseTo(vols[0], 9); expect(vols[2]).toBeCloseTo(vols[0], 9);
  });
  it("filtros são aplicados antes da agregação", () => {
    const r = calcularPVM(pequena, { base: ["2026-01"], atual: ["2026-02"], nivel: "unidade", filtros: { unidades: [], categorias: ["C2"], produtos: [] } });
    expect(r.total.q0).toBe(50); expect(r.total.r1).toBe(980);
  });
  it("aponta diferença quando há receita sem quantidade", () => {
    const r = calcularPVM([...pequena, { unidade: "U3", categoria: "C3", produto: "X", metrica: "Receita", mes: "2026-01", valor: 50 }],
      { base: ["2026-01"], atual: ["2026-02"], nivel: "produto" });
    expect(r.conciliado).toBe(false);
  });
});

describe("períodos", () => {
  it("bloqueia mês sem dados", () => {
    expect(() => calcularPVM(pequena, { base: ["2026-01"], atual: ["2026-03"], nivel: "unidade" })).toThrow(ErroPVM);
  });
  it("acumulado soma os meses antes de calcular", () => {
    const tri = [...pequena, ...reg("U1", "C1", "A", "2026-03", 8, 96), ...reg("U1", "C1", "A", "2026-04", 9, 90)];
    const r = calcularPVM(tri, { base: intervalo(["2026-01", "2026-02", "2026-03", "2026-04"], "2026-01", "2026-02"), atual: ["2026-03", "2026-04"], nivel: "unidade" });
    expect(r.total.q0).toBe(64 + 65); expect(r.total.q1).toBe(17); expect(r.conciliado).toBe(true);
  });
  it("mês a mês gera uma transição por par de meses, todas conciliadas", () => {
    const tri = [...pequena, ...reg("U1", "C1", "A", "2026-03", 8, 96)];
    const t = pvmMesAMes(tri, ["2026-01", "2026-02", "2026-03"], "produto");
    expect(t.map(x => `${x.base}>${x.atual}`)).toEqual(["2026-01>2026-02", "2026-02>2026-03"]);
    expect(t.every(x => x.resultado?.conciliado)).toBe(true);
  });
});
