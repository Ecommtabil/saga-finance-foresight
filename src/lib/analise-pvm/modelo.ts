// Modelo de planilha para download (aba "Base de Dados").
export async function baixarModeloPVM() {
  const XLSX = await import("xlsx-js-style");
  const navy = { fill: { fgColor: { rgb: "0B1F3A" } }, font: { bold: true, color: { rgb: "FFFFFF" } } };
  const linhas = [
    ["Unidade", "Categoria", "Produto", "Métrica", "Mês", "Valor"],
    ["Fortaleza", "Bebidas", "Suco de laranja 1L", "Quantidade", "Janeiro", 1250],
    ["Fortaleza", "Bebidas", "Suco de laranja 1L", "Receita", "Janeiro", 11187.5],
    ["Fortaleza", "Bebidas", "Suco de laranja 1L", "Quantidade", "Fevereiro", 1310],
  ];
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  for (let c = 0; c < 6; c++) ws[XLSX.utils.encode_cell({ r: 0, c })].s = navy;
  ws["F3"].z = '"R$" #,##0.00';
  ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 13 }, { wch: 12 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Base de Dados");
  XLSX.writeFile(wb, "Modelo_Analise_PVM.xlsx");
}
