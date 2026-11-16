import type { DefinicaoEstudo } from "./estudos";
import { dataBR, type CabecalhoEstudo } from "./estado";
import type { CampoPremissa, RelatorioEstudo } from "./tipos";

const MOEDA = '"R$" #,##0.00;[Red]("R$" #,##0.00);"R$" 0.00';
const PCT = "0.00%";
const INT = "#,##0";
const HEAD = { fill: { fgColor: { rgb: "0F2A44" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center" } };
const TITULO = { font: { bold: true, sz: 13, color: { rgb: "0F2A44" } } };
const INPUT = { fill: { fgColor: { rgb: "EAF2FB" } } };
const CALC = { fill: { fgColor: { rgb: "EAF7EE" } } };
const SUB = { fill: { fgColor: { rgb: "F0F1F3" } }, font: { bold: true } };
const TOTAL = { fill: { fgColor: { rgb: "0F2A44" } }, font: { bold: true, color: { rgb: "FFFFFF" } } };
const SECAO = { font: { bold: true, color: { rgb: "0F2A44" } }, border: { bottom: { style: "medium", color: { rgb: "C9A227" } } } };

type Cel = { v: string | number; t?: string; z?: string; s?: Record<string, unknown> };

export async function exportarExcelViabilidade(def: DefinicaoEstudo, cab: CabecalhoEstudo, campos: CampoPremissa<never>[], premissas: Record<string, unknown>, rel: RelatorioEstudo): Promise<Blob> {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const put = (ws: Record<string, unknown>, r: number, c: number, cel: Cel) => { ws[XLSX.utils.encode_cell({ r, c })] = { t: typeof cel.v === "number" ? "n" : "s", ...cel }; };
  const fechar = (ws: Record<string, unknown>, linhas: number, colunas: number) => { ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, linhas - 1), c: colunas - 1 } }); };

  // Premissas
  const p: Record<string, unknown> = {};
  let r = 0;
  put(p, r++, 0, { v: `Ecommtabil — ${def.titulo}`, s: TITULO });
  for (const [k, v] of [["Cliente", cab.cliente], ["CNPJ", cab.cnpj], ["Responsável técnico", cab.responsavel], ["Data-base", dataBR(cab.dataBase)]] as const) {
    put(p, r, 0, { v: k, s: { font: { bold: true } } }); put(p, r++, 1, { v: v || "-" });
  }
  r++;
  put(p, r, 0, { v: "Premissa", s: HEAD }); put(p, r++, 1, { v: "Valor", s: HEAD });
  for (const cp of campos) {
    const v = premissas[cp.chave];
    put(p, r, 0, { v: cp.rotulo });
    if (cp.tipo === "bool") put(p, r++, 1, { v: v ? "Sim" : "Não", s: INPUT });
    else put(p, r++, 1, { v: Number(v) || 0, z: cp.tipo === "brl" ? MOEDA : cp.tipo === "pct" ? PCT : INT, s: INPUT });
  }
  r++;
  put(p, r, 0, { v: "Indicador", s: HEAD }); put(p, r++, 1, { v: "Resultado", s: HEAD });
  for (const k of rel.kpis) {
    put(p, r, 0, { v: k.rotulo });
    if (k.valor === null || !Number.isFinite(k.valor)) put(p, r++, 1, { v: k.textoNulo ?? "-", s: CALC });
    else if (k.formato === "anos") put(p, r++, 1, { v: k.valor, z: '0.0 "anos"', s: CALC });
    else if (k.formato === "x") put(p, r++, 1, { v: k.valor, z: "0.00", s: CALC });
    else put(p, r++, 1, { v: k.valor, z: k.formato === "pct" ? PCT : MOEDA, s: CALC });
  }
  r++;
  put(p, r, 0, { v: "Parecer", s: { font: { bold: true } } }); put(p, r++, 1, { v: rel.parecer.titulo, s: { font: { bold: true } } });
  put(p, r++, 0, { v: rel.parecer.texto });
  fechar(p, r, 2);
  p["!cols"] = [{ wch: 52 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, p, "Premissas");

  // Demonstrativo
  const d: Record<string, unknown> = {};
  const n = rel.anos + 1;
  put(d, 0, 0, { v: `Demonstrativo anual — ${def.titulo}`, s: TITULO });
  put(d, 2, 0, { v: "Conta", s: HEAD });
  for (let t = 0; t < n; t++) put(d, 2, t + 1, { v: `Ano ${t}`, s: HEAD });
  r = 3;
  for (const b of rel.blocos) {
    put(d, r++, 0, { v: b.titulo, s: SECAO });
    for (const l of b.linhas) {
      const s = l.estilo === "total" ? TOTAL : l.estilo === "subtotal" ? SUB : l.estilo === "acumulado" ? { font: { italic: true } } : CALC;
      put(d, r, 0, { v: l.rotulo, s: l.estilo === "total" || l.estilo === "subtotal" ? s : undefined });
      l.valores.forEach((v, t) => put(d, r, t + 1, v === null ? { v: "–", s: { ...s, alignment: { horizontal: "right" } } } : { v: Math.round(v * 100) / 100, z: MOEDA, s }));
      r++;
    }
  }
  fechar(d, r, n + 1);
  d["!cols"] = [{ wch: 46 }, ...Array.from({ length: n }, () => ({ wch: 17 }))];
  d["!freeze"] = { xSplit: 1, ySplit: 3 };
  XLSX.utils.book_append_sheet(wb, d, "Demonstrativo");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
