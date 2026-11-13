import { describe, expect, it } from "vitest";
import { acharCabecalho, lerAbasPVM, lerMesPVM } from "./importacao";

// Cabeçalho na linha 4 começando na coluna B, colunas auxiliares com #REF! à direita.
const planilha: unknown[][] = [
  ["Relatório PVM"], [], [],
  [null, "Unidade", "Categoria", "Produto", "Métrica", "Mês", "Valor", null, "#REF!", "#REF!"],
  [null, "Fortaleza", "Bebidas", "Suco", "Quantidade", "Janeiro", 100, null, "#REF!"],
  [null, "Fortaleza", "Bebidas", "Suco", "Receita", "Janeiro", "1.500,50", null, "#REF!"],
  [null, "Fortaleza", "Bebidas", "Suco", "Quantidade", "Fevereiro", 90],
  [],
  [null, "Cuiabá", "Bebidas", "Água", "QUANTIDADE", "01/2026", "abc"],
  [null, "Cuiabá", "Bebidas", "Água", "Receita", "01/2026", -10],
];

describe("importação da base PVM", () => {
  it("encontra o cabeçalho fora da linha 1, ignorando acentos e maiúsculas", () => {
    expect(acharCabecalho([[], [null, "UNIDADE", "categoria", "produto", "metrica", "mes", "VALOR"]])).toEqual({ linha: 1, colunas: [1, 2, 3, 4, 5, 6] });
  });
  it("normaliza meses por nome, data e mm/aaaa", () => {
    expect(lerMesPVM("Março", 2026)).toBe("2026-03");
    expect(lerMesPVM("01/2025", 2026)).toBe("2025-01");
    expect(lerMesPVM(new Date(2026, 1, 15), 2026)).toBe("2026-02");
  });
  it("prefere a aba Base de Dados, ignora linhas vazias e colunas extras e aponta problemas", () => {
    const r = lerAbasPVM([{ nome: "Resumo", matriz: [["x"]] }, { nome: "Base de Dados", matriz: planilha }], 2026)!;
    expect(r.resumo.aba).toBe("Base de Dados");
    expect(r.resumo.linhaCabecalho).toBe(4);
    expect(r.resumo.linhasLidas).toBe(5);
    expect(r.registros).toHaveLength(4);
    expect(r.registros[1]).toMatchObject({ metrica: "Receita", mes: "2026-01", valor: 1500.5 });
    expect(r.resumo.meses).toEqual(["2026-01", "2026-02"]);
    expect(r.resumo.avisos.some(a => a.includes("não numérico"))).toBe(true);
    expect(r.resumo.avisos.some(a => a.includes("negativo"))).toBe(true);
    expect(r.resumo.semPar.some(s => s.startsWith("Suco · Fortaleza · 2026-02: tem Quantidade"))).toBe(true);
    expect(r.resumo.semPar.some(s => s.startsWith("Água · Cuiabá · 2026-01: tem Receita"))).toBe(true);
  });
  it("retorna nulo quando nenhuma aba tem o cabeçalho", () => {
    expect(lerAbasPVM([{ nome: "X", matriz: [["a", "b"]] }], 2026)).toBeNull();
  });
});
