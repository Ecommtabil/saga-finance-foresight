import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSaga } from "@/lib/saga/context";
import { rotulo } from "@/lib/saga/parser";
import { EditarNomesContas } from "@/components/saga/EditarNomesContas";

export const Route = createFileRoute("/balanco")({
  head: () => ({
    meta: [
      { title: "Balanço Patrimonial — SAGA" },
      { name: "description", content: "Ativos, passivos e PL nos últimos 5 anos." },
      { property: "og:title", content: "Balanço Patrimonial — SAGA" },
      { property: "og:description", content: "Estrutura patrimonial completa." },
    ],
  }),
  component: BalancoPage,
});

function BalancoPage() {
  const { dados, modo, empresa } = useSaga();
  if (modo !== "completa") {
    return (
      <div className="space-y-6">
        <PageHeader titulo="Balanço Patrimonial" />
        <Alert>
          <AlertTitle>Disponível apenas no modo Contabilidade Completa</AlertTitle>
          <AlertDescription>
            Este módulo exige balanço detalhado. Troque o modo na página inicial.
          </AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!dados?.balanco) return <><PageHeader titulo="Balanço Patrimonial" /><EmptyState titulo="Balanço indisponível" /></>;
  const b = dados.balanco;
  const moeda = empresa?.moeda ?? "R$";
  return (
    <div className="space-y-6">
      <PageHeader titulo="Balanço Patrimonial" subtitulo="Ativo = Passivo + PL. 5 anos lado a lado." />
      <div className="flex justify-end"><EditarNomesContas grupos={["bp"]} /></div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Ativo</h2>
        <FinancialTable
          anos={dados.anos}
          moeda={moeda}
          analises
          baseAV={b.ativoTotal}
          baseAVLabel="o Ativo Total"
          rows={[
            { label: rotulo(dados, "bp.caixa", "Caixa e Equivalentes"), values: b.caixa, indent: true },
            { label: rotulo(dados, "bp.contasReceber", "Contas a Receber"), values: b.contasReceber, indent: true },
            { label: rotulo(dados, "bp.estoques", "Estoques"), values: b.estoques, indent: true },
            { label: rotulo(dados, "bp.ativoCirculante", "Ativo Circulante"), values: b.ativoCirculante, bold: true },
            { label: rotulo(dados, "bp.ativoNaoCirculante", "Ativo Não Circulante"), values: b.ativoNaoCirculante, indent: true },
            { label: rotulo(dados, "bp.ativoTotal", "Ativo Total"), values: b.ativoTotal, bold: true },
          ]}
        />
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Passivo + Patrimônio Líquido</h2>
        <FinancialTable
          anos={dados.anos}
          moeda={moeda}
          analises
          baseAV={b.passivoTotal}
          baseAVLabel="o Passivo + PL Total"
          rows={[
            { label: rotulo(dados, "bp.fornecedores", "Fornecedores"), values: b.fornecedores, indent: true },
            { label: rotulo(dados, "bp.emprestimosCP", "Empréstimos CP"), values: b.emprestimosCP, indent: true },
            { label: rotulo(dados, "bp.passivoCirculante", "Passivo Circulante"), values: b.passivoCirculante, bold: true },
            { label: rotulo(dados, "bp.emprestimosLP", "Empréstimos LP"), values: b.emprestimosLP, indent: true },
            { label: rotulo(dados, "bp.passivoNaoCirculante", "Passivo Não Circulante"), values: b.passivoNaoCirculante, bold: true },
            { label: rotulo(dados, "bp.patrimonioLiquido", "Patrimônio Líquido"), values: b.patrimonioLiquido, bold: true },
            { label: rotulo(dados, "bp.passivoTotal", "Passivo + PL Total"), values: b.passivoTotal, bold: true },
          ]}
        />
      </div>
    </div>
  );
}