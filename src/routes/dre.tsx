import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { EditarNomesContas } from "@/components/saga/EditarNomesContas";
import { Button } from "@/components/ui/button";
import { useSaga } from "@/lib/saga/context";
import { montarLinhasDRE, type VisaoDRE } from "@/lib/saga/dre-view";

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
  const [visao, setVisao] = useState<VisaoDRE>("gerencial");
  if (!dados) return <><PageHeader titulo="DRE" /><EmptyState titulo="DRE indisponível" /></>;
  const moeda = empresa?.moeda ?? "R$";
  const quantidadeExtras = dados.contasExtrasDre?.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader titulo="Demonstração do Resultado (DRE)" subtitulo="Valores anuais nas 5 últimas competências." />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Formato da DRE">
          <Button
            type="button"
            size="sm"
            variant={visao === "gerencial" ? "default" : "outline"}
            onClick={() => setVisao("gerencial")}
          >
            DRE Gerencial
          </Button>
          <Button
            type="button"
            size="sm"
            variant={visao === "analitico" ? "default" : "outline"}
            onClick={() => setVisao("analitico")}
          >
            DRE Analítico
          </Button>
        </div>
        <EditarNomesContas grupos={["dre"]} />
      </div>
      {visao === "analitico" && (
        <p className="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          {quantidadeExtras > 0
            ? `${quantidadeExtras} ${quantidadeExtras === 1 ? "conta adicionada aparece" : "contas adicionadas aparecem"} dentro do respectivo grupo. O valor do grupo já inclui suas contas; não some os valores novamente.`
            : "Nenhuma conta extra foi identificada na última importação. Para detalhar uma conta como Aluguel, adicione-a à planilha e importe o arquivo novamente."}
        </p>
      )}
      <FinancialTable
        anos={dados.anos}
        moeda={moeda}
        analises
        baseAV={dados.dre.receitaLiquida}
        baseAVLabel="a Receita Líquida"
        rows={montarLinhasDRE(dados, visao)}
      />
    </div>
  );
}
