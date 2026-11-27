import * as XLSX from "xlsx";
import { expect, test } from "vitest";
import { gerarPlanilhaModelo } from "@/lib/saga/template";
import { lerPlanilha } from "@/lib/saga/parser";
import { montarLinhasDRE } from "@/lib/saga/dre-view";

async function importarComAluguel() {
  const wb = XLSX.read(await gerarPlanilhaModelo("completa").arrayBuffer());
  const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets["DRE"]!, { header: 1 });
  const i = rows.findIndex((r) => r[0] === "Despesas Operacionais");
  rows.splice(i + 1, 0, ["Aluguel", 10, 12, 15, 18, 20]);
  wb.Sheets["DRE"] = XLSX.utils.aoa_to_sheet(rows);
  const arquivo = new File([XLSX.write(wb, { type: "array", bookType: "xlsx" })], "dre.xlsx");
  return lerPlanilha(arquivo, "completa");
}

test("DRE analítico mostra Aluguel como conta filha e permite personalizar seu nome", async () => {
  const dados = await importarComAluguel();
  let linhas = montarLinhasDRE(dados, "analitico");
  const grupo = linhas.findIndex((linha) => linha.label === "(-) Despesas Operacionais");
  const aluguel = linhas.findIndex((linha) => linha.label === "(-) Aluguel");

  expect(grupo).toBeGreaterThanOrEqual(0);
  expect(aluguel).toBe(grupo + 2);
  expect(linhas[grupo]?.bold).toBe(true);
  expect(linhas[aluguel]?.indent).toBe(true);
  expect(linhas[aluguel]?.values).toEqual([-10, -12, -15, -18, -20]);

  dados.rotulos!["dre.extra.dre-extra-0"] = "Aluguéis das lojas";
  linhas = montarLinhasDRE(dados, "analitico");
  expect(linhas.some((linha) => linha.label === "(-) Aluguéis das lojas")).toBe(true);
});

test("grupo Despesas Operacionais reconcilia suas contas sem linha de total duplicada", async () => {
  const dados = await importarComAluguel();
  const linhas = montarLinhasDRE(dados, "analitico");
  const grupo = linhas.find((linha) => linha.label === "(-) Despesas Operacionais")!;
  const demais = linhas.find((linha) => linha.label === "(-) Demais contas")!;
  const aluguel = linhas.find((linha) => linha.label === "(-) Aluguel")!;

  expect(grupo.values).toEqual(dados.dre.despOperacionais);
  expect(demais.values.map((valor, i) => valor + aluguel.values[i]!)).toEqual(grupo.values);
  expect(linhas.some((linha) => linha.label.includes("Total Despesas Operacionais"))).toBe(false);
  expect(linhas.find((linha) => linha.label === "= EBITDA")?.values).toEqual(dados.dre.ebitda);
  expect(linhas.find((linha) => linha.label === "= Lucro Líquido")?.values).toEqual(dados.dre.lucroLiquido);
});
