import * as XLSX from "xlsx";
import type {
  Aporte,
  AnexoSimples,
  CapexItem,
  Cargo,
  Cenario,
  Divida,
  EmpresaSimpl,
  OpexItem,
  Produto,
  Regime,
} from "./types";
import { uid, MESES } from "./defaults";

export class ImportSimplError extends Error {
  constructor(
    public aba: string,
    detalhe: string,
  ) {
    super(`[${aba}] ${detalhe}`);
  }
}

export interface ResultadoImportacaoSimpl {
  empresa: Partial<EmpresaSimpl>;
  cenario: Partial<Cenario>;
  resumo: { aba: string; itens: number }[];
  avisos: string[];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function num(v: unknown, def = 0): number {
  if (v == null || v === "") return def;
  if (typeof v === "number") return Number.isFinite(v) ? v : def;
  const s = String(v).trim().replace(/%/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

/** Aceita 12 (=12%) ou 0,12. Percentuais > 1 são divididos por 100. */
function pct(v: unknown, def = 0): number {
  const raw = v == null || v === "" ? null : v;
  if (raw == null) return def;
  const n = num(raw, def);
  return Math.abs(n) > 1 ? n / 100 : n;
}

/* ------------------------------- MODELO ---------------------------------- */

function aoa(ws: (string | number)[][]) {
  return XLSX.utils.aoa_to_sheet(ws);
}

export function gerarModeloSimpl(cenario?: Cenario | null, empresa?: EmpresaSimpl | null) {
  const c = cenario ?? null;
  const wb = XLSX.utils.book_new();
  const anos = c?.premissas.horizonteAnos ?? 5;

  const premissas: (string | number)[][] = [
    ["Campo", "Valor", "Observação"],
    ["Empresa", empresa?.nome ?? "", "Nome do cliente"],
    ["Moeda", empresa?.moeda ?? "R$", ""],
    ["Regime", empresa?.regime ?? "simples", "simples | presumido | real"],
    ["Anexo Simples", empresa?.anexoSimples ?? "I", "I..V"],
    ["Presunção IRPJ", empresa?.presumidoBaseIRPJ ?? 0.08, "% sobre receita"],
    ["Presunção CSLL", empresa?.presumidoBaseCSLL ?? 0.12, "% sobre receita"],
    ["Horizonte (anos)", anos, "3 a 10"],
    ["Ano início", c?.premissas.anoInicio ?? new Date().getFullYear(), ""],
    ["Mês início", c?.premissas.mesInicio ?? 1, "1 a 12"],
    ["Reforma tributária", c?.premissas.reformaTributaria ? "sim" : "nao", "sim | nao"],
    ["Caixa inicial", c?.caixaInicial ?? 0, ""],
    ["Capital inicial", c?.capitalInicial ?? 0, ""],
    [],
    ["Curvas macro (uma coluna por ano)"],
    ["Indicador", ...Array.from({ length: anos }, (_, i) => `Ano ${i + 1}`)],
    ["IPCA", ...Array.from({ length: anos }, (_, i) => c?.premissas.ipca[i] ?? 0.045)],
    ["Selic", ...Array.from({ length: anos }, (_, i) => c?.premissas.selic[i] ?? 0.105)],
  ];

  const receitas: (string | number)[][] = [
    [
      "Produto",
      "Volume mês",
      "Preço",
      "Cresc. volume a.a.",
      "Cresc. preço a.a.",
      "ISS",
      "ICMS",
      "PIS/COFINS",
      "IPI",
      "IBS",
      "CBS",
      ...MESES,
      "Obs",
    ],
    ...(c?.produtos ?? []).map((p) => [
      p.nome,
      p.volumeMes,
      p.preco,
      p.crescVolume,
      p.crescPreco,
      p.iss,
      p.icms,
      p.pisCofins,
      p.ipi,
      p.ibs,
      p.cbs,
      ...p.sazonalidade,
      p.obs,
    ]),
  ];

  const pessoal: (string | number)[][] = [
    [
      "Cargo",
      "Alocação",
      "Qtd",
      "Salário",
      "Encargos",
      "Benefícios",
      "Cresc. headcount a.a.",
      "Obs",
    ],
    ...(c?.cargos ?? []).map((g) => [
      g.nome,
      g.alocacao,
      g.qtd,
      g.salario,
      g.encargos,
      g.beneficios,
      g.crescHeadcount,
      g.obs,
    ]),
  ];

  const opex: (string | number)[][] = [
    [
      "Descrição",
      "Classificação",
      "Tipo",
      "Base",
      "Produto",
      "Valor",
      "Crédito tributário",
      "Obs",
    ],
    ...(c?.opex ?? []).map((o) => [
      o.descricao,
      o.classificacao,
      o.tipo,
      o.baseTipo,
      c?.produtos.find((p) => p.id === o.produtoId)?.nome ?? "",
      o.valor,
      o.creditoTributario,
      o.obs,
    ]),
  ];

  const capex: (string | number)[][] = [
    ["Descrição", "Categoria", "Valor", "Mês (1=primeiro)", "Taxa a.a.", "Obs"],
    ...(c?.capex ?? []).map((k) => [
      k.descricao,
      k.categoria,
      k.valor,
      k.mes + 1,
      k.taxaAA,
      k.obs,
    ]),
  ];

  const funding: (string | number)[][] = [
    ["Tipo", "Descrição", "Valor", "Mês (1=primeiro)", "Prazo (meses)", "Juros a.a.", "Sistema", "Obs"],
    ...(c?.dividas ?? []).map((d) => [
      "divida",
      d.descricao,
      d.valor,
      d.mes + 1,
      d.prazoMeses,
      d.jurosAA,
      d.sistema,
      d.obs,
    ]),
    ...(c?.aportes ?? []).map((a) => ["aporte", a.descricao, a.valor, a.mes + 1, "", "", "", a.obs]),
  ];

  const balanco: (string | number)[][] = [
    ["Campo", "Valor"],
    ["PMR (dias)", c?.capitalGiro.pmr ?? 30],
    ["PMP (dias)", c?.capitalGiro.pmp ?? 30],
    ["PME (dias)", c?.capitalGiro.pme ?? 20],
    ["Adiantamento a fornecedores (dias)", c?.capitalGiro.adiantFornecedores ?? 0],
    ["Adiantamento de clientes (dias)", c?.capitalGiro.adiantClientes ?? 0],
    ["Rotativo ativo", c?.rotativo.ativo === false ? "nao" : "sim"],
    ["Rotativo limite", c?.rotativo.limite ?? 0],
    ["Rotativo juros a.a.", c?.rotativo.jurosAA ?? 0.24],
    ["Caixa mínimo", c?.rotativo.caixaMinimo ?? 0],
  ];

  const valuation: (string | number)[][] = [
    ["Campo", "Valor"],
    ["Taxa livre de risco (Rf)", c?.valuation.rf ?? 0.105],
    ["Beta", c?.valuation.beta ?? 1.1],
    ["ERP", c?.valuation.erp ?? 0.055],
    ["Risco país", c?.valuation.riscoPais ?? 0.02],
    ["Risco específico", c?.valuation.riscoEspecifico ?? 0.03],
    ["Spread da dívida", c?.valuation.spreadDivida ?? 0.05],
    ["Peso equity", c?.valuation.pesoEquity ?? 0.7],
    ["Crescimento perpetuidade (g)", c?.valuation.gPerp ?? 0.04],
    ["Obs", c?.valuation.obs ?? ""],
  ];

  XLSX.utils.book_append_sheet(wb, aoa(premissas), "Premissas");
  XLSX.utils.book_append_sheet(wb, aoa(receitas), "Receitas");
  XLSX.utils.book_append_sheet(wb, aoa(pessoal), "Pessoal");
  XLSX.utils.book_append_sheet(wb, aoa(opex), "OPEX");
  XLSX.utils.book_append_sheet(wb, aoa(capex), "CAPEX");
  XLSX.utils.book_append_sheet(wb, aoa(funding), "Funding");
  XLSX.utils.book_append_sheet(wb, aoa(balanco), "Balanco");
  XLSX.utils.book_append_sheet(wb, aoa(valuation), "Valuation");
  return wb;
}

export function baixarModeloSimpl(cenario?: Cenario | null, empresa?: EmpresaSimpl | null) {
  const wb = gerarModeloSimpl(cenario, empresa);
  XLSX.writeFile(wb, "SAGA_Modelagem_Simplificada.xlsx");
}

/* -------------------------------- PARSER --------------------------------- */

type Rows = Record<string, unknown>[];

function sheetRows(wb: XLSX.WorkBook, nome: string, header?: 1): Rows | unknown[][] | null {
  const found = wb.SheetNames.find((n) => norm(n) === norm(nome));
  if (!found) return null;
  return header
    ? XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[found], { header: 1, blankrows: false })
    : (XLSX.utils.sheet_to_json(wb.Sheets[found], { defval: "" }) as Rows);
}

function pick(row: Record<string, unknown>, ...nomes: string[]): unknown {
  const keys = Object.keys(row);
  for (const n of nomes) {
    const k = keys.find((key) => norm(key) === norm(n));
    if (k !== undefined) return row[k];
  }
  for (const n of nomes) {
    const k = keys.find((key) => norm(key).startsWith(norm(n)));
    if (k !== undefined) return row[k];
  }
  return undefined;
}

export async function lerModeloSimpl(file: File): Promise<ResultadoImportacaoSimpl> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const avisos: string[] = [];
  const resumo: { aba: string; itens: number }[] = [];
  const empresa: Partial<EmpresaSimpl> = {};
  const cenario: Partial<Cenario> = {};

  /* Premissas */
  const prem = sheetRows(wb, "Premissas", 1) as unknown[][] | null;
  if (!prem) {
    throw new ImportSimplError("Premissas", "Aba obrigatória não encontrada na planilha.");
  }
  const mapa = new Map<string, unknown>();
  const curvas = new Map<string, number[]>();
  for (const r of prem) {
    if (!r || r[0] == null || r[0] === "") continue;
    const chave = norm(r[0]);
    mapa.set(chave, r[1]);
    curvas.set(
      chave,
      r.slice(1).map((v) => num(v)),
    );
  }
  const has = (k: string) => mapa.get(norm(k)) !== undefined && mapa.get(norm(k)) !== "";

  if (has("empresa")) empresa.nome = String(mapa.get(norm("empresa")));
  if (has("moeda")) empresa.moeda = String(mapa.get(norm("moeda")));
  if (has("regime")) {
    const r = norm(mapa.get(norm("regime")));
    const reg = (["simples", "presumido", "real"] as Regime[]).find((x) => r.includes(x));
    if (reg) empresa.regime = reg;
    else avisos.push(`Regime "${r}" não reconhecido — mantido o atual.`);
  }
  if (has("anexo simples")) {
    const a = String(mapa.get(norm("anexo simples"))).toUpperCase().trim() as AnexoSimples;
    if (["I", "II", "III", "IV", "V"].includes(a)) empresa.anexoSimples = a;
  }
  if (has("presuncao irpj")) empresa.presumidoBaseIRPJ = pct(mapa.get(norm("presuncao irpj")));
  if (has("presuncao csll")) empresa.presumidoBaseCSLL = pct(mapa.get(norm("presuncao csll")));

  const horizonte = Math.min(10, Math.max(3, Math.round(num(mapa.get(norm("horizonte (anos)")), 5))));
  const ipca = (curvas.get(norm("ipca")) ?? []).slice(0, horizonte).map((v) => (Math.abs(v) > 1 ? v / 100 : v));
  const selic = (curvas.get(norm("selic")) ?? []).slice(0, horizonte).map((v) => (Math.abs(v) > 1 ? v / 100 : v));
  cenario.premissas = {
    horizonteAnos: horizonte,
    anoInicio: Math.round(num(mapa.get(norm("ano inicio")), new Date().getFullYear())),
    mesInicio: Math.min(12, Math.max(1, Math.round(num(mapa.get(norm("mes inicio")), 1)))),
    ipca: Array.from({ length: horizonte }, (_, i) => ipca[i] ?? ipca[ipca.length - 1] ?? 0.045),
    selic: Array.from({ length: horizonte }, (_, i) => selic[i] ?? selic[selic.length - 1] ?? 0.105),
    reformaTributaria: norm(mapa.get(norm("reforma tributaria"))).startsWith("s"),
  };
  if (has("caixa inicial")) cenario.caixaInicial = num(mapa.get(norm("caixa inicial")));
  if (has("capital inicial")) cenario.capitalInicial = num(mapa.get(norm("capital inicial")));
  resumo.push({ aba: "Premissas", itens: mapa.size });

  /* Receitas */
  const rRec = sheetRows(wb, "Receitas") as Rows | null;
  if (rRec) {
    const produtos: Produto[] = rRec
      .filter((r) => String(pick(r, "Produto") ?? "").trim() !== "")
      .map((r) => ({
        id: uid(),
        nome: String(pick(r, "Produto")),
        volumeMes: num(pick(r, "Volume mês", "Volume")),
        preco: num(pick(r, "Preço")),
        crescVolume: pct(pick(r, "Cresc. volume a.a.", "Cresc. volume")),
        crescPreco: pct(pick(r, "Cresc. preço a.a.", "Cresc. preço")),
        sazonalidade: MESES.map((m) => {
          const v = pick(r, m);
          return v === undefined || v === "" ? 1 : num(v, 1);
        }),
        iss: pct(pick(r, "ISS")),
        icms: pct(pick(r, "ICMS")),
        pisCofins: pct(pick(r, "PIS/COFINS", "PIS")),
        ipi: pct(pick(r, "IPI")),
        ibs: pct(pick(r, "IBS")),
        cbs: pct(pick(r, "CBS")),
        obs: String(pick(r, "Obs") ?? ""),
      }));
    if (produtos.length) {
      cenario.produtos = produtos;
      resumo.push({ aba: "Receitas", itens: produtos.length });
    } else avisos.push("Aba Receitas sem linhas válidas — produtos mantidos.");
  }

  /* Pessoal */
  const rPes = sheetRows(wb, "Pessoal") as Rows | null;
  if (rPes) {
    const cargos: Cargo[] = rPes
      .filter((r) => String(pick(r, "Cargo") ?? "").trim() !== "")
      .map((r) => ({
        id: uid(),
        nome: String(pick(r, "Cargo")),
        alocacao: norm(pick(r, "Alocação")).startsWith("cust") ? "custo" : "despesa",
        qtd: num(pick(r, "Qtd")),
        salario: num(pick(r, "Salário")),
        encargos: pct(pick(r, "Encargos")),
        beneficios: num(pick(r, "Benefícios")),
        crescHeadcount: pct(pick(r, "Cresc. headcount a.a.", "Cresc. headcount")),
        obs: String(pick(r, "Obs") ?? ""),
      }));
    if (cargos.length) {
      cenario.cargos = cargos;
      resumo.push({ aba: "Pessoal", itens: cargos.length });
    }
  }

  /* OPEX */
  const rOpex = sheetRows(wb, "OPEX") as Rows | null;
  if (rOpex) {
    const nomeParaId = new Map((cenario.produtos ?? []).map((p) => [norm(p.nome), p.id]));
    const opex: OpexItem[] = rOpex
      .filter((r) => String(pick(r, "Descrição") ?? "").trim() !== "")
      .map((r) => {
        const tipo = norm(pick(r, "Tipo")).startsWith("var") ? "variavel" : "fixo";
        const bruto = num(pick(r, "Valor"));
        const baseTipo = norm(pick(r, "Base")).startsWith("unid") ? "unidade" : "receita";
        return {
          id: uid(),
          descricao: String(pick(r, "Descrição")),
          classificacao: norm(pick(r, "Classificação")).startsWith("cust") ? "custo" : "despesa",
          tipo,
          baseTipo,
          produtoId: nomeParaId.get(norm(pick(r, "Produto"))) ?? "",
          valor:
            tipo === "variavel" && baseTipo === "receita" && Math.abs(bruto) > 1
              ? bruto / 100
              : bruto,
          creditoTributario: pct(pick(r, "Crédito tributário", "Credito")),
          obs: String(pick(r, "Obs") ?? ""),
        } satisfies OpexItem;
      });
    if (opex.length) {
      cenario.opex = opex;
      resumo.push({ aba: "OPEX", itens: opex.length });
    }
  }

  /* CAPEX */
  const rCapex = sheetRows(wb, "CAPEX") as Rows | null;
  if (rCapex) {
    const capex: CapexItem[] = rCapex
      .filter((r) => String(pick(r, "Descrição") ?? "").trim() !== "")
      .map((r) => ({
        id: uid(),
        descricao: String(pick(r, "Descrição")),
        categoria: norm(pick(r, "Categoria")).startsWith("intang") ? "intangivel" : "imobilizado",
        valor: num(pick(r, "Valor")),
        mes: Math.max(0, Math.round(num(pick(r, "Mês (1=primeiro)", "Mês"), 1)) - 1),
        taxaAA: pct(pick(r, "Taxa a.a.", "Taxa")),
        obs: String(pick(r, "Obs") ?? ""),
      }));
    if (capex.length) {
      cenario.capex = capex;
      resumo.push({ aba: "CAPEX", itens: capex.length });
    }
  }

  /* Funding */
  const rFund = sheetRows(wb, "Funding") as Rows | null;
  if (rFund) {
    const dividas: Divida[] = [];
    const aportes: Aporte[] = [];
    for (const r of rFund) {
      const desc = String(pick(r, "Descrição") ?? "").trim();
      if (!desc) continue;
      const mes = Math.max(0, Math.round(num(pick(r, "Mês (1=primeiro)", "Mês"), 1)) - 1);
      if (norm(pick(r, "Tipo")).startsWith("apor")) {
        aportes.push({
          id: uid(),
          descricao: desc,
          valor: num(pick(r, "Valor")),
          mes,
          obs: String(pick(r, "Obs") ?? ""),
        });
      } else {
        dividas.push({
          id: uid(),
          descricao: desc,
          valor: num(pick(r, "Valor")),
          mes,
          prazoMeses: Math.max(1, Math.round(num(pick(r, "Prazo (meses)", "Prazo"), 12))),
          jurosAA: pct(pick(r, "Juros a.a.", "Juros")),
          sistema: norm(pick(r, "Sistema")).startsWith("sac") ? "sac" : "price",
          obs: String(pick(r, "Obs") ?? ""),
        });
      }
    }
    if (dividas.length || aportes.length) {
      cenario.dividas = dividas;
      cenario.aportes = aportes;
      resumo.push({ aba: "Funding", itens: dividas.length + aportes.length });
    }
  }

  /* Balanço / capital de giro */
  const rBal = sheetRows(wb, "Balanco", 1) as unknown[][] | null;
  if (rBal) {
    const m = new Map<string, unknown>();
    for (const r of rBal) if (r?.[0]) m.set(norm(r[0]), r[1]);
    const g = (k: string, def: number) => (m.has(norm(k)) ? num(m.get(norm(k)), def) : def);
    cenario.capitalGiro = {
      pmr: g("PMR (dias)", 30),
      pmp: g("PMP (dias)", 30),
      pme: g("PME (dias)", 20),
      adiantFornecedores: g("Adiantamento a fornecedores (dias)", 0),
      adiantClientes: g("Adiantamento de clientes (dias)", 0),
    };
    cenario.rotativo = {
      ativo: !norm(m.get(norm("Rotativo ativo"))).startsWith("n"),
      limite: g("Rotativo limite", 0),
      jurosAA: m.has(norm("Rotativo juros a.a."))
        ? pct(m.get(norm("Rotativo juros a.a.")))
        : 0.24,
      caixaMinimo: g("Caixa mínimo", 0),
    };
    resumo.push({ aba: "Balanço", itens: m.size });
  }

  /* Valuation */
  const rVal = sheetRows(wb, "Valuation", 1) as unknown[][] | null;
  if (rVal) {
    const m = new Map<string, unknown>();
    for (const r of rVal) if (r?.[0]) m.set(norm(r[0]), r[1]);
    const p = (k: string, def: number) => (m.has(norm(k)) ? pct(m.get(norm(k)), def) : def);
    cenario.valuation = {
      rf: p("Taxa livre de risco (Rf)", 0.105),
      beta: m.has(norm("Beta")) ? num(m.get(norm("Beta")), 1.1) : 1.1,
      erp: p("ERP", 0.055),
      riscoPais: p("Risco país", 0.02),
      riscoEspecifico: p("Risco específico", 0.03),
      spreadDivida: p("Spread da dívida", 0.05),
      pesoEquity: p("Peso equity", 0.7),
      gPerp: p("Crescimento perpetuidade (g)", 0.04),
      obs: String(m.get(norm("Obs")) ?? ""),
    };
    resumo.push({ aba: "Valuation", itens: m.size });
  }

  if (resumo.length <= 1) {
    avisos.push("Apenas a aba Premissas foi reconhecida. Verifique os nomes das abas do modelo.");
  }
  return { empresa, cenario, resumo, avisos };
}
