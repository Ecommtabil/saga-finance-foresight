import * as XLSX from "xlsx";

export interface LinhaVenda {
  periodo: string;
  receitaBruta: number;
  devolucoes: number;
  comissoes: number;
  fretes: number;
  custos: number;
  outrasReceitas: number;
}

export interface LinhaDespesaFixa {
  periodo: string;
  conta: string;
  valor: number;
}

export interface GruposCrescimento {
  receita: number;
  devolucoes: number;
  comissoes: number;
  fretes: number;
  custos: number;
  despesasFixas: number;
  outrasReceitas: number;
}

export const CRESCIMENTO_PADRAO: GruposCrescimento = {
  receita: 0.05,
  devolucoes: 0.05,
  comissoes: 0.05,
  fretes: 0.05,
  custos: 0.04,
  despesasFixas: 0.02,
  outrasReceitas: 0,
};

export const GRUPOS_LABEL: { key: keyof GruposCrescimento; label: string }[] = [
  { key: "receita", label: "Receita Bruta de Vendas" },
  { key: "devolucoes", label: "Devoluções e Descontos" },
  { key: "outrasReceitas", label: "Outras Receitas" },
  { key: "custos", label: "Custo das Mercadorias / Serviços" },
  { key: "comissoes", label: "Comissões sobre Vendas" },
  { key: "fretes", label: "Fretes sobre Vendas" },
  { key: "despesasFixas", label: "Despesas Fixas" },
];

export interface DreVendasPeriodo {
  periodo: string;
  projetado: boolean;
  receitaBruta: number;
  devolucoes: number;
  impostos: number;
  outrasReceitas: number;
  receitaLiquida: number;
  custos: number;
  lucroBruto: number;
  comissoes: number;
  fretes: number;
  margemContribuicao: number;
  despesasFixas: number;
  resultadoOperacional: number;
}

const normHeader = (h: string) =>
  String(h ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

function normPeriodo(v: unknown, fallback: number): string {
  if (v === null || v === undefined || v === "") return String(fallback);
  if (v instanceof Date) {
    const y = v.getUTCFullYear();
    const m = String(v.getUTCMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }
  return String(v).trim();
}

function num(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v === null || v === undefined || v === "") return 0;
  const s = String(v).replace(/\s|R\$/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function findCol(headers: string[], candidates: string[]): number {
  return headers.findIndex((h) => candidates.some((c) => h.includes(c)));
}

/* ---------------- Planilhas modelo ---------------- */

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function toBlob(wb: XLSX.WorkBook): Blob {
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function baixarModeloVendas() {
  const wb = XLSX.utils.book_new();
  const header = [
    "Periodo",
    "Receita Bruta",
    "Devolucoes",
    "Comissoes",
    "Fretes",
    "Custos",
    "Outras Receitas",
  ];
  const rows = [
    ["2024-01", 250000, 5000, 12500, 6000, 130000, 0],
    ["2024-02", 268000, 4200, 13400, 6300, 139000, 0],
    ["2024-03", 291000, 6100, 14550, 6900, 151000, 1500],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, ...rows]), "Vendas");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["Instruções"],
      ["Informe um registro por período (mês, trimestre, ano ou qualquer rótulo)."],
      ["Use valores positivos: o sistema aplica os sinais na montagem do DRE."],
      ["A carga tributária é informada em % dentro do sistema."],
    ]),
    "Instrucoes",
  );
  baixar(toBlob(wb), "SAGA_Modelo_DRE_Vendas.xlsx");
}

export function baixarModeloDespesasFixas() {
  const wb = XLSX.utils.book_new();
  const header = ["Periodo", "Conta", "Valor"];
  const rows = [
    ["2024-01", "Folha administrativa", 38000],
    ["2024-01", "Aluguel", 12000],
    ["2024-02", "Folha administrativa", 38000],
    ["2024-02", "Aluguel", 12000],
    ["2024-03", "Folha administrativa", 39500],
    ["2024-03", "Aluguel", 12000],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([header, ...rows]),
    "DespesasFixas",
  );
  baixar(toBlob(wb), "SAGA_Modelo_Despesas_Fixas.xlsx");
}

