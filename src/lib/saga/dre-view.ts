import { rotulo } from "./parser";
import type { DadosImportados, DRE } from "./types";

export type VisaoDRE = "gerencial" | "analitico";

export interface LinhaDRE {
  label: string;
  values: number[];
  bold?: boolean;
  indent?: boolean;
}

const ESTRUTURA: { key: keyof DRE; label: string; prefix: string; bold?: boolean }[] = [
  { key: "receitaBruta", label: "Receita Bruta", prefix: "" },
  { key: "deducoes", label: "Deduções", prefix: "(-) " },
  { key: "receitaLiquida", label: "Receita Líquida", prefix: "= ", bold: true },
  { key: "cmv", label: "CMV", prefix: "(-) " },
  { key: "lucroBruto", label: "Lucro Bruto", prefix: "= ", bold: true },
  { key: "despOperacionais", label: "Despesas Operacionais", prefix: "(-) " },
  { key: "ebitda", label: "EBITDA", prefix: "= ", bold: true },
  { key: "depreciacao", label: "Depreciação", prefix: "(-) " },
  { key: "ebit", label: "EBIT", prefix: "= ", bold: true },
  { key: "resultadoFinanceiro", label: "Resultado Financeiro", prefix: "(+/-) " },
  { key: "lair", label: "LAIR", prefix: "= ", bold: true },
  { key: "impostos", label: "Impostos", prefix: "(-) " },
  { key: "lucroLiquido", label: "Lucro Líquido", prefix: "= ", bold: true },
];

function somar(a: number[], b: number[]): number[] {
  return a.map((valor, i) => valor + (b[i] ?? 0));
}

function subtrair(a: number[], b: number[]): number[] {
  return a.map((valor, i) => valor - (b[i] ?? 0));
}

/** Remove apenas o sufixo gerado pela importação de linhas extras. */
function nomeSemConsolidacao(nome: string): string {
  return nome.replace(/ \(inclui [^)]+\)$/, "");
}

/**
 * Monta a DRE sem recalcular resultados. Na visão analítica, abre cada conta
 * que recebeu linhas extras em: demais contas + contas extras = total importado.
 */
export function montarLinhasDRE(dados: DadosImportados, visao: VisaoDRE): LinhaDRE[] {
  const linhas: LinhaDRE[] = [];

  for (const conta of ESTRUTURA) {
    const nome = rotulo(dados, `dre.${conta.key}`, conta.label);
    const valores = dados.dre[conta.key];
    const extras = (dados.contasExtrasDre ?? []).filter((extra) => extra.contaPai === conta.key);

    if (visao === "gerencial" || extras.length === 0) {
      linhas.push({
        label: conta.prefix + nome,
        values: valores,
        ...(conta.bold ? { bold: true } : {}),
        indent: !conta.bold,
      });
      continue;
    }

    const nomeBase = nomeSemConsolidacao(nome);
    const totalExtras = extras.reduce((total, extra) => somar(total, extra.valores), [0, 0, 0, 0, 0]);
    linhas.push({
      label: `${conta.prefix}${nomeBase} — demais contas`,
      values: subtrair(valores, totalExtras),
      indent: true,
    });
    for (const extra of extras) {
      linhas.push({
        label: conta.prefix + rotulo(dados, `dre.extra.${extra.id}`, extra.nome),
        values: extra.valores,
        indent: true,
      });
    }
    linhas.push({
      label: `${conta.prefix}Total ${nomeBase}`,
      values: valores,
      bold: true,
    });
  }

  return linhas;
}
