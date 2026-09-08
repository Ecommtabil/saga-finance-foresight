import * as XLSX from "xlsx";
import { ABAS_POB } from "./template";
import { uid } from "./types";
import { meses12, premissasVazias, type Meses12, type PremissasPOB } from "./premissas";

export interface ResumoImportacaoPOB {
  premissas: PremissasPOB;
  resumo: { aba: string; itens: number }[];
  avisos: string[];
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

function num(v: unknown, def = 0): number {
  if (v == null || v === "") return def;
  if (typeof v === "number") return Number.isFinite(v) ? v : def;
  let s = String(v).trim().replace(/%/g, "").replace(/[R$\s]/g, "");
  const neg = /^\(.*\)$/.test(s);
  if (neg) s = s.slice(1, -1);
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return def;
  return neg ? -n : n;
}

/** Aceita 18 (=18%) ou 0,18. */
function pct(v: unknown, def = 0): number {
  const n = num(v, def);
  return Math.abs(n) > 1 ? n / 100 : n;
}

function acharAba(wb: XLSX.WorkBook, alvo: string): string | null {
  const a = norm(alvo);
  return wb.SheetNames.find((n) => norm(n) === a) ?? wb.SheetNames.find((n) => norm(n).includes(a)) ?? null;
}

function linhas(wb: XLSX.WorkBook, alvo: string): Record<string, unknown>[] {
  const nome = acharAba(wb, alvo);
  if (!nome) return [];
  const ws = wb.Sheets[nome];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  return raw.filter((r) => Object.values(r).some((v) => String(v ?? "").trim() !== ""));
}

function get(row: Record<string, unknown>, ...chaves: string[]): unknown {
  const keys = Object.keys(row);
  for (const c of chaves) {
    const alvo = norm(c);
    const k = keys.find((x) => norm(x) === alvo) ?? keys.find((x) => norm(x).includes(alvo));
    if (k != null) return row[k];
  }
  return "";
}

const MESES_ALIAS = [
  ["jan", "janeiro"],
  ["fev", "fevereiro"],
  ["mar", "marco"],
  ["abr", "abril"],
  ["mai", "maio"],
  ["jun", "junho"],
  ["jul", "julho"],
  ["ago", "agosto"],
  ["set", "setembro"],
  ["out", "outubro"],
  ["nov", "novembro"],
  ["dez", "dezembro"],
];

function lerMeses(row: Record<string, unknown>): Meses12 {
  const keys = Object.keys(row);
  return MESES_ALIAS.map((alias, i) => {
    const k =
      keys.find((x) => alias.includes(norm(x))) ??
      keys.find((x) => alias.some((a) => norm(x).startsWith(a))) ??
      keys.find((x) => norm(x) === String(i + 1));
    return k ? num(row[k]) : 0;
  });
}

export function lerPlanilhaPOB(buffer: ArrayBuffer): ResumoImportacaoPOB {
  const wb = XLSX.read(buffer, { type: "array" });
  const p = premissasVazias();
  const avisos: string[] = [];
  const resumo: { aba: string; itens: number }[] = [];

  /* Vendas */
  for (const r of linhas(wb, ABAS_POB.vendas)) {
    const nome = String(get(r, "Produto", "Nome") ?? "").trim();
    if (!nome) continue;
    p.produtos.push({
      id: uid(),
      nome,
      unidade: String(get(r, "Unidade") ?? "un").trim() || "un",
      precoUnitario: num(get(r, "Preço Unitário", "Preco Unitario", "Preço", "Preco")),
      volume: lerMeses(r),
    });
  }
  resumo.push({ aba: ABAS_POB.vendas, itens: p.produtos.length });
  if (!p.produtos.length) avisos.push("Nenhum produto encontrado na aba Vendas.");

  /* Impostos */
  const imp = linhas(wb, ABAS_POB.impostos);
  for (const r of imp) {
    const t = norm(get(r, "Tributo", "Imposto", "Parâmetro", "Parametro"));
    const v = pct(get(r, "Alíquota (%)", "Aliquota", "Valor", "%"));
    if (t.includes("icms")) p.impostos.icms = v;
    else if (t.includes("iss")) p.impostos.iss = v;
    else if (t.includes("ipi")) p.impostos.ipi = v;
    else if (t.includes("pis") || t.includes("cofins")) p.impostos.pisCofins = v;
    else if (t.includes("irpj") || t.includes("csll")) p.impostos.irpjCsll = v;
    else if (t.includes("credito")) p.impostos.creditos = v;
  }
  resumo.push({ aba: ABAS_POB.impostos, itens: imp.length });

  /* Produção */
  const prod = linhas(wb, ABAS_POB.producao);
  for (const r of prod) {
    const t = norm(get(r, "Parâmetro", "Parametro", "Item"));
    const v = get(r, "Valor");
    if (t.includes("estoqueinicial")) p.producao.estoqueInicialAcabado = num(v);
    else if (t.includes("dias")) p.producao.diasEstoqueAcabado = num(v);
    else if (t.includes("perda")) p.producao.perdaProcessoPct = pct(v);
  }
  resumo.push({ aba: ABAS_POB.producao, itens: prod.length });

  /* Matéria-prima */
  for (const r of linhas(wb, ABAS_POB.materiaPrima)) {
    const nome = String(get(r, "Insumo", "Material", "Descrição", "Descricao", "Nome") ?? "").trim();
    if (!nome) continue;
    p.materiasPrimas.push({
      id: uid(),
      nome,
      unidade: String(get(r, "Unidade") ?? "un").trim() || "un",
      custoUnitario: num(get(r, "Custo Unitário", "Custo Unitario", "Custo")),
      consumoPorUnidade: num(get(r, "Consumo por Unidade", "Consumo")),
      diasEstoque: num(get(r, "Dias de Estoque")),
      diasPagamento: num(get(r, "Dias de Pagamento")),
    });
  }
  resumo.push({ aba: ABAS_POB.materiaPrima, itens: p.materiasPrimas.length });

  /* Mão de obra */
  for (const r of linhas(wb, ABAS_POB.maoDeObra)) {
    const cargo = String(get(r, "Cargo", "Nome", "Função", "Funcao") ?? "").trim();
    if (!cargo) continue;
    const tipo = norm(get(r, "Tipo")).includes("indir") ? "Indireta" : "Direta";
    p.maoDeObra.push({
      id: uid(),
      cargo,
      tipo,
      quantidade: num(get(r, "Quantidade", "Qtd"), 1),
      salarioMensal: num(get(r, "Salário Mensal", "Salario Mensal", "Salário", "Salario")),
      encargosPct: pct(get(r, "Encargos")),
      beneficios: num(get(r, "Benefícios", "Beneficios")),
    });
  }
  resumo.push({ aba: ABAS_POB.maoDeObra, itens: p.maoDeObra.length });

  /* Custos indiretos e despesas */
  for (const [aba, destino] of [
    [ABAS_POB.custosIndiretos, p.custosIndiretos],
    [ABAS_POB.despesas, p.despesas],
  ] as const) {
    for (const r of linhas(wb, aba)) {
      const descricao = String(get(r, "Descrição", "Descricao", "Conta", "Item") ?? "").trim();
      if (!descricao) continue;
      destino.push({ id: uid(), descricao, valores: lerMeses(r) });
    }
    resumo.push({ aba, itens: destino.length });
  }

  /* CAPEX */
  for (const r of linhas(wb, ABAS_POB.capex)) {
    const descricao = String(get(r, "Descrição", "Descricao", "Investimento", "Item") ?? "").trim();
    if (!descricao) continue;
    const mes = Math.min(12, Math.max(1, Math.round(num(get(r, "Mês", "Mes"), 1))));
    p.capex.push({
      id: uid(),
      descricao,
      mes,
      valor: num(get(r, "Valor")),
      depreciacaoAnualPct: pct(get(r, "Depreciação Anual", "Depreciacao Anual", "Depreciação")),
    });
  }
  resumo.push({ aba: ABAS_POB.capex, itens: p.capex.length });

  /* Empréstimos */
  for (const r of linhas(wb, ABAS_POB.emprestimos)) {
    const nome = String(get(r, "Nome", "Descrição", "Descricao", "Empréstimo", "Emprestimo") ?? "").trim();
    if (!nome) continue;
    p.emprestimos.push({
      id: uid(),
      nome,
      valor: num(get(r, "Valor", "Captação", "Captacao")),
      mesCaptacao: Math.min(12, Math.max(1, Math.round(num(get(r, "Mês Captação", "Mes Captacao", "Mês", "Mes"), 1)))),
      prazoMeses: num(get(r, "Prazo"), 12),
      jurosAnualPct: pct(get(r, "Juros Anual", "Juros", "Taxa")),
    });
  }
  resumo.push({ aba: ABAS_POB.emprestimos, itens: p.emprestimos.length });

  const faltantes = Object.values(ABAS_POB).filter((a) => !acharAba(wb, a));
  if (faltantes.length) avisos.push(`Abas não encontradas no arquivo: ${faltantes.join(", ")}.`);

  p.importadoEm = new Date().toISOString();
  return { premissas: p, resumo, avisos };
}

/** Reexport para conveniência da tela. */
export { meses12 };
