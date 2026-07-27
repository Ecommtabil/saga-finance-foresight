import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { useSaga } from "@/lib/saga/context";
import { margens } from "@/lib/saga/calculations";

export const Route = createFileRoute("/dre")({
  head: () => ({
    meta: [
      { title: "DRE — SAGA" },
      { name: "description", content: "Demonstração do Resultado do Exercício, 5 anos." },
      { property: "og:title", content: "DRE — SAGA" },
      { property: "og:description", content: "Receita, custos, margens e lucro líquido." },
    ],
  }),
  component: DrePage,
});

function DrePage() {
  const { dados, empresa } = useSaga();
  if (!dados) return <><PageHeader titulo="DRE" /><EmptyState titulo="DRE indisponível" /></>;
  const m = margens(dados);
  const moeda = empresa?.moeda ?? "R$";
  return (
    <div className="space-y-6">
      <PageHeader titulo="Demonstração do Resultado (DRE)" subtitulo="Valores anuais nas 5 últimas competências." />
      <FinancialTable
        anos={dados.anos}
        moeda={moeda}
        rows={[
          { label: "Receita Bruta", values: dados.dre.receitaBruta },
          { label: "(-) Deduções", values: dados.dre.deducoes, indent: true },
          { label: "= Receita Líquida", values: dados.dre.receitaLiquida, bold: true },
          { label: "(-) CMV", values: dados.dre.cmv, indent: true },
          { label: "= Lucro Bruto", values: dados.dre.lucroBruto, bold: true },
          { label: "(-) Despesas Operacionais", values: dados.dre.despOperacionais, indent: true },
          { label: "= EBITDA", values: dados.dre.ebitda, bold: true },
          { label: "(-) Depreciação", values: dados.dre.depreciacao, indent: true },
          { label: "= EBIT", values: dados.dre.ebit, bold: true },
          { label: "(+/-) Resultado Financeiro", values: dados.dre.resultadoFinanceiro, indent: true },
          { label: "= LAIR", values: dados.dre.lair, bold: true },
          { label: "(-) Impostos", values: dados.dre.impostos, indent: true },
          { label: "= Lucro Líquido", values: dados.dre.lucroLiquido, bold: true },
        ]}
      />
      <div>
        <h2 className="mb-3 text-lg font-semibold">Margens</h2>
        <FinancialTable
          anos={dados.anos}
          moeda="%"
          rows={[
            { label: "Margem Bruta", values: m.bruta, isPct: true },
            { label: "Margem EBITDA", values: m.ebitda, isPct: true },
            { label: "Margem Operacional", values: m.operacional, isPct: true },
            { label: "Margem Líquida", values: m.liquida, isPct: true, bold: true },
          ]}
        />
      </div>
    </div>
  );
}