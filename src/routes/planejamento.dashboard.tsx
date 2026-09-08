import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/planejamento/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do Orçamento | SAGA" },
      { name: "description", content: "KPIs do orçamento: margem bruta, EBITDA, margem líquida, ROE, ROIC e fluxo de caixa." },
      { property: "og:title", content: "Dashboard do Orçamento | SAGA" },
      { property: "og:description", content: "Visão executiva do planejamento orçamentário." },
    ],
  }),
  component: () => (
    <Card>
      <CardHeader>
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          Aqui ficará a visão executiva: margem bruta, EBITDA, margem líquida, ROE, ROIC e gráficos
          de fluxo de caixa mensal.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Seção em construção.</CardContent>
    </Card>
  ),
});
