import * as XLSX from "xlsx";

export interface LinhaVenda {
  periodo: string;
  empresa: string;
  produto: string;
  sku: string;
  marketplace: string;
  estado: string;
  fornecedor: string;
  unidades: number;
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
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (iso) return `${iso[1]}-${iso[2]}`;
  const br = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
  if (br) return `${br[3]}-${br[2]}`;
  return s;
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
    "Empresa",
    "Data da Venda",
    "Marketplace",
    "Unidades",
    "Receita por Produto",
    "Custo",
    "Tarifa de venda e impostos",
    "Receita por envio",
    "Tarifas de Envio",
    "Cupom",
    "Comissão Afiliado",
    "Frete Entrega Direta",
    "Total",
    "SKU",
    "Estado",
    "Cancelamentos e Reembolsos",
    "Produto",
    "Fornecedor",
    "Frete Comprador",
    "Frete Vendedor",
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([header]),
    "Vendas Reorganizado",
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["MODELO DE PREENCHIMENTO — VENDAS (MULTI-EMPRESA)"],
      ["Preencha uma linha por venda na aba 'Vendas Reorganizado'."],
      ["Empresa — nome da empresa/loja à qual a venda pertence (obrigatório)."],
      ["Data da Venda — data da venda; o sistema agrupa por mês (AAAA-MM)."],
      ["Receita por Produto — valor bruto do produto (positivo)."],
      ["Custo — custo do produto vendido (positivo)."],
      ["Tarifa de venda e impostos / Comissão Afiliado — tarifas do marketplace (negativos)."],
      ["Receita por envio — frete recebido do comprador (positivo)."],
      ["Tarifas de Envio / Frete Entrega Direta — custo de frete (negativos)."],
      ["Cupom e Cancelamentos e Reembolsos — descontos e estornos (negativos)."],
      ["A coluna 'Total' é calculada e não é usada na montagem do DRE."],
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
  const rows = sheetRows(await file.arrayBuffer(), [
    "vendas reorganizado",
    "vendas",
  ]);
  if (rows.length < 2) throw new Error("Planilha de vendas vazia.");
  const headers = rows[0].map((h) => normHeader(String(h ?? "")));
  const iPer = findCol(headers, ["data da venda", "periodo", "mes", "data", "competencia"]);
  const iRec = findCol(headers, [
    "receita por produto",
    "receita bruta",
    "receita",
    "vendas",
    "faturamento",
  ]);
  if (iPer < 0 || iRec < 0)
    throw new Error(
      "Colunas obrigatórias não encontradas: 'Data da Venda' e 'Receita por Produto'.",
    );
  const iEmp = findCol(headers, ["empresa", "loja"]);
  const iUni = findCol(headers, ["unidades", "quantidade"]);
  const iCup = findCol(headers, ["cupom", "desconto"]);
  const iCanc = findCol(headers, ["cancelamento", "reembolso", "devolu"]);
  const iTar = findCol(headers, ["tarifa de venda", "comiss"]);
  const iAfi = findCol(headers, ["comissao afiliado", "afiliado"]);
  const iFreEnv = findCol(headers, ["tarifas de envio", "tarifa de envio"]);
  const iFreDir = findCol(headers, ["frete entrega direta"]);
  const iRecEnv = findCol(headers, ["receita por envio"]);
  const iCus = findCol(headers, ["custo", "cmv"]);
  const iProd = findCol(headers, ["produto", "descricao do item", "item"]);
  const iSku = findCol(headers, ["sku", "codigo"]);
  const iMkt = findCol(headers, ["marketplace", "canal"]);
  const iEst = findCol(headers, ["estado", "uf"]);
  const iForn = findCol(headers, ["fornecedor"]);

