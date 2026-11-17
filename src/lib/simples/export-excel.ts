import { MES_CURTO, type ResultadoEmpresa } from "./calculo";
import { COLUNAS_ANEXO, NOME_ANEXO, NOME_COLUNA, ORDEM_TRIBUTOS, TRIBUTOS_ANEXO, type AnexoId } from "./tabelas";
import type { EmpresaSimples } from "./store";
import { nomeArquivoSimples } from "./formato";

const MOEDA = '"R$" #,##0.00';
const PCT4 = "0.0000%";
type Cel = { v: string | number; t?: string; z?: string; s?: Record<string, unknown> };
const HEAD = { fill: { fgColor: { rgb: "0F2A44" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
const TITULO = { font: { bold: true, sz: 13, color: { rgb: "0F2A44" } } };
const TOTAL = { font: { bold: true }, fill: { fgColor: { rgb: "FAF3DC" } } };

/** Modelo de importação: Mês | Anexo | 6 colunas de receita. */
export async function baixarModeloImportacao(ano: number) {
  const XLSX = await import("xlsx-js-style");
  const cab = ["Mês (MM/AAAA)", "Anexo", "Tributada integral", "ST ICMS", "Monofásico", "ST + monofásico", "Serviço sem retenção", "Serviço com retenção"];
  const linhas: (string | number)[][] = [cab];
  for (let m = 1; m <= 12; m++) linhas.push([`${String(m).padStart(2, "0")}/${ano - 1}`, "I", "", "", "", "", "", ""]);
  const ws = XLSX.utils.aoa_to_sheet(linhas);
  cab.forEach((_, c) => { const ref = XLSX.utils.encode_cell({ r: 0, c }); (ws[ref] as Cel).s = HEAD; });
  ws["!cols"] = cab.map((_, i) => ({ wch: i < 2 ? 14 : 20 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Receitas");
  const ajuda = XLSX.utils.aoa_to_sheet([
    ["Como preencher"],
    ["Mês: 01/2025, jan/25, janeiro 2025 ou data do Excel."],
    ["Anexo: I, II, III, IV ou V (ou Comércio / Indústria)."],
    ["Anexos I e II usam as 4 primeiras colunas de receita; Anexos III, IV e V usam as colunas de serviço."],
    ["Meses do ano anterior alimentam o RBT12; meses do ano-calendário vão para a grade do anexo."],
    ["Valores em formato BR (1.234,56) ou US (1,234.56). Valores negativos não são aceitos."],
  ]);
  ajuda["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, ajuda, "Instruções");
  XLSX.writeFile(wb, "Ecommtabil_Simples_Modelo_Importacao.xlsx");
}

export async function exportarExcelSimples(e: EmpresaSimples, r: ResultadoEmpresa) {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const put = (ws: Record<string, unknown>, row: number, c: number, cel: Cel) => { ws[XLSX.utils.encode_cell({ r: row, c })] = { t: typeof cel.v === "number" ? "n" : "s", ...cel }; };
  const fechar = (ws: Record<string, unknown>, linhas: number, colunas: number) => { ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas - 1, c: colunas - 1 } }); };

  // Resumo
  const res: Record<string, unknown> = {};
  put(res, 0, 0, { v: "Memória de cálculo do Simples Nacional", s: TITULO });
  put(res, 1, 0, { v: `${e.razaoSocial}${e.cnpj ? ` — CNPJ ${e.cnpj}` : ""} — Ano-calendário ${e.ano}` });
  const k = r.consolidado;
  const kpis: Array<[string, number, string]> = [
    ["Faturamento no ano", k.faturamento, MOEDA], ["DAS total no ano", k.das, MOEDA],
    ["Alíquota efetiva média ponderada", k.aeMediaPonderada, PCT4], ["DAS ÷ faturamento", k.aliquotaPaga, PCT4],
    ["Economia com ST / monofásico / retenção", k.economia, MOEDA],
  ];
  kpis.forEach(([n, v, z], i) => { put(res, 3 + i, 0, { v: n, s: { font: { bold: true } } }); put(res, 3 + i, 1, { v, z }); });
  let lin = 10;
  const cab = ["Mês", "Receita total", "RBT12", ...e.anexos.map((a) => `DAS Anexo ${a}`), "DAS total"];
  cab.forEach((c, i) => put(res, lin, i, { v: c, s: HEAD }));
  for (let m = 0; m < 12; m++) {
    lin++;
    put(res, lin, 0, { v: MES_CURTO[m] });
    put(res, lin, 1, { v: k.receitaMensal[m], z: MOEDA });
    put(res, lin, 2, { v: r.rbt12[m].valor, z: MOEDA });
    e.anexos.forEach((a, i) => put(res, lin, 3 + i, { v: k.dasMensal[m][a] ?? 0, z: MOEDA }));
    put(res, lin, 3 + e.anexos.length, { v: k.dasMensal[m].total, z: MOEDA });
  }
  lin++;
  put(res, lin, 0, { v: "TOTAIS", s: TOTAL });
  put(res, lin, 1, { v: k.faturamento, z: MOEDA, s: TOTAL });
  put(res, lin, 2, { v: "", s: TOTAL });
  e.anexos.forEach((a, i) => put(res, lin, 3 + i, { v: r.anexos[a]?.totais.totalDas ?? 0, z: MOEDA, s: TOTAL }));
  put(res, lin, 3 + e.anexos.length, { v: k.das, z: MOEDA, s: TOTAL });
  lin += 2;
  put(res, lin, 0, { v: "DAS anual por tributo", s: TITULO });
  for (const t of ORDEM_TRIBUTOS) {
    if (!k.porTributo[t]) continue;
    lin++;
    put(res, lin, 0, { v: t }); put(res, lin, 1, { v: k.porTributo[t], z: MOEDA });
  }
  fechar(res, lin + 1, Math.max(cab.length, 2));
  res["!cols"] = [{ wch: 40 }, ...cab.slice(1).map(() => ({ wch: 16 }))];
  XLSX.utils.book_append_sheet(wb, res, "Resumo");

  // Uma aba por anexo
  for (const a of e.anexos) {
    const dados = r.anexos[a];
    if (!dados) continue;
    const ws: Record<string, unknown> = {};
    const trib = TRIBUTOS_ANEXO[a];
    const cols = COLUNAS_ANEXO[a];
    put(ws, 0, 0, { v: NOME_ANEXO[a as AnexoId], s: TITULO });
    const cabecalho = [
      "Mês", ...cols.map((c) => `Receita – ${NOME_COLUNA[c]}`), "Receita total", "RBT12", "Faixa", "Alíq. nominal", "Parcela a deduzir", "Alíq. efetiva",
      ...trib.flatMap((t) => [`% ${t}`, `${t} (R$)`]), ...cols.map((c) => `Imposto – ${NOME_COLUNA[c]}`), "Total do DAS",
    ];
    cabecalho.forEach((c, i) => put(ws, 2, i, { v: c, s: HEAD }));
    dados.meses.forEach((m, i) => {
      const row = 3 + i;
      let c = 0;
      put(ws, row, c++, { v: MES_CURTO[m.mes] });
      for (const col of cols) put(ws, row, c++, { v: m.receitas[col], z: MOEDA });
      put(ws, row, c++, { v: m.receitaTotal, z: MOEDA });
      put(ws, row, c++, { v: m.rbt12, z: MOEDA });
      put(ws, row, c++, { v: m.faixa === 7 ? "Acima do teto" : m.faixa === 0 ? "—" : m.faixa });
      put(ws, row, c++, { v: m.calculado ? m.aliqNominal : "—", z: PCT4 });
      put(ws, row, c++, { v: m.calculado ? m.deducao : "—", z: MOEDA });
      put(ws, row, c++, { v: m.calculado ? m.ae : "—", z: PCT4 });
      for (const t of trib) { put(ws, row, c++, { v: m.calculado ? m.partilha[t] ?? 0 : "—", z: PCT4 }); put(ws, row, c++, { v: m.tributos[t], z: MOEDA }); }
      for (const col of cols) put(ws, row, c++, { v: m.impostoPorColuna[col], z: MOEDA });
      put(ws, row, c++, { v: m.totalDas, z: MOEDA, s: { font: { bold: true } } });
    });
    const tr = 15;
    let c = 0;
    put(ws, tr, c++, { v: "TOTAIS", s: TOTAL });
    for (const col of cols) put(ws, tr, c++, { v: dados.totais.receitas[col], z: MOEDA, s: TOTAL });
    put(ws, tr, c++, { v: dados.totais.receitaTotal, z: MOEDA, s: TOTAL });
    for (let i = 0; i < 5; i++) put(ws, tr, c++, { v: "", s: TOTAL });
    for (const t of trib) { put(ws, tr, c++, { v: "", s: TOTAL }); put(ws, tr, c++, { v: dados.totais.tributos[t], z: MOEDA, s: TOTAL }); }
    for (const col of cols) put(ws, tr, c++, { v: dados.totais.impostoPorColuna[col], z: MOEDA, s: TOTAL });
    put(ws, tr, c++, { v: dados.totais.totalDas, z: MOEDA, s: TOTAL });
    fechar(ws, tr + 1, cabecalho.length);
    ws["!cols"] = cabecalho.map((_, i) => ({ wch: i === 0 ? 10 : 16 }));
    ws["!rows"] = [{}, {}, { hpt: 42 }];
    XLSX.utils.book_append_sheet(wb, ws, `Anexo ${a}`);
  }
  XLSX.writeFile(wb, nomeArquivoSimples(e.razaoSocial, e.ano, "xlsx"));
}
