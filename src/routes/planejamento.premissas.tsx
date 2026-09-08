import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/planejamento/premissas")({
  head: () => ({
    meta: [
      { title: "Premissas do Orçamento | SAGA" },
      { name: "description", content: "Parâmetros de vendas, impostos, produção, custos, despesas, CAPEX e empréstimos." },
      { property: "og:title", content: "Premissas do Orçamento | SAGA" },
      { property: "og:description", content: "Cadastro de todos os parâmetros do orçamento anual." },
    ],
  }),
  component: () => (
    <Card>
      <CardHeader>
        <CardTitle>Premissas</CardTitle>
        <CardDescription>
          Aqui ficará o cadastro de vendas, impostos, produção, matéria-prima, mão de obra, custos
          indiretos, despesas operacionais, investimentos (CAPEX) e empréstimos.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Seção em construção.</CardContent>
    </Card>
  ),
});