/* ---------------- Parsers ---------------- */

function sheetRows(file: ArrayBuffer, preferido: string[]) {
  const wb = XLSX.read(file, { type: "array", cellDates: true });
  const nome =
    wb.SheetNames.find((n) => preferido.includes(normHeader(n))) ??
    wb.SheetNames.find((n) => !normHeader(n).startsWith("instru")) ??
    wb.SheetNames[0];
  const ws = wb.Sheets[nome];
  return XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(ws, {
    header: 1,
    blankrows: false,
    defval: null,
  });
}

export async function parseVendas(file: File): Promise<LinhaVenda[]> {
  const rows = sheetRows(await file.arrayBuffer(), ["vendas"]);
  if (rows.length < 2) throw new Error("Planilha de vendas vazia.");
  const headers = rows[0].map((h) => normHeader(String(h ?? "")));
  const iPer = findCol(headers, ["periodo", "mes", "data", "competencia"]);
  const iRec = findCol(headers, ["receita bruta", "receita", "vendas", "faturamento"]);
  if (iPer < 0 || iRec < 0)
    throw new Error("Colunas obrigatórias não encontradas: Periodo e Receita Bruta.");
  const iDev = findCol(headers, ["devolu", "desconto"]);
  const iCom = findCol(headers, ["comiss"]);
  const iFre = findCol(headers, ["frete"]);
  const iCus = findCol(headers, ["custo", "cmv"]);
  const iOut = findCol(headers, ["outras receitas", "outras"]);

  const out: LinhaVenda[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((v) => v === null || v === "")) continue;
    out.push({
      periodo: normPeriodo(r[iPer], i),
      receitaBruta: Math.abs(num(r[iRec])),
      devolucoes: iDev >= 0 ? Math.abs(num(r[iDev])) : 0,
      comissoes: iCom >= 0 ? Math.abs(num(r[iCom])) : 0,
      fretes: iFre >= 0 ? Math.abs(num(r[iFre])) : 0,
      custos: iCus >= 0 ? Math.abs(num(r[iCus])) : 0,
      outrasReceitas: iOut >= 0 ? Math.abs(num(r[iOut])) : 0,
    });
  }
  if (!out.length) throw new Error("Nenhuma linha de venda encontrada.");
  return out;
}

export async function parseDespesasFixas(file: File): Promise<LinhaDespesaFixa[]> {
  const rows = sheetRows(await file.arrayBuffer(), ["despesasfixas", "despesas fixas", "despesas"]);
  if (rows.length < 2) throw new Error("Planilha de despesas fixas vazia.");
  const headers = rows[0].map((h) => normHeader(String(h ?? "")));
  const iPer = findCol(headers, ["periodo", "mes", "data", "competencia"]);
  const iCon = findCol(headers, ["conta", "descri", "despesa"]);
  const iVal = findCol(headers, ["valor", "total"]);
  if (iPer < 0 || iVal < 0)
    throw new Error("Colunas obrigatórias não encontradas: Periodo e Valor.");
  const out: LinhaDespesaFixa[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((v) => v === null || v === "")) continue;
    out.push({
      periodo: normPeriodo(r[iPer], i),
      conta: iCon >= 0 ? String(r[iCon] ?? "Despesa").trim() : "Despesa",
      valor: Math.abs(num(r[iVal])),
    });
  }
  if (!out.length) throw new Error("Nenhuma despesa fixa encontrada.");
  return out;
}

/* ---------------- Montagem do DRE ---------------- */

export function periodosDisponiveis(vendas: LinhaVenda[]): string[] {
  return Array.from(new Set(vendas.map((v) => v.periodo))).sort();
}

export function despesaFixaDoPeriodo(
  despesas: LinhaDespesaFixa[],
  periodo: string,
): number {
  return despesas.filter((d) => d.periodo === periodo).reduce((a, d) => a + d.valor, 0);
}

