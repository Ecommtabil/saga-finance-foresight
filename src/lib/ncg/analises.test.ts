import { describe, expect, it } from "vitest";
import { criarAnalise, salvarNaLista, duplicarAnalise, buscarAnalises, compararAnalises } from "./analises";
import { PREMISSAS_EXEMPLO } from "./premissas";
import { criarExcelNCG } from "./export-excel";
import * as XLSX from "xlsx";

const agora = "2026-11-09T21:30:00Z";
describe("análises locais NCG", () => {
  it("permite análises da mesma empresa em períodos distintos", () => {
    const a = criarAnalise("Cliente PME", "", PREMISSAS_EXEMPLO, "a", agora);
    const b = criarAnalise("Cliente PME", "", { ...PREMISSAS_EXEMPLO, diasInformados: 60 }, "b", agora);
    const lista = salvarNaLista([a], b);
    expect(lista).toHaveLength(2);
    expect(compararAnalises(lista).map(a => a.pmr)).toEqual([30, 45]);
  });
  it("atualiza análise aberta sem duplicar e preserva criação", () => {
    const a = criarAnalise("Cliente", "", PREMISSAS_EXEMPLO, "a", agora);
    const b = criarAnalise("Cliente", "", { ...PREMISSAS_EXEMPLO, vendasBrutas: 600000 }, "a", "2026-11-10", a);
    expect(salvarNaLista([a], b)).toHaveLength(1);
    expect(b.criadoEm).toBe(agora);
    expect(b.resultados.prazos.pmr).toBe(40.5);
  });
  it("duplicação mantém empresa e isola as premissas", () => {
    const a = criarAnalise("Cliente", "", PREMISSAS_EXEMPLO, "a", agora);
    const b = duplicarAnalise(a, "b", agora); b.premissas.saldos.clientes.inicial = 0;
    expect(b.empresa).toBe("Cliente"); expect(a.premissas.saldos.clientes.inicial).toBe(250000);
    expect(buscarAnalises([a], "CLIENTE")).toHaveLength(1);
  });
  it("Excel contém duas abas com os valores calculados sem arredondamento", () => {
    const wb = criarExcelNCG("Cliente", "", PREMISSAS_EXEMPLO);
    expect(wb.SheetNames).toEqual(["Premissas", "NCG"]);
    const linhas = XLSX.utils.sheet_to_json<(string | number)[]>(wb.Sheets.NCG, { header: 1 });
    expect(linhas.find(l => l[0] === "Capital de giro total necessário")?.[1]).toBeCloseTo(310833.33333);
    expect(linhas.find(l => l[0] === "PMR — Recebimento")?.[1]).toBe(45);
  });
});