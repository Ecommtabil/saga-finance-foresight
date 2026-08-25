import * as XLSX from "xlsx";
import type { LinhaOrcamento, Orcamento, TipoConta } from "./types";
import { MESES, nulls12, uid, zeros12 } from "./types";

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  let s = String(v).trim();
  if (!s) return null;
  const neg = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[R$\s()%-]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  if (!isFinite(n)) return null;
  return neg ? -n : n;
}


function tipoDe(v: unknown): TipoConta {
  const t = norm(v);
  if (t.startsWith("rec")) return "receita";
  if (t.startsWith("cus")) return "custo";
  if (t.startsWith("desp")) return "despesa";
  return "outros";
}

const EXEMPLO: { grupo: string; conta: string; tipo: TipoConta; orc: number }[] = [
  { grupo: "Receitas", conta: "Vendas de produtos", tipo: "receita", orc: 250000 },
  { grupo: "Receitas", conta: "Serviços", tipo: "receita", orc: 60000 },
  { grupo: "Custos", conta: "CMV", tipo: "custo", orc: 120000 },
  { grupo: "Custos", conta: "Frete sobre vendas", tipo: "custo", orc: 12000 },
  { grupo: "Despesas", conta: "Pessoal", tipo: "despesa", orc: 70000 },
  { grupo: "Despesas", conta: "Marketing", tipo: "despesa", orc: 18000 },
  { grupo: "Despesas", conta: "Administrativas", tipo: "despesa", orc: 25000 },
];

/** Gera o arquivo modelo (.xlsx) de orçamento: uma aba Orçado e uma aba Realizado. */
export function gerarModeloOrcamento(orc?: Orcamento): Blob {
  const cabecalho = ["Grupo", "Conta", "Tipo", ...MESES];
  const linhas: LinhaOrcamento[] =
    orc?.linhas.length
      ? orc.linhas
      : EXEMPLO.map((e) => ({
          id: uid(),
          grupo: e.grupo,
          conta: e.conta,
          tipo: e.tipo,
          orcado: Array.from({ length: 12 }, () => e.orc),
          realizado: nulls12(),
        }));

  const abaOrcado = [
    cabecalho,
    ...linhas.map((l) => [l.grupo, l.conta, l.tipo, ...l.orcado]),
  ];
  const abaReal = [
    cabecalho,
    ...linhas.map((l) => [
      l.grupo,
      l.conta,
      l.tipo,
      ...l.realizado.map((r) => (r == null ? "" : r)),
    ]),
  ];
  const instr = [
    ["SAGA — Modelo de Orçamento"],
    [""],
    ["1. Preencha a aba 'Orcado' com o orçamento aprovado de cada conta, mês a mês."],
    ["2. Preencha a aba 'Realizado' apenas com os meses já fechados (deixe em branco o restante)."],
    ["3. Coluna Tipo aceita: Receita, Custo, Despesa ou Outros."],
    ["4. Use as mesmas contas nas duas abas (Grupo + Conta identificam a linha)."],
    ["5. Valores em número puro, sem R$ e sem separador de milhar."],
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(instr), "Instrucoes");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaOrcado), "Orcado");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaReal), "Realizado");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export interface ResultadoImportOrcamento {
  linhas: LinhaOrcamento[];
  avisos: string[];
  resumo: { aba: string; itens: number }[];
}

export class ImportOrcamentoError extends Error {}

function lerAba(wb: XLSX.WorkBook, nomes: string[]): unknown[][] | null {
  const alvo = wb.SheetNames.find((n) => nomes.includes(norm(n)));
  if (!alvo) return null;
  return XLSX.utils.sheet_to_json(wb.Sheets[alvo], { header: 1, defval: "" }) as unknown[][];
}

/** Descobre em qual coluna começam os 12 meses (default 3). */
function offsetMeses(header: unknown[] | undefined): number {
  if (!header) return 3;
  const idx = header.findIndex((h) => norm(h).startsWith(norm(MESES[0])));
  return idx >= 0 ? idx : 3;
}

