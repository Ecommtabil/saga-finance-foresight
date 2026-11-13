import type { NivelPVM, RegistroPVM, ResultadoPVM } from "@/lib/pvm";
import { mesNome, periodoNome } from "./importacao";

const MOEDA = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
const QTD = "#,##0.##";
const PCT = "0.00%";
const PP = '0.00" p.p."';
const NIVEL: Record<NivelPVM, string> = { unidade: "Unidade", categoria: "Categoria", produto: "Produto" };

type Cel = { v: string | number; t?: string; z?: string; f?: string; s?: Record<string, unknown> };
const HEAD = { fill: { fgColor: { rgb: "0B1F3A" } }, font: { bold: true, color: { rgb: "FFFFFF" } }, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
const SUB = { fill: { fgColor: { rgb: "E8ECF3" } }, font: { bold: true, color: { rgb: "0B1F3A" } }, alignment: { horizontal: "center" } };
const TITULO = { font: { bold: true, sz: 13, color: { rgb: "0B1F3A" } } };
const TOTAL = { font: { bold: true }, fill: { fgColor: { rgb: "FAF3DC" } } };

export function nomeArquivoPVM(cliente: string, ext: string) {
  const nome = cliente.trim().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_").slice(0, 80) || "Cliente";
  return `Ecommtabil_PVM_${nome}.${ext}`;
}

export async function exportarExcelPVM(cliente: string, registros: RegistroPVM[], niveis: Partial<Record<NivelPVM, ResultadoPVM>>, atual: ResultadoPVM) {
  const XLSX = await import("xlsx-js-style");
  const wb = XLSX.utils.book_new();
  const put = (ws: Record<string, unknown>, r: number, c: number, cel: Cel) => { ws[XLSX.utils.encode_cell({ r, c })] = { t: typeof cel.v === "number" ? "n" : "s", ...cel }; };
  const fechar = (ws: Record<string, unknown>, linhas: number, colunas: number) => { ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, linhas - 1), c: colunas - 1 } }); };

  // Base de Dados (já filtrada)
  const base: Record<string, unknown> = {};
  ["Unidade", "Categoria", "Produto", "Métrica", "Mês", "Valor"].forEach((h, c) => put(base, 0, c, { v: h, s: HEAD }));
  registros.forEach((x, i) => {
    [x.unidade, x.categoria, x.produto, x.metrica, mesNome(x.mes)].forEach((v, c) => put(base, i + 1, c, { v }));
    put(base, i + 1, 5, { v: x.valor, z: x.metrica === "Receita" ? MOEDA : QTD });
  });
  fechar(base, registros.length + 1, 6);
  base["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, base, "Base de Dados");

  // Modelagem: as 3 tabelas no layout da tela
  const mod: Record<string, unknown> = {};
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];
  let r = 0;
  put(mod, r++, 0, { v: `Análise PVM — ${cliente || "Cliente"} — ${periodoNome(atual.base)} × ${periodoNome(atual.atual)}`, s: TITULO });
  r++;
  const grupos: Array<[string, number]> = [["Quantidade", 2], ["Receita", 2], ["Mix %", 2], ["Preço médio", 2], ["Diferenças", 4], ["Efeitos", 4]];
  const subs = ["Base", "Atual", "Base", "Atual", "Base", "Atual", "Base", "Atual", "Volume", "Receita", "Preço", "Mix", "Volume", "Preço", "Mix", "Total"];
  const fmts = [QTD, QTD, MOEDA, MOEDA, PCT, PCT, MOEDA, MOEDA, QTD, MOEDA, MOEDA, PP, MOEDA, MOEDA, MOEDA, MOEDA];
  for (const nivel of ["unidade", "categoria", "produto"] as NivelPVM[]) {
    const res = niveis[nivel];
    if (!res) continue;
    put(mod, r++, 0, { v: `Nível: ${NIVEL[nivel]}`, s: TITULO });
    put(mod, r, 0, { v: NIVEL[nivel], s: HEAD });
    merges.push({ s: { r, c: 0 }, e: { r: r + 1, c: 0 } });
    let c = 1;
    for (const [g, n] of grupos) { put(mod, r, c, { v: g, s: HEAD }); for (let k = 1; k < n; k++) put(mod, r, c + k, { v: "", s: HEAD }); merges.push({ s: { r, c }, e: { r, c: c + n - 1 } }); c += n; }
    put(mod, r + 1, 0, { v: "", s: HEAD });
    subs.forEach((s, i) => put(mod, r + 1, i + 1, { v: s, s: SUB }));
    r += 2;
    const ini = r;
    for (const it of res.itens) {
      put(mod, r, 0, { v: it.item + (it.status === "novo" ? " (novo)" : it.status === "descontinuado" ? " (descontinuado)" : "") });
      [it.q0, it.q1, it.r0, it.r1, it.mix0, it.mix1, it.p0, it.p1, it.dQ, it.dR, it.dP, it.dMix * 100, it.volume, it.preco, it.mix, it.total]
        .forEach((v, i) => put(mod, r, i + 1, { v, z: fmts[i] }));
      r++;
    }
    const col = (i: number) => XLSX.utils.encode_col(i + 1);
    const t = res.total;
    put(mod, r, 0, { v: "TOTAL", s: TOTAL });
    const totais: Array<number | null> = [t.q0, t.q1, t.r0, t.r1, 1, 1, t.p0, t.p1, t.dQ, t.dR, t.p1 - t.p0, 0, t.volume, t.preco, t.mix, t.total];
    totais.forEach((v, i) => {
      const somavel = [0, 1, 2, 3, 4, 5, 8, 9, 12, 13, 14, 15].includes(i);
      const f = somavel ? `SUM(${col(i)}${ini + 1}:${col(i)}${r})` : i === 6 ? `${col(2)}${r + 1}/${col(0)}${r + 1}` : i === 7 ? `${col(3)}${r + 1}/${col(1)}${r + 1}` : undefined;
      put(mod, r, i + 1, { v: v ?? 0, z: fmts[i], s: TOTAL, ...(f ? { f } : {}) });
    });
    r += 3;
  }
  fechar(mod, r, 17);
  mod["!merges"] = merges;
  mod["!cols"] = [{ wch: 26 }, ...subs.map(() => ({ wch: 15 }))];
  XLSX.utils.book_append_sheet(wb, mod, "Modelagem");

  // Resumo: cascata em tabela
  const res: Record<string, unknown> = {};
  put(res, 0, 0, { v: "Etapa", s: HEAD }); put(res, 0, 1, { v: "Valor", s: HEAD }); put(res, 0, 2, { v: "% sobre receita base", s: HEAD });
  const t = atual.total;
  const etapas: Array<[string, number]> = [[`Receita anterior (${periodoNome(atual.base)})`, t.r0], ["Ef. Volume", t.volume], ["Ef. Preço", t.preco], ["Ef. Mix", t.mix]];
  etapas.forEach(([n, v], i) => { put(res, i + 1, 0, { v: n }); put(res, i + 1, 1, { v, z: MOEDA }); put(res, i + 1, 2, { v: t.r0 ? v / t.r0 : 0, z: PCT, f: `B${i + 2}/$B$2` }); });
  put(res, 5, 0, { v: `Receita atual (${periodoNome(atual.atual)})`, s: TOTAL }); put(res, 5, 1, { v: t.r1, z: MOEDA, s: TOTAL }); put(res, 5, 2, { v: t.r0 ? t.r1 / t.r0 : 0, z: PCT, s: TOTAL, f: "B6/$B$2" });
  put(res, 7, 0, { v: "Conferência (anterior + efeitos − atual)" }); put(res, 7, 1, { v: atual.diferenca, z: MOEDA, f: "B2+B3+B4+B5-B6" });
  put(res, 8, 0, { v: `Nível: ${NIVEL[atual.nivel]}` });
  fechar(res, 9, 3);
  res["!cols"] = [{ wch: 40 }, { wch: 20 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, res, "Resumo");

  XLSX.writeFile(wb, nomeArquivoPVM(cliente, "xlsx"));
}
