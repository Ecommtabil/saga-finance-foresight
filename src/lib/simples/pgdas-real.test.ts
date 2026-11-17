import { describe, expect, it } from "vitest";
import { PGDAS_REAL } from "./__fixtures__/pgdas-real";
import { aplicarPrevia, consolidarPgdas, interpretarPgdas, montarPrevia } from "./importacao";
import { calcularEmpresa } from "./calculo";
import { empresaNova } from "./store";
import { tabelasPadrao } from "./tabelas";

// Extrato PGDAS-D real de out/2026 (comércio, Anexo I), com dados de identificação trocados.
describe("PGDAS-D real (out/2026)", () => {
  const x = interpretarPgdas(PGDAS_REAL, "pgdas-out-2026.pdf");

  it("lê PA, CNPJ e o discriminativo de receitas mesmo com o rótulo depois do valor", () => {
    expect(x.erros).toEqual([]);
    expect(x.pa).toBe("2026-10");
    expect(x.cnpj).toBe("11.222.333/0001-81");
    expect(x.rpa).toBe(53673.71);
    expect(x.rbt12).toBe(931407.88);
    expect(x.rba).toBe(765390.18);
    expect(x.rbaa).toBe(360182.87);
    expect(x.das).toBe(3739.34);
  });

  it("lê as 18 receitas anteriores (abr/2025 a set/2026)", () => {
    expect(Object.keys(x.anteriores)).toHaveLength(18);
    expect(x.anteriores["2025-06"]).toBe(9793.73);
    expect(x.anteriores["2026-06"]).toBe(128489.53);
    expect(x.anteriores["2026-09"]).toBe(33894.26);
  });

  it("separa revenda sem ST (integral) e com ST de ICMS", () => {
    expect(x.atividades.map((a) => [a.anexo, a.coluna, a.valor, a.tributos?.total])).toEqual([
      ["I", "integral", 28192.95, 2335.59],
      ["I", "st", 25480.76, 1403.75],
    ]);
  });

  it("depois de importado, o app calcula o mesmo RBT12 e o mesmo DAS do extrato", () => {
    const base = empresaNova("x", { razaoSocial: "Empresa Exemplo", cnpj: "11.222.333/0001-81", ano: 2026, anexos: ["I"] });
    const c = consolidarPgdas([x], 2026, base.cnpj);
    expect(c.avisos).toEqual([]);
    const previa = montarPrevia(base, c.linhas, "I");
    expect(previa.filter((p) => p.status === "erro")).toEqual([]);
    const e = aplicarPrevia(base, previa, new Set(previa.map((p) => p.id)), true).empresa;
    const r = calcularEmpresa(e, tabelasPadrao());
    expect(r.rbt12[9].valor).toBeCloseTo(931407.88, 2);
    const out = r.anexos.I!.meses[9];
    expect(out.faixa).toBe(4);
    expect(out.impostoPorColuna.integral).toBeCloseTo(2335.59, 2);
    expect(out.impostoPorColuna.st).toBeCloseTo(1403.75, 2);
    expect(out.totalDas).toBeCloseTo(3739.34, 2);
    expect(out.tributos.ICMS).toBeCloseTo(782.42, 2);
    expect(out.tributos.CPP).toBeCloseTo(1867.53, 2);
    expect(out.tributos.IRPJ).toBeCloseTo(244.56, 2);
  });
});
