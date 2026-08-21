import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SimplProvider } from "@/lib/simpl/store";
import { SimplHeader } from "@/components/simpl/SimplHeader";

export const Route = createFileRoute("/modelagem-simplificada")({
  head: () => ({
    meta: [
      { title: "Modelagem Simplificada — SAGA" },
      {
        name: "description",
        content:
          "Modelagem financeira integrada (DRE, Balanço, Fluxo de Caixa e DCF) multiempresa para PMEs.",
      },
      { property: "og:title", content: "Modelagem Simplificada — SAGA" },
      {
        property: "og:description",
        content: "Projeções integradas e valuation por cliente, com cenários comparáveis.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelagemSimplificadaLayout,
});

function ModelagemSimplificadaLayout() {
  return (
    <SimplProvider>
      <SimplHeader />
      <Outlet />
    </SimplProvider>
  );
}
