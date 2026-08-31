import { createFileRoute, Outlet } from "@tanstack/react-router";
import { MF2Provider } from "@/lib/mf2/store";

export const Route = createFileRoute("/modelagem-financeira-2")({
  head: () => ({
    meta: [
      { title: "Modelagem Financeira 2 — SAGA" },
      {
        name: "description",
        content:
          "Modelos financeiros multiempresa com premissas macro, produtos, custos, tributação e funding.",
      },
      { property: "og:title", content: "Modelagem Financeira 2 — SAGA" },
      {
        property: "og:description",
        content: "Cadastro estruturado de modelos financeiros por empresa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <MF2Provider>
      <Outlet />
    </MF2Provider>
  ),
});
