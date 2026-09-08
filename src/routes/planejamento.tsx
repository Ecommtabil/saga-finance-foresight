import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PlanejamentoProvider } from "@/lib/pob/store";
import { PlanejamentoHeader } from "@/components/pob/PlanejamentoHeader";

export const Route = createFileRoute("/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento Orçamentário — Orçamento Base Zero | SAGA" },
      {
        name: "description",
        content:
          "Planejamento orçamentário empresarial com premissas, projeção mensal de DRE, fluxo de caixa e balanço, variação e custos.",
      },
      { property: "og:title", content: "Planejamento Orçamentário | SAGA" },
      {
        property: "og:description",
        content: "Orçamento base zero por cenário: premissas, projeção, variação, custos e dashboard.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoLayout,
});

function PlanejamentoLayout() {
  return (
    <PlanejamentoProvider>
      <PlanejamentoHeader />
      <Outlet />
    </PlanejamentoProvider>
  );
}
