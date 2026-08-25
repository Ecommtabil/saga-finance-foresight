import { createFileRoute, Outlet } from "@tanstack/react-router";
import { OrcamentoProvider } from "@/lib/orcamento/store";
import { OrcamentoHeader } from "@/components/orcamento/OrcamentoHeader";

export const Route = createFileRoute("/orcamento")({
  head: () => ({
    meta: [
      { title: "Orçamento — Previsto, Realizado e Forecast | SAGA" },
      {
        name: "description",
        content:
          "Módulo de orçamento empresarial: orçado versus realizado, análise de variações, forecast e rolling forecast.",
      },
      { property: "og:title", content: "Orçamento — Previsto, Realizado e Forecast | SAGA" },
      {
        property: "og:description",
        content: "Controle orçamentário mensal com variações, forecast e rolling forecast de 12 meses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OrcamentoLayout,
});

function OrcamentoLayout() {
  return (
    <OrcamentoProvider>
      <OrcamentoHeader />
      <Outlet />
    </OrcamentoProvider>
  );
}
