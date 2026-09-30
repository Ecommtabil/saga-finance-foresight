import { createFileRoute } from "@tanstack/react-router";
import { PlanejamentoDashboard } from "@/components/pob/PlanejamentoDashboard";

export const Route = createFileRoute("/planejamento/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard do Orçamento | SAGA" },
      { name: "description", content: "KPIs do orçamento: margem bruta, EBITDA, margem líquida, ROE, ROIC e fluxo de caixa." },
      { property: "og:title", content: "Dashboard do Orçamento | SAGA" },
      { property: "og:description", content: "Visão executiva do planejamento orçamentário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoDashboard,
});
