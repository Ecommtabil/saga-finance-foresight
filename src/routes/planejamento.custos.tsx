import { createFileRoute } from "@tanstack/react-router";
import { PlanejamentoCustos } from "@/components/pob/PlanejamentoCustos";

export const Route = createFileRoute("/planejamento/custos")({
  head: () => ({
    meta: [
      { title: "Ficha Técnica de Custos por Produto | SAGA" },
      { name: "description", content: "Custo unitário por produto: matéria-prima, mão de obra e CIF rateado." },
      { property: "og:title", content: "Ficha Técnica de Custos por Produto | SAGA" },
      { property: "og:description", content: "Composição do custo unitário de cada produto do orçamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoCustos,
});
