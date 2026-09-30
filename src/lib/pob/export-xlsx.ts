import * as XLSX from "xlsx";

export type AbaXlsx = { nome: string; linhas: (string | number | null)[][] };

/** Baixa um .xlsx com uma ou mais abas (valores numéricos crus, formato pt-BR). */
export function exportarXlsx(arquivo: string, abas: AbaXlsx[]) {
  const wb = XLSX.utils.book_new();
  for (const a of abas) {
    const ws = XLSX.utils.aoa_to_sheet(a.linhas);
    const cols = a.linhas[0]?.length ?? 0;
    ws["!cols"] = Array.from({ length: cols }, (_, i) => ({ wch: i === 0 ? 38 : 14 }));
    for (const ref of Object.keys(ws)) {
      const c = ws[ref] as XLSX.CellObject;
      if (!ref.startsWith("!") && c.t === "n") c.z = "#,##0.00;(#,##0.00);-";
    }
    XLSX.utils.book_append_sheet(wb, ws, a.nome.slice(0, 31).replace(/[\\/?*[\]:]/g, "-"));
  }
  const nome = arquivo.replace(/[^\p{L}\p{N} _.-]/gu, "").trim() || "SAGA";
  XLSX.writeFile(wb, `${nome}.xlsx`);
}
