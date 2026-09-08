import * as XLSX from "xlsx";
import { uid, zeros5 } from "./defaults";
import type {
  Ativo,
  Cargo,
  Divida,
  LinhaAnual,
  ModeloMF2,
  Moeda,
  PremissaMacro,
  Produto,
  RegimeTributario,
  Sazonalidade,
  Serie5,
  TipoAtivo,
  TipoNegocio,
} from "./types";
import { MOEDAS, REGIMES, TIPOS_NEGOCIO } from "./types";

export class ImportMF2Error extends Error {
  constructor(
    public aba: string,
    detalhe: string,
  ) {
    super(`[${aba}] ${detalhe}`);
  }
}

export interface ResultadoImportacaoMF2 {
  patch: Partial<ModeloMF2>;
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
  const s = String(v).trim().replace(/%/g, "").replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : def;
}

/** Aceita 12 (=12%) ou 0,12. */
function pct(v: unknown, def = 0): number {
  if (v == null || v === "") return def;
  const n = num(v, def);
  return Math.abs(n) > 1 ? n / 100 : n;
}

const ANOS = [1, 2, 3, 4, 5];
const COLS_ANOS = ANOS.map((a) => `Ano ${a}`);

/* -------------------------------- MODELO --------------------------------- */

const aoa = (rows: (string | number)[][]) => XLSX.utils.aoa_to_sheet(rows);

function linhasAnuais(itens: LinhaAnual[] | undefined, exemplos: string[]): (string | number)[][] {
  const base = itens?.length
    ? itens.map((l) => [l.descricao, ...l.valores])
    : exemplos.map((e) => [e, 0, 0, 0, 0, 0]);
  return [["Descrição", ...COLS_ANOS], ...base];
}

