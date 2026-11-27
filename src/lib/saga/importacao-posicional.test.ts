import * as XLSX from "xlsx";
import { test, expect } from "vitest";
import { gerarPlanilhaModelo } from "@/lib/saga/template";
import { lerPlanilha } from "@/lib/saga/parser";
test("posicional", async () => {
  const wb = XLSX.read(await gerarPlanilhaModelo("completa").arrayBuffer());
  const ws = wb.Sheets["DRE"]!; ws["A2"] = { t: "s", v: "Faturamento Total" };
  wb.SheetNames[1] = "Resultado"; wb.Sheets["Resultado"] = ws;
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const f = new File([buf], "x.xlsx");
  const d = await lerPlanilha(f, "completa");
  expect(d.dre.receitaBruta[0]).toBe(1000);
  expect(d.dre.lucroLiquido[4]).toBe(264);
  expect(d.rotulos!["dre.receitaBruta"]).toBe("Faturamento Total");
});