  const out: LinhaVenda[] = [];
  const abs = (i: number, r: (string | number | Date | null)[]) =>
    i >= 0 ? Math.abs(num(r[i])) : 0;
  const txt = (i: number, r: (string | number | Date | null)[], fb: string) =>
    i >= 0 ? String(r[i] ?? "").trim() || fb : fb;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((v) => v === null || v === "")) continue;
    const comissoes =
      abs(iTar, r) + (iAfi >= 0 && iAfi !== iTar ? abs(iAfi, r) : 0);
    const fretes = abs(iFreEnv, r) + abs(iFreDir, r);
    out.push({
      periodo: normPeriodo(r[iPer], i),
      empresa: iEmp >= 0 ? String(r[iEmp] ?? "").trim() || "—" : "—",
      produto: txt(iProd, r, "—"),
      sku: txt(iSku, r, "—"),
      marketplace: txt(iMkt, r, "—"),
      estado: txt(iEst, r, "—"),
      fornecedor: txt(iForn, r, "—"),
      unidades: iUni >= 0 ? num(r[iUni]) : 0,
      receitaBruta: abs(iRec, r),
      devolucoes: abs(iCup, r) + abs(iCanc, r),
      comissoes,
      fretes,
      custos: abs(iCus, r),
      outrasReceitas: abs(iRecEnv, r),
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

/**
 * Como as despesas fixas importadas são alocadas aos períodos de vendas.
 * - periodo: casa período a período (exige mesma competência AAAA-MM)
 * - media:   média mensal das despesas importadas replicada em cada período
 * - total:   total das despesas rateado igualmente entre os períodos da base
 * - auto:    usa "periodo" se houver competências coincidentes; senão "media"
 */
export type ModoDespesas = "auto" | "periodo" | "media" | "total";

export function modoDespesasEfetivo(
  despesas: LinhaDespesaFixa[],
  periodos: string[],
  modo: ModoDespesas,
): Exclude<ModoDespesas, "auto"> {
  if (modo !== "auto") return modo;
  const casa = despesas.some((d) => periodos.includes(d.periodo));
  return casa ? "periodo" : "media";
}

/** Valor de despesa fixa alocado a cada período de vendas. */
export function alocarDespesas(
  despesas: LinhaDespesaFixa[],
  periodos: string[],
  modo: ModoDespesas = "auto",
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const p of periodos) out[p] = 0;
  if (!despesas.length || !periodos.length) return out;
  const efetivo = modoDespesasEfetivo(despesas, periodos, modo);
  const total = despesas.reduce((a, d) => a + d.valor, 0);
  if (efetivo === "periodo") {
    for (const d of despesas)
      if (p_in(out, d.periodo)) out[d.periodo] += d.valor;
    return out;
  }
  if (efetivo === "total") {
    const parte = total / periodos.length;
    for (const p of periodos) out[p] = parte;
    return out;
  }
  const nMeses = new Set(despesas.map((d) => d.periodo)).size || 1;
  const media = total / nMeses;
  for (const p of periodos) out[p] = media;
  return out;
}

const p_in = (o: Record<string, number>, k: string) =>
  Object.prototype.hasOwnProperty.call(o, k);

/** Contas de despesa fixa já alocadas aos períodos de vendas. */
export function contasDespesaFixaAlocadas(
  despesas: LinhaDespesaFixa[],
  periodos: string[],
  modo: ModoDespesas = "auto",
): { conta: string; porPeriodo: Record<string, number>; total: number }[] {
  if (!despesas.length || !periodos.length) return [];
  const efetivo = modoDespesasEfetivo(despesas, periodos, modo);
  const contas = Array.from(new Set(despesas.map((d) => d.conta)));
  return contas
    .map((conta) => {
      const linhas = despesas.filter((d) => d.conta === conta);
      const porPeriodo: Record<string, number> = {};
      for (const p of periodos) porPeriodo[p] = 0;
      if (efetivo === "periodo") {
        for (const d of linhas)
          if (p_in(porPeriodo, d.periodo)) porPeriodo[d.periodo] += d.valor;
      } else {
        const totalConta = linhas.reduce((a, d) => a + d.valor, 0);
        const div =
          efetivo === "total"
            ? periodos.length
            : new Set(linhas.map((d) => d.periodo)).size || 1;
        const parte = totalConta / div;
        for (const p of periodos) porPeriodo[p] = parte;
      }
      return {
        conta,
        porPeriodo,
        total: Object.values(porPeriodo).reduce((a, b) => a + b, 0),
      };
    })
    .sort((a, b) => b.total - a.total);
}

/** Períodos presentes na planilha de despesas fixas. */
export function periodosDespesas(despesas: LinhaDespesaFixa[]): string[] {
  return Array.from(new Set(despesas.map((d) => d.periodo))).sort();
}

/** Contas de despesa fixa agregadas por período (para detalhar dentro do DRE). */
export function contasDespesaFixa(
  despesas: LinhaDespesaFixa[],
  periodos: string[],
): { conta: string; porPeriodo: Record<string, number>; total: number }[] {
  const mapa = new Map<string, Record<string, number>>();
  for (const d of despesas) {
    if (!periodos.includes(d.periodo)) continue;
    const linha = mapa.get(d.conta) ?? {};
    linha[d.periodo] = (linha[d.periodo] ?? 0) + d.valor;
    mapa.set(d.conta, linha);
  }
  return Array.from(mapa.entries())
    .map(([conta, porPeriodo]) => ({
      conta,
      porPeriodo,
      total: Object.values(porPeriodo).reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

/* ---------------- Analise de produtos ---------------- */

export type DimensaoProduto = "produto" | "sku" | "marketplace" | "estado" | "fornecedor" | "empresa";

export interface ResumoProduto {
  chave: string;
  unidades: number;
  receitaBruta: number;
  devolucoes: number;
  comissoes: number;
  fretes: number;
  custos: number;
  outrasReceitas: number;
  receitaLiquida: number;
  margemContribuicao: number;
  margemPct: number;
  ticketMedio: number;
  participacao: number;
}

export function resumoPorDimensao(
  vendas: LinhaVenda[],
  periodos: string[],
  dimensao: DimensaoProduto,
  cargaTributaria: number,
): ResumoProduto[] {
  const base = periodos.length
    ? vendas.filter((v) => periodos.includes(v.periodo))
    : vendas;
  const mapa = new Map<string, ResumoProduto>();
  for (const v of base) {
    const chave = (v[dimensao] || "—") as string;
    const r =
      mapa.get(chave) ??
      {
        chave,
        unidades: 0,
        receitaBruta: 0,
        devolucoes: 0,
        comissoes: 0,
        fretes: 0,
        custos: 0,
        outrasReceitas: 0,
        receitaLiquida: 0,
        margemContribuicao: 0,
        margemPct: 0,
        ticketMedio: 0,
        participacao: 0,
      };
    r.unidades += v.unidades;
    r.receitaBruta += v.receitaBruta;
    r.devolucoes += v.devolucoes;
    r.comissoes += v.comissoes;
    r.fretes += v.fretes;
    r.custos += v.custos;
    r.outrasReceitas += v.outrasReceitas;
    mapa.set(chave, r);
  }
  const itens = Array.from(mapa.values());
  const totalReceita = itens.reduce((a, i) => a + i.receitaBruta, 0);
  for (const i of itens) {
    const impostos = (i.receitaBruta - i.devolucoes) * cargaTributaria;
    i.receitaLiquida = i.receitaBruta - i.devolucoes - impostos + i.outrasReceitas;
    i.margemContribuicao = i.receitaLiquida - i.custos - i.comissoes - i.fretes;
    i.margemPct = i.receitaLiquida ? i.margemContribuicao / i.receitaLiquida : 0;
    i.ticketMedio = i.unidades ? i.receitaBruta / i.unidades : 0;
    i.participacao = totalReceita ? i.receitaBruta / totalReceita : 0;
  }
  return itens.sort((a, b) => b.receitaBruta - a.receitaBruta);
}

/** Evolução mensal de um item da dimensão escolhida. */
export function evolucaoDimensao(
  vendas: LinhaVenda[],
  dimensao: DimensaoProduto,
  chave: string,
): { periodo: string; receita: number; unidades: number }[] {
  const mapa = new Map<string, { receita: number; unidades: number }>();
  for (const v of vendas) {
    if (((v[dimensao] || "—") as string) !== chave) continue;
    const cur = mapa.get(v.periodo) ?? { receita: 0, unidades: 0 };
    cur.receita += v.receitaBruta;
    cur.unidades += v.unidades;
    mapa.set(v.periodo, cur);
  }
  return Array.from(mapa.entries())
    .map(([periodo, d]) => ({ periodo, ...d }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
}

export function montarDre(
  periodo: string,
  vendas: LinhaVenda[],
  despesasPorPeriodo: Record<string, number>,
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
  const despesasFixas = despesasPorPeriodo[periodo] ?? 0;
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
  despesasPorPeriodo: Record<string, number>,
  cargaTributaria: number,
  modo: "soma" | "media",
  rotulo = "Base",
): DreVendasPeriodo {
  const itens = periodos.map((p) =>
    montarDre(p, vendas, despesasPorPeriodo, cargaTributaria),
  );
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