export function gerarPlanilhaModeloMF2(m?: ModeloMF2 | null) {
  const wb = XLSX.utils.book_new();

  const geral: (string | number)[][] = [
    ["Campo", "Valor", "Observação"],
    ["Empresa", m?.nomeEmpresa ?? "", "Nome do cliente"],
    ["Moeda", m?.unidadeMonetaria ?? "BRL", "BRL | USD | EUR"],
    ["Regime tributário", m?.regimeTributario ?? "Simples Nacional", REGIMES.join(" | ")],
    ["Tipo de negócio", m?.tipoNegocio ?? "Serviços", TIPOS_NEGOCIO.join(" | ")],
    [
      "Data de início",
      m?.dataInicioModelo ?? new Date().toISOString().slice(0, 10),
      "aaaa-mm-dd",
    ],
    ["% adiantamento de clientes", m?.adiantamentoClientes ?? 0, "sobre a receita"],
    ["% adiantamento a fornecedores", m?.adiantamentoFornecedores ?? 0, "sobre os custos"],
    ["% tributos recuperáveis", m?.tributosRecuperaveis ?? 0, "sobre a receita"],
    ["% dividendos trimestrais", m?.percentualDividendos ?? 0, "sobre o lucro do trimestre"],
  ];

  const macro: (string | number)[][] = [
    ["Indicador", ...COLS_ANOS],
    ["IPCA", ...ANOS.map((a) => m?.premissasMacro[a - 1]?.ipca ?? 0.045)],
    ["Selic", ...ANOS.map((a) => m?.premissasMacro[a - 1]?.selic ?? 0.1)],
  ];

  const produtos: (string | number)[][] = [
    [
      "Produto",
      "Unidade",
      "Volume ano 1",
      "Cresc. volume ano 2",
      "Cresc. volume ano 3",
      "Cresc. volume ano 4",
      "Cresc. volume ano 5",
      "Preço ano 1",
      "Cresc. preço ano 2",
      "Cresc. preço ano 3",
      "Cresc. preço ano 4",
      "Cresc. preço ano 5",
    ],
    ...(m?.produtos.length
      ? m.produtos.map((p) => [
          p.nome,
          p.unidadeMedida,
          p.volumeAno1,
          ...p.crescimentoVolume,
          p.precoAno1,
          ...p.crescimentoPreco,
        ])
      : [["Produto A", "un", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]]),
  ];

  const MESES_NOMES = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  const sazonalidade: (string | number)[][] = [
    ["Mês", "% do volume anual"],
    ...MESES_NOMES.map((nome, i) => [
      nome,
      m?.sazonalidade[i]?.percentual ?? 1 / 12,
    ]),
    ["Soma (deve fechar 100%)", ""],
  ];

  const pessoal: (string | number)[][] = [
    ["Cargo", "Tipo (Custo/Despesa)", "Quantidade", "Salário mensal", "% encargos", "Benefícios"],
    ...(m?.cargos.length
      ? m.cargos.map((c) => [
          c.nomeCargo,
          c.tipo,
          c.quantidade,
          c.salarioMensal,
          c.encargosPercentual,
          c.beneficiosValor,
        ])
      : [["Cargo exemplo", "Despesa", 1, 0, 0.7, 0]]),
  ];

  const ativos: (string | number)[][] = [
    ["Tipo", ...COLS_ANOS, "% depreciação a.a."],
    ...(m?.ativos.length
      ? m.ativos.map((a) => [a.tipo, ...a.investimentoPorAno, a.taxaDepreciacaoAnual])
      : [
          ["Imobilizado", 0, 0, 0, 0, 0, 0.1],
          ["Intangível", 0, 0, 0, 0, 0, 0.2],
          ["Investimentos", 0, 0, 0, 0, 0, 0],
        ]),
  ];

  const dividas: (string | number)[][] = [
    ["Nome", "Valor da captação", "Mês da captação (aaaa-mm-dd)", "Prazo (meses)", "Juros a.a."],
    ...(m?.dividas.length
      ? m.dividas.map((d) => [d.nome, d.valorCaptacao, d.mesCaptacao, d.prazoMeses, d.taxaJurosAnual])
      : [["Dívida 1", 0, new Date().toISOString().slice(0, 10), 36, 0.18]]),
  ];

  const tributacao: (string | number)[][] = [
    ["Campo", "Valor"],
    ["% DAS", m?.tributacao.aliquotaDas ?? 0],
    ["% ICMS", m?.tributacao.aliquotaIcms ?? 0],
    ["% ISS", m?.tributacao.aliquotaIss ?? 0],
    ["% IPI", m?.tributacao.aliquotaIpi ?? 0],
    ["% PIS/COFINS", m?.tributacao.aliquotaPisCofins ?? 0],
    ["% IRPJ/CSLL", m?.tributacao.aliquotaIrpjCsll ?? 0],
    ["% créditos tributários", m?.tributacao.percentualCreditosTributarios ?? 0],
  ];

  const capital: (string | number)[][] = [
    ["Campo", "Valor"],
    ["Dias de recebimento", m?.capitalGiro.diasRecebimento ?? 30],
    ["Dias de estoque", m?.capitalGiro.diasEstoque ?? 0],
    ["Dias de pagamento", m?.capitalGiro.diasPagamento ?? 30],
    ["Saldo de caixa inicial", m?.caixaCapital.saldoCaixaInicial ?? 0],
    ["Aporte/redução ano 1", m?.caixaCapital.aportesReducaoCapital[0] ?? 0],
    ["Aporte/redução ano 2", m?.caixaCapital.aportesReducaoCapital[1] ?? 0],
    ["Aporte/redução ano 3", m?.caixaCapital.aportesReducaoCapital[2] ?? 0],
    ["Aporte/redução ano 4", m?.caixaCapital.aportesReducaoCapital[3] ?? 0],
    ["Aporte/redução ano 5", m?.caixaCapital.aportesReducaoCapital[4] ?? 0],
  ];

  const add = (rows: (string | number)[][], nome: string) =>
    XLSX.utils.book_append_sheet(wb, aoa(rows), nome);

  add(geral, "Geral");
  add(macro, "Macro");
  add(produtos, "Produtos");
  add(sazonalidade, "Sazonalidade");
  add(pessoal, "Pessoal");
  add(
    linhasAnuais(m?.custosVariaveisPercentual, ["Comissões", "Fretes"]),
    "CustosVar%",
  );
  add(
    linhasAnuais(m?.custosVariaveisUnitarios, ["Matéria-prima por unidade"]),
    "CustosVarUnit",
  );
  add(linhasAnuais(m?.custosFixos, ["Custo fixo de produção"]), "CustosFixos");
  add(
    linhasAnuais(m?.despesasFixasSga, [
      "Aluguel e condomínio",
      "Softwares e ferramentas",
      "Serviços de terceiros",
      "Internet e telefonia",
      "Água e energia",
      "Manutenção",
      "Seguros",
      "Materiais de escritório",
    ]),
    "DespesasFixas",
  );
  add(linhasAnuais(m?.despesasVariaveisSga, ["Marketing (% receita)"]), "DespesasVar%");
  add(tributacao, "Tributacao");
  add(capital, "CapitalGiro");
  add(ativos, "Ativos");
  add(dividas, "Dividas");
  return wb;
}