export function montarDre(
  periodo: string,
  vendas: LinhaVenda[],
  despesas: LinhaDespesaFixa[],
  cargaTributaria: number,
  projetado = false,
): DreVendasPeriodo {
  const linhas = vendas.filter((v) => v.periodo === periodo);
  const soma = (f: (l: LinhaVenda) => number) => linhas.reduce((a, l) => a + f(l), 0);
  const receitaBruta = soma((l) => l.receitaBruta);
  const devolucoes = soma((l) => l.devolucoes);
  const comissoes = soma((l) => l.comissoes);
  const fretes = soma((l) => l.fretes);
  const custos = soma((l) => l.custos);
  const outrasReceitas = soma((l) => l.outrasReceitas);
  const despesasFixas = despesaFixaDoPeriodo(despesas, periodo);
  return finalizar({
    periodo,
    projetado,
    receitaBruta,
    devolucoes,
    comissoes,
    fretes,
    custos,
    outrasReceitas,
    despesasFixas,
    cargaTributaria,
  });
}

function finalizar(base: {
  periodo: string;
  projetado: boolean;
  receitaBruta: number;
  devolucoes: number;
  comissoes: number;
  fretes: number;
  custos: number;
  outrasReceitas: number;
  despesasFixas: number;
  cargaTributaria: number;
}): DreVendasPeriodo {
  const impostos = (base.receitaBruta - base.devolucoes) * base.cargaTributaria;
  const receitaLiquida =
    base.receitaBruta - base.devolucoes - impostos + base.outrasReceitas;
  const lucroBruto = receitaLiquida - base.custos;
  const margemContribuicao = lucroBruto - base.comissoes - base.fretes;
  const resultadoOperacional = margemContribuicao - base.despesasFixas;
  return {
    periodo: base.periodo,
    projetado: base.projetado,
    receitaBruta: base.receitaBruta,
    devolucoes: base.devolucoes,
    impostos,
    outrasReceitas: base.outrasReceitas,
    receitaLiquida,
    custos: base.custos,
    lucroBruto,
    comissoes: base.comissoes,
    fretes: base.fretes,
    margemContribuicao,
    despesasFixas: base.despesasFixas,
    resultadoOperacional,
  };
}

/** Consolida os períodos selecionados em uma base única (soma ou média). */
export function montarBase(
  periodos: string[],
  vendas: LinhaVenda[],
  despesas: LinhaDespesaFixa[],
  cargaTributaria: number,
  modo: "soma" | "media",
  rotulo = "Base",
): DreVendasPeriodo {
  const itens = periodos.map((p) => montarDre(p, vendas, despesas, cargaTributaria));
  const div = modo === "media" && itens.length ? itens.length : 1;
  const agg = (f: (d: DreVendasPeriodo) => number) =>
    itens.reduce((a, d) => a + f(d), 0) / div;
  return finalizar({
    periodo: rotulo,
    projetado: false,
    receitaBruta: agg((d) => d.receitaBruta),
    devolucoes: agg((d) => d.devolucoes),
    comissoes: agg((d) => d.comissoes),
    fretes: agg((d) => d.fretes),
    custos: agg((d) => d.custos),
    outrasReceitas: agg((d) => d.outrasReceitas),
    despesasFixas: agg((d) => d.despesasFixas),
    cargaTributaria,
  });
}

export function projetar(
  base: DreVendasPeriodo,
  crescimento: GruposCrescimento,
  cargaTributaria: number,
  quantidade: number,
  rotulo: (i: number) => string,
): DreVendasPeriodo[] {
  const out: DreVendasPeriodo[] = [];
  const g = (v: number, taxa: number, i: number) => v * Math.pow(1 + taxa, i);
  for (let i = 1; i <= quantidade; i++) {
    out.push(
      finalizar({
        periodo: rotulo(i),
        projetado: true,
        receitaBruta: g(base.receitaBruta, crescimento.receita, i),
        devolucoes: g(base.devolucoes, crescimento.devolucoes, i),
        comissoes: g(base.comissoes, crescimento.comissoes, i),
        fretes: g(base.fretes, crescimento.fretes, i),
        custos: g(base.custos, crescimento.custos, i),
        outrasReceitas: g(base.outrasReceitas, crescimento.outrasReceitas, i),
        despesasFixas: g(base.despesasFixas, crescimento.despesasFixas, i),
        cargaTributaria,
      }),
    );
  }
  return out;
}
