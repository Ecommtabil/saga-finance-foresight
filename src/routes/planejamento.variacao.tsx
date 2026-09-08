import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/planejamento/variacao")({
  head: () => ({
    meta: [
      { title: "Variação Orçado x Realizado | SAGA" },
      { name: "description", content: "Análise de variância de volume, preço, custos variáveis e fixos em gráfico cascata." },
      { property: "og:title", content: "Variação Orçado x Realizado | SAGA" },
      { property: "og:description", content: "Comparação entre orçado e realizado com decomposição das variações." },
    ],
  }),
  component: () => (
    <Card>
      <CardHeader>
        <CardTitle>Variação</CardTitle>
        <CardDescription>
          Aqui ficará a comparação Orçado x Realizado, com decomposição por volume, preço, custos
          variáveis e custos fixos em gráfico de cascata.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Seção em construção.</CardContent>
    </Card>
  ),
});