export function baixarPlanilhaModeloMF2(m?: ModeloMF2 | null) {
  XLSX.writeFile(gerarPlanilhaModeloMF2(m), "SAGA_MF2_Modelo.xlsx");
}

/* -------------------------------- PARSER --------------------------------- */

type Rows = Record<string, unknown>[];

function sheet(wb: XLSX.WorkBook, nome: string): Rows | null {
  const found = wb.SheetNames.find((n) => norm(n) === norm(nome));
  if (!found) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[found], { defval: "" }) as Rows;
}

function sheetMatriz(wb: XLSX.WorkBook, nome: string): unknown[][] | null {
  const found = wb.SheetNames.find((n) => norm(n) === norm(nome));
  if (!found) return null;
  return XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[found], {
    header: 1,
    blankrows: false,
  }) as unknown[][];
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

function mapaChaveValor(rows: unknown[][] | null) {
  const m = new Map<string, unknown>();
  const linhas = new Map<string, unknown[]>();
  for (const r of rows ?? []) {
    if (!r || r[0] == null || r[0] === "") continue;
    m.set(norm(r[0]), r[1]);
    linhas.set(norm(r[0]), r.slice(1));
  }
  return { m, linhas };
}

function serie5(row: Record<string, unknown>, converter: (v: unknown) => number): Serie5 {
  const v = ANOS.map((a) => converter(pick(row, `Ano ${a}`, `${a}`)));
  return [v[0], v[1], v[2], v[3], v[4]];
}

function lerLinhasAnuais(
  wb: XLSX.WorkBook,
  aba: string,
  percentual: boolean,
): LinhaAnual[] | null {
  const rows = sheet(wb, aba) as Rows | null;
  if (!rows) return null;
  const conv = percentual ? (v: unknown) => pct(v) : (v: unknown) => num(v);
  const itens = rows
    .filter((r) => String(pick(r, "Descrição", "Descricao") ?? "").trim() !== "")
    .map((r) => ({
      id: uid(),
      descricao: String(pick(r, "Descrição", "Descricao")),
      valores: serie5(r, conv),
    }));
  return itens.length ? itens : null;
}

