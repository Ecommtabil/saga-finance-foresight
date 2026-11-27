import * as XLSX from "xlsx";
import { test, expect } from "vitest";
import { gerarPlanilhaModelo } from "@/lib/saga/template";
import { lerPlanilha } from "@/lib/saga/parser";
test("linha extra Aluguel soma nas despesas e nos resultados", async () => {
  const wb = XLSX.read(await gerarPlanilhaModelo("completa").arrayBuffer());
  const ws = wb.Sheets["DRE"]!;
  const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  const i = rows.findIndex((r) => r[0] === "Despesas Operacionais");
  rows.splice(i + 1, 0, ["Aluguel", 10, 10, 10, 10, 10]);
  wb.Sheets["DRE"] = XLSX.utils.aoa_to_sheet(rows);
  const f = new File([XLSX.write(wb, { type: "array", bookType: "xlsx" })], "x.xlsx");
  const base = await lerPlanilha(new File([await (await gerarPlanilhaModelo("completa")).arrayBuffer()], "b.xlsx"), "completa");
  const d = await lerPlanilha(f, "completa");
  expect(d.dre.despOperacionais[0]).toBe(base.dre.despOperacionais[0] - 10);
  expect(d.dre.ebitda[0]).toBe(base.dre.ebitda[0] - 10);
  expect(d.dre.lucroLiquido[4]).toBe(base.dre.lucroLiquido[4] - 10);
  expect(d.dre.receitaBruta[0]).toBe(1000);
  expect(d.rotulos!["dre.despOperacionais"]).toContain("Aluguel");
  expect(d.contasExtrasDre).toEqual([
    {
      id: "dre-extra-0",
      nome: "Aluguel",
      contaPai: "despOperacionais",
      valores: [-10, -10, -10, -10, -10],
    },
  ]);
});
