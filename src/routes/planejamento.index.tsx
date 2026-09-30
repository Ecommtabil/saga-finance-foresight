import { createFileRoute } from "@tanstack/react-router";
import { PlanejamentoDashboard } from "@/components/pob/PlanejamentoDashboard";

export const Route = createFileRoute("/planejamento/")({
  head: () => ({
    meta: [
      { title: "Dashboard do Planejamento Orçamentário | SAGA" },
      {
        name: "description",
        content: "Visão executiva do cenário ativo com KPIs, rentabilidade e evolução mensal do caixa e do resultado.",
      },
      { property: "og:title", content: "Dashboard do Planejamento Orçamentário | SAGA" },
      { property: "og:description", content: "KPIs e gráficos executivos do cenário orçamentário ativo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoDashboard,
});