export async function lerPlanilhaModeloMF2(file: File): Promise<ResultadoImportacaoMF2> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const patch: Partial<ModeloMF2> = {};
  const resumo: { aba: string; itens: number }[] = [];
  const avisos: string[] = [];

  /* Geral */
  const geral = sheet(wb, "Geral", true);
  if (!geral) throw new ImportMF2Error("Geral", "Aba obrigatória não encontrada na planilha.");
  const { m } = mapaChaveValor(geral);
  const get = (k: string) => m.get(norm(k));
  const tem = (k: string) => get(k) !== undefined && get(k) !== "";

  if (tem("Empresa")) patch.nomeEmpresa = String(get("Empresa"));
  if (tem("Moeda")) {
    const moeda = String(get("Moeda")).toUpperCase().trim() as Moeda;
    if (MOEDAS.includes(moeda)) patch.unidadeMonetaria = moeda;
    else avisos.push(`Moeda "${moeda}" não reconhecida — mantida a atual.`);
  }
  if (tem("Regime tributário")) {
    const reg = REGIMES.find((r) => norm(r) === norm(get("Regime tributário")));
    if (reg) patch.regimeTributario = reg as RegimeTributario;
    else avisos.push("Regime tributário não reconhecido — mantido o atual.");
  }
  if (tem("Tipo de negócio")) {
    const tn = TIPOS_NEGOCIO.find((t) => norm(t) === norm(get("Tipo de negócio")));
    if (tn) patch.tipoNegocio = tn as TipoNegocio;
    else avisos.push("Tipo de negócio não reconhecido — mantido o atual.");
  }
  if (tem("Data de início")) {
    const v = get("Data de início");
    const d = v instanceof Date ? v : new Date(String(v));
    if (!Number.isNaN(d.getTime())) patch.dataInicioModelo = d.toISOString().slice(0, 10);
    else avisos.push("Data de início inválida — mantida a atual.");
  }
  if (tem("% adiantamento de clientes")) patch.adiantamentoClientes = pct(get("% adiantamento de clientes"));
  if (tem("% adiantamento a fornecedores"))
    patch.adiantamentoFornecedores = pct(get("% adiantamento a fornecedores"));
  if (tem("% tributos recuperáveis")) patch.tributosRecuperaveis = pct(get("% tributos recuperáveis"));
  if (tem("% dividendos trimestrais")) patch.percentualDividendos = pct(get("% dividendos trimestrais"));
  resumo.push({ aba: "Geral", itens: m.size });

  /* Macro */
  const macro = sheet(wb, "Macro", true);
  if (macro) {
    const { linhas } = mapaChaveValor(macro);
    const ipca = (linhas.get(norm("IPCA")) ?? []).map((v) => pct(v, 0.045));
    const selic = (linhas.get(norm("Selic")) ?? []).map((v) => pct(v, 0.1));
    const macroList: PremissaMacro[] = ANOS.map((ano, i) => ({
      ano,
      ipca: ipca[i] ?? ipca[ipca.length - 1] ?? 0.045,
      selic: selic[i] ?? selic[selic.length - 1] ?? 0.1,
    }));
    patch.premissasMacro = macroList;
    resumo.push({ aba: "Macro", itens: 5 });
  }

  /* Produtos */
  const rProd = sheet(wb, "Produtos") as Rows | null;
  if (rProd) {
    const produtos: Produto[] = rProd
      .filter((r) => String(pick(r, "Produto") ?? "").trim() !== "")
      .map((r) => ({
        id: uid(),
        nome: String(pick(r, "Produto")),
        unidadeMedida: String(pick(r, "Unidade") ?? "un"),
        volumeAno1: num(pick(r, "Volume ano 1", "Volume")),
        crescimentoVolume: [2, 3, 4, 5].map((a) =>
          pct(pick(r, `Cresc. volume ano ${a}`)),
        ) as [number, number, number, number],
        precoAno1: num(pick(r, "Preço ano 1", "Preco ano 1", "Preço")),
        crescimentoPreco: [2, 3, 4, 5].map((a) => pct(pick(r, `Cresc. preço ano ${a}`))) as [
          number,
          number,
          number,
          number,
        ],
      }));
    if (produtos.length) {
      patch.produtos = produtos;
      resumo.push({ aba: "Produtos", itens: produtos.length });
    } else avisos.push("Aba Produtos sem linhas válidas — produtos mantidos.");
  }

  /* Sazonalidade */
  const rSaz = sheet(wb, "Sazonalidade", true);
  if (rSaz) {
    const valores: number[] = [];
    for (const r of rSaz) {
      if (!r || r[0] == null || r[0] === "") continue;
      if (norm(r[0]).startsWith("mes") || norm(r[0]).startsWith("soma")) continue;
      valores.push(pct(r[1]));
    }
    if (valores.length === 12) {
      const saz: Sazonalidade[] = valores.map((percentual, i) => ({ mes: i + 1, percentual }));
      patch.sazonalidade = saz;
      const soma = valores.reduce((a, b) => a + b, 0);
      if (Math.abs(soma - 1) > 0.005)
        avisos.push(`Sazonalidade soma ${(soma * 100).toFixed(1)}% — ajuste para 100%.`);
      resumo.push({ aba: "Sazonalidade", itens: 12 });
    } else avisos.push("Aba Sazonalidade precisa de 12 linhas — mantida a atual.");
  }

  /* Pessoal */
  const rPes = sheet(wb, "Pessoal") as Rows | null;
  if (rPes) {
    const cargos: Cargo[] = rPes
      .filter((r) => String(pick(r, "Cargo") ?? "").trim() !== "")
      .map((r) => ({
        id: uid(),
        nomeCargo: String(pick(r, "Cargo")),
        tipo: norm(pick(r, "Tipo (Custo/Despesa)", "Tipo")).startsWith("cust")
          ? "Custo"
          : "Despesa",
        quantidade: num(pick(r, "Quantidade", "Qtd")),
        salarioMensal: num(pick(r, "Salário mensal", "Salário")),
        encargosPercentual: pct(pick(r, "% encargos", "Encargos")),
        beneficiosValor: num(pick(r, "Benefícios")),
      }));
    if (cargos.length) {
      patch.cargos = cargos;
      resumo.push({ aba: "Pessoal", itens: cargos.length });
    }
  }

  /* Linhas anuais */
  const cvp = lerLinhasAnuais(wb, "CustosVar%", true);
  if (cvp) {
    patch.custosVariaveisPercentual = cvp;
    resumo.push({ aba: "CustosVar%", itens: cvp.length });
  }
  const cvu = lerLinhasAnuais(wb, "CustosVarUnit", false);
  if (cvu) {
    patch.custosVariaveisUnitarios = cvu;
    resumo.push({ aba: "CustosVarUnit", itens: cvu.length });
  }
  const cf = lerLinhasAnuais(wb, "CustosFixos", false);
  if (cf) {
    patch.custosFixos = cf;
    resumo.push({ aba: "CustosFixos", itens: cf.length });
  }
  const df = lerLinhasAnuais(wb, "DespesasFixas", false);
  if (df) {
    patch.despesasFixasSga = df;
    resumo.push({ aba: "DespesasFixas", itens: df.length });
  }
  const dv = lerLinhasAnuais(wb, "DespesasVar%", true);
  if (dv) {
    patch.despesasVariaveisSga = dv;
    resumo.push({ aba: "DespesasVar%", itens: dv.length });
  }

  /* Tributação */
  const rTrib = sheet(wb, "Tributacao", true);
  if (rTrib) {
    const { m: t } = mapaChaveValor(rTrib);
    const p = (k: string) => pct(t.get(norm(k)));
    patch.tributacao = {
      regime: patch.regimeTributario ?? "Simples Nacional",
      aliquotaDas: p("% DAS"),
      aliquotaIcms: p("% ICMS"),
      aliquotaIss: p("% ISS"),
      aliquotaIpi: p("% IPI"),
      aliquotaPisCofins: p("% PIS/COFINS"),
      aliquotaIrpjCsll: p("% IRPJ/CSLL"),
      percentualCreditosTributarios: p("% créditos tributários"),
    };
    resumo.push({ aba: "Tributação", itens: t.size });
  }

  /* Capital de giro e caixa */
  const rCap = sheet(wb, "CapitalGiro", true);
  if (rCap) {
    const { m: c } = mapaChaveValor(rCap);
    const g = (k: string, def = 0) => (c.has(norm(k)) ? num(c.get(norm(k)), def) : def);
    patch.capitalGiro = {
      diasRecebimento: g("Dias de recebimento", 30),
      diasEstoque: g("Dias de estoque", 0),
      diasPagamento: g("Dias de pagamento", 30),
    };
    const aportes = ANOS.map((a) => g(`Aporte/redução ano ${a}`, 0));
    patch.caixaCapital = {
      saldoCaixaInicial: g("Saldo de caixa inicial", 0),
      aportesReducaoCapital: [aportes[0], aportes[1], aportes[2], aportes[3], aportes[4]],
    };
    resumo.push({ aba: "Capital de giro", itens: c.size });
  }

  /* Ativos */
  const rAtv = sheet(wb, "Ativos") as Rows | null;
  if (rAtv) {
    const ativos: Ativo[] = rAtv
      .filter((r) => String(pick(r, "Tipo") ?? "").trim() !== "")
      .map((r) => {
        const t = norm(pick(r, "Tipo"));
        const tipo: TipoAtivo = t.startsWith("intang")
          ? "Intangível"
          : t.startsWith("invest")
            ? "Investimentos"
            : "Imobilizado";
        return {
          id: uid(),
          tipo,
          investimentoPorAno: serie5(r, (v) => num(v)),
          taxaDepreciacaoAnual: pct(pick(r, "% depreciação a.a.", "% depreciação", "Depreciação")),
        };
      });
    if (ativos.length) {
      patch.ativos = ativos;
      resumo.push({ aba: "Ativos", itens: ativos.length });
    }
  }

  /* Dívidas */
  const rDiv = sheet(wb, "Dividas") as Rows | null;
  if (rDiv) {
    const dividas: Divida[] = rDiv
      .filter((r) => String(pick(r, "Nome") ?? "").trim() !== "")
      .map((r) => {
        const raw = pick(r, "Mês da captação", "Mes da captacao", "Mês");
        const d = raw instanceof Date ? raw : new Date(String(raw));
        return {
          id: uid(),
          nome: String(pick(r, "Nome")),
          valorCaptacao: num(pick(r, "Valor da captação", "Valor")),
          mesCaptacao: Number.isNaN(d.getTime())
            ? (patch.dataInicioModelo ?? new Date().toISOString().slice(0, 10))
            : d.toISOString().slice(0, 10),
          prazoMeses: Math.max(1, Math.round(num(pick(r, "Prazo (meses)", "Prazo"), 12))),
          taxaJurosAnual: pct(pick(r, "Juros a.a.", "Juros")),
        };
      });
    if (dividas.length) {
      patch.dividas = dividas;
      resumo.push({ aba: "Dívidas", itens: dividas.length });
    }
  }

  if (resumo.length <= 1)
    avisos.push("Apenas a aba Geral foi reconhecida. Confira os nomes das abas do modelo.");

  return { patch, resumo, avisos };
}

export const zerosSerie = zeros5;
