import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/planejamento/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção Orçamentária (12 meses) | SAGA" },
      { name: "description", content: "Projeção mensal de vendas, produção, custos, DRE, fluxo de caixa e balanço." },
      { property: "og:title", content: "Projeção Orçamentária (12 meses) | SAGA" },
      { property: "og:description", content: "Motor de cálculo mensal do orçamento anual." },
    ],
  }),
  component: () => (
    <Card>
      <CardHeader>
        <CardTitle>Projeção Orçamentária</CardTitle>
        <CardDescription>
          Aqui ficará a projeção mensal de 12 meses: vendas, produção, compras, mão de obra, custos
          indiretos, despesas, DRE, fluxo de caixa e balanço patrimonial.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Seção em construção.</CardContent>
    </Card>
  ),
});