export async function lerModeloOrcamento(file: File): Promise<ResultadoImportOrcamento> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const orcado = lerAba(wb, ["orcado", "orcamento", "previsto"]);
  if (!orcado) throw new ImportOrcamentoError("Aba 'Orcado' não encontrada na planilha.");
  const realizado = lerAba(wb, ["realizado", "real"]);

  const avisos: string[] = [];
  const mapa = new Map<string, LinhaOrcamento>();
  const porConta = new Map<string, LinhaOrcamento>();

  const offOrc = offsetMeses(orcado[0]);
  for (const row of orcado.slice(1)) {
    const grupo = String(row[0] ?? "").trim();
    const conta = String(row[1] ?? "").trim();
    if (!conta) continue;
    const valores = Array.from({ length: 12 }, (_, i) => num(row[offOrc + i]) ?? 0);
    const linha: LinhaOrcamento = {
      id: uid(),
      grupo: grupo || "Geral",
      conta,
      tipo: tipoDe(row[2]),
      orcado: valores,
      realizado: nulls12(),
    };
    mapa.set(norm(`${linha.grupo}|${conta}`), linha);
    if (!porConta.has(norm(conta))) porConta.set(norm(conta), linha);
  }

  if (mapa.size === 0) throw new ImportOrcamentoError("Nenhuma conta encontrada na aba 'Orcado'.");

  let linhasReal = 0;
  if (realizado) {
    const offReal = offsetMeses(realizado[0]);
    for (const row of realizado.slice(1)) {
      const grupo = String(row[0] ?? "").trim() || "Geral";
      const conta = String(row[1] ?? "").trim();
      if (!conta) continue;
      const chave = norm(`${grupo}|${conta}`);
      let linha = mapa.get(chave) ?? porConta.get(norm(conta));
      if (!linha) {
        linha = {
          id: uid(),
          grupo,
          conta,
          tipo: tipoDe(row[2]),
          orcado: zeros12(),
          realizado: nulls12(),
        };
        mapa.set(chave, linha);
        porConta.set(norm(conta), linha);
        avisos.push(`Conta "${conta}" existe apenas no Realizado (orçado = 0).`);
      } else if (!mapa.has(chave)) {
        avisos.push(
          `Grupo divergente para "${conta}" (Realizado: "${grupo}") — associada ao grupo "${linha.grupo}".`,
        );
      }
      const vals = Array.from({ length: 12 }, (_, i) => num(row[offReal + i]));
      if (vals.every((v) => v == null)) continue;
      linha.realizado = vals;
      linhasReal++;
    }
    if (linhasReal === 0)
      avisos.push("Nenhum valor realizado preenchido na aba 'Realizado' (todos os meses vazios).");
  } else {
    avisos.push("Aba 'Realizado' não encontrada — importado somente o orçado.");
  }

  return {
    linhas: [...mapa.values()],
    avisos,
    resumo: [
      { aba: "Orcado", itens: mapa.size },
      { aba: "Realizado", itens: linhasReal },
    ],
  };
}


export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Importação separada: Orçado e Realizado ---------- */

/** Modelo com uma única aba (Orcado ou Realizado). */
export function gerarModeloParcial(campo: "orcado" | "realizado", orc?: Orcamento): Blob {
  const cabecalho = ["Grupo", "Conta", "Tipo", ...MESES];
  const linhas: LinhaOrcamento[] = orc?.linhas.length
    ? orc.linhas
    : EXEMPLO.map((e) => ({
        id: uid(),
        grupo: e.grupo,
        conta: e.conta,
        tipo: e.tipo,
        orcado: Array.from({ length: 12 }, () => e.orc),
        realizado: nulls12(),
      }));
  const nome = campo === "orcado" ? "Orcado" : "Realizado";
  const aoa = [
    cabecalho,
    ...linhas.map((l) => [
      l.grupo,
      l.conta,
      l.tipo,
      ...(campo === "orcado" ? l.orcado : l.realizado.map((r) => (r == null ? "" : r))),
    ]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), nome);
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function abaOuPrimeira(wb: XLSX.WorkBook, nomes: string[]): unknown[][] {
  return (
    lerAba(wb, nomes) ??
    (XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
      header: 1,
      defval: "",
    }) as unknown[][])
  );
}

/** Importa apenas o ORÇADO. Mantém o realizado das contas já existentes. */
export async function lerPlanilhaOrcado(
  file: File,
  atuais: LinhaOrcamento[] = [],
): Promise<ResultadoImportOrcamento> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const dados = abaOuPrimeira(wb, ["orcado", "orcamento", "previsto"]);
  const off = offsetMeses(dados[0]);
  const avisos: string[] = [];
  const antigas = new Map(atuais.map((l) => [norm(`${l.grupo}|${l.conta}`), l]));
  const antigasConta = new Map(atuais.map((l) => [norm(l.conta), l]));
  const linhas: LinhaOrcamento[] = [];

  for (const row of dados.slice(1)) {
    const conta = String(row[1] ?? "").trim();
    if (!conta) continue;
    const grupo = String(row[0] ?? "").trim() || "Geral";
    const anterior = antigas.get(norm(`${grupo}|${conta}`)) ?? antigasConta.get(norm(conta));
    linhas.push({
      id: anterior?.id ?? uid(),
      grupo,
      conta,
      tipo: tipoDe(row[2]),
      orcado: Array.from({ length: 12 }, (_, i) => num(row[off + i]) ?? 0),
      realizado: anterior ? [...anterior.realizado] : nulls12(),
    });
  }
  if (linhas.length === 0)
    throw new ImportOrcamentoError("Nenhuma conta encontrada na planilha de Orçado.");
  const mantidas = linhas.filter((l) => l.realizado.some((v) => v != null)).length;
  if (mantidas) avisos.push(`${mantidas} conta(s) mantiveram o realizado já existente.`);
  return { linhas, avisos, resumo: [{ aba: "Orcado", itens: linhas.length }] };
}

/** Importa apenas o REALIZADO, aplicando sobre as contas já cadastradas. */
export async function lerPlanilhaRealizado(
  file: File,
  atuais: LinhaOrcamento[],
): Promise<ResultadoImportOrcamento> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const dados = abaOuPrimeira(wb, ["realizado", "real"]);
  const off = offsetMeses(dados[0]);
  const avisos: string[] = [];
  const linhas = atuais.map((l) => ({ ...l, orcado: [...l.orcado], realizado: [...l.realizado] }));
  const porChave = new Map(linhas.map((l) => [norm(`${l.grupo}|${l.conta}`), l]));
  const porConta = new Map<string, LinhaOrcamento>();
  for (const l of linhas) if (!porConta.has(norm(l.conta))) porConta.set(norm(l.conta), l);

  let aplicadas = 0;
  for (const row of dados.slice(1)) {
    const conta = String(row[1] ?? "").trim();
    if (!conta) continue;
    const grupo = String(row[0] ?? "").trim() || "Geral";
    const chave = norm(`${grupo}|${conta}`);
    let linha = porChave.get(chave) ?? porConta.get(norm(conta));
    const vals = Array.from({ length: 12 }, (_, i) => num(row[off + i]));
    if (!linha) {
      linha = {
        id: uid(),
        grupo,
        conta,
        tipo: tipoDe(row[2]),
        orcado: zeros12(),
        realizado: nulls12(),
      };
      linhas.push(linha);
      porChave.set(chave, linha);
      porConta.set(norm(conta), linha);
      avisos.push(`Conta "${conta}" não existe no orçado — criada com orçado = 0.`);
    } else if (!porChave.has(chave)) {
      avisos.push(`Grupo divergente para "${conta}" — associada ao grupo "${linha.grupo}".`);
    }
    if (vals.every((v) => v == null)) continue;
    linha.realizado = vals;
    aplicadas++;
  }
  if (aplicadas === 0)
    throw new ImportOrcamentoError(
      "Nenhum valor realizado encontrado. Verifique se os meses estão preenchidos.",
    );
  return { linhas, avisos, resumo: [{ aba: "Realizado", itens: aplicadas }] };
}
