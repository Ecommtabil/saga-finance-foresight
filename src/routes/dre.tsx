import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { useSaga } from "@/lib/saga/context";
import { rotulo } from "@/lib/saga/parser";
import { EditarNomesContas } from "@/components/saga/EditarNomesContas";

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
  const moeda = empresa?.moeda ?? "R$";
  return (
    <div className="space-y-6">
      <PageHeader titulo="Demonstração do Resultado (DRE)" subtitulo="Valores anuais nas 5 últimas competências." />
      <div className="flex justify-end"><EditarNomesContas grupos={["dre"]} /></div>
      <FinancialTable
        anos={dados.anos}
        moeda={moeda}
        analises
        baseAV={dados.dre.receitaLiquida}
        baseAVLabel="a Receita Líquida"
        rows={[
          { label: rotulo(dados, "dre.receitaBruta", "Receita Bruta"), values: dados.dre.receitaBruta },
          { label: "(-) " + rotulo(dados, "dre.deducoes", "Deduções"), values: dados.dre.deducoes, indent: true },
          { label: "= " + rotulo(dados, "dre.receitaLiquida", "Receita Líquida"), values: dados.dre.receitaLiquida, bold: true },
          { label: "(-) " + rotulo(dados, "dre.cmv", "CMV"), values: dados.dre.cmv, indent: true },
          { label: "= " + rotulo(dados, "dre.lucroBruto", "Lucro Bruto"), values: dados.dre.lucroBruto, bold: true },
          { label: "(-) " + rotulo(dados, "dre.despOperacionais", "Despesas Operacionais"), values: dados.dre.despOperacionais, indent: true },
          { label: "= " + rotulo(dados, "dre.ebitda", "EBITDA"), values: dados.dre.ebitda, bold: true },
          { label: "(-) " + rotulo(dados, "dre.depreciacao", "Depreciação"), values: dados.dre.depreciacao, indent: true },
          { label: "= " + rotulo(dados, "dre.ebit", "EBIT"), values: dados.dre.ebit, bold: true },
          { label: "(+/-) " + rotulo(dados, "dre.resultadoFinanceiro", "Resultado Financeiro"), values: dados.dre.resultadoFinanceiro, indent: true },
          { label: "= " + rotulo(dados, "dre.lair", "LAIR"), values: dados.dre.lair, bold: true },
          { label: "(-) " + rotulo(dados, "dre.impostos", "Impostos"), values: dados.dre.impostos, indent: true },
          { label: "= " + rotulo(dados, "dre.lucroLiquido", "Lucro Líquido"), values: dados.dre.lucroLiquido, bold: true },
        ]}
      />
    </div>
  );
}