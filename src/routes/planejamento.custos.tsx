import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/planejamento/custos")({
  head: () => ({
    meta: [
      { title: "Ficha Técnica de Custos por Produto | SAGA" },
      { name: "description", content: "Custo unitário por produto: matéria-prima, mão de obra e CIF rateado." },
      { property: "og:title", content: "Ficha Técnica de Custos por Produto | SAGA" },
      { property: "og:description", content: "Composição do custo unitário de cada produto do orçamento." },
    ],
  }),
  component: () => (
    <Card>
      <CardHeader>
        <CardTitle>Custos</CardTitle>
        <CardDescription>
          Aqui ficará a ficha técnica do custo unitário por produto: matéria-prima, mão de obra e
          custos indiretos de fabricação rateados.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">Seção em construção.</CardContent>
    </Card>
  ),
});
