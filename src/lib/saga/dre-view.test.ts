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

test("DRE analítico mostra Aluguel em linha própria e permite personalizar seu nome", async () => {
  const dados = await importarComAluguel();
  let linhas = montarLinhasDRE(dados, "analitico");
  expect(linhas.find((linha) => linha.label === "(-) Aluguel")?.values).toEqual([-10, -12, -15, -18, -20]);

  dados.rotulos!["dre.extra.dre-extra-0"] = "Aluguel das lojas";
  linhas = montarLinhasDRE(dados, "analitico");
  expect(linhas.some((linha) => linha.label === "(-) Aluguel das lojas")).toBe(true);
});

test("DRE analítico reconcilia demais contas + Aluguel com o total sem duplicar resultados", async () => {
  const dados = await importarComAluguel();
  const linhas = montarLinhasDRE(dados, "analitico");
  const demais = linhas.find((linha) => linha.label === "(-) Despesas Operacionais — demais contas")!;
  const aluguel = linhas.find((linha) => linha.label === "(-) Aluguel")!;
  const total = linhas.find((linha) => linha.label === "(-) Total Despesas Operacionais")!;

  expect(total.values).toEqual(dados.dre.despOperacionais);
  expect(demais.values.map((valor, i) => valor + aluguel.values[i]!)).toEqual(total.values);
  expect(linhas.find((linha) => linha.label === "= EBITDA")?.values).toEqual(dados.dre.ebitda);
  expect(linhas.find((linha) => linha.label === "= Lucro Líquido")?.values).toEqual(dados.dre.lucroLiquido);
});
