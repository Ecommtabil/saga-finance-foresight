import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { useSaga } from "@/lib/saga/context";
import { fluxoCaixaDireto, fluxoCaixaIndireto } from "@/lib/saga/calculations";
import { fmtNum } from "@/lib/saga/formatters";

export const Route = createFileRoute("/fluxo-caixa")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa — SAGA" },
      { name: "description", content: "Método direto e indireto, com conferência do caixa final." },
      { property: "og:title", content: "Fluxo de Caixa — SAGA" },
      { property: "og:description", content: "Fluxo de caixa operacional, investimento e financiamento." },
    ],
  }),
  component: FluxoPage,
});

function FluxoPage() {
  const { dados, modo, empresa } = useSaga();
  if (modo !== "completa")
    return (
      <>
        <PageHeader titulo="Fluxo de Caixa" />
        <Alert><AlertTitle>Disponível apenas no modo Contabilidade Completa</AlertTitle></Alert>
      </>
    );
  if (!dados) return <><PageHeader titulo="Fluxo de Caixa" /><EmptyState titulo="Fluxo indisponível" /></>;
  const dir = fluxoCaixaDireto(dados);
  const ind = fluxoCaixaIndireto(dados);
  const moeda = empresa?.moeda ?? "R$";
  const bateu = dir.variacao.every((v, i) => Math.abs(v - ind.variacao[i]) < 1);
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Fluxo de Caixa"
        subtitulo="Comparação entre método direto e indireto."
        action={
          <div
            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${
              bateu ? "border-emerald-500/30 bg-emerald-50 text-emerald-700" : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {bateu ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            {bateu ? "Métodos batem no caixa final" : "Divergência entre métodos"}
          </div>
        }
      />
      <Tabs defaultValue="direto">
        <TabsList>
          <TabsTrigger value="direto">Método Direto</TabsTrigger>
          <TabsTrigger value="indireto">Método Indireto</TabsTrigger>
        </TabsList>
        <TabsContent value="direto" className="mt-4">
          <FinancialTable
            anos={dados.anos}
            moeda={moeda}
            rows={[
              { label: "Recebimentos de Clientes", values: dir.recebimentos, indent: true },
              { label: "Pagamentos a Fornecedores/Despesas", values: dir.pagamentos, indent: true },
              { label: "Impostos Pagos", values: dir.impostos, indent: true },
              { label: "= Caixa Operacional", values: dir.caixaOp, bold: true },
              { label: "Caixa de Investimento (CAPEX)", values: dir.caixaInv, indent: true },
              { label: "Caixa de Financiamento", values: dir.caixaFin, indent: true },
              { label: "= Variação de Caixa", values: dir.variacao, bold: true },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Variação total no período: {fmtNum(dir.variacao.reduce((a, b) => a + b, 0))}
          </p>
        </TabsContent>
        <TabsContent value="indireto" className="mt-4">
          <FinancialTable
            anos={dados.anos}
            moeda={moeda}
            rows={[
              { label: "Lucro Líquido", values: ind.lucroLiquido, indent: true },
              { label: "(+) Depreciação", values: ind.depreciacao, indent: true },
              { label: "= Caixa Operacional", values: ind.caixaOp, bold: true },
              { label: "Caixa de Investimento (CAPEX)", values: ind.caixaInv, indent: true },
              { label: "Caixa de Financiamento", values: ind.caixaFin, indent: true },
              { label: "= Variação de Caixa", values: ind.variacao, bold: true },
            ]}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}