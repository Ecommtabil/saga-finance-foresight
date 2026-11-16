import { createFileRoute } from "@tanstack/react-router";
import { EstudoPagina } from "@/components/viabilidade/EstudoPagina";
import { GraficosNovaLinha } from "@/components/viabilidade/Graficos";

export const Route = createFileRoute("/viabilidade/nova-linha")({
  head: () => ({
    meta: [
      { title: "Nova Linha de Produtos — Estudo de Viabilidade | Ecommtabil" },
      { name: "description", content: "DRE projetada, fluxo de caixa livre, VPL, TIR, payback, sensibilidade e parecer automático para lançar uma nova linha de produtos." },
      { property: "og:title", content: "Nova Linha de Produtos — Estudo de Viabilidade | Ecommtabil" },
      { property: "og:description", content: "DRE projetada, fluxo de caixa livre, VPL, TIR, payback, sensibilidade e parecer automático para lançar uma nova linha de produtos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovaLinhaPage,
});

function NovaLinhaPage() {
  return <EstudoPagina id="nova-linha" graficos={(p) => <GraficosNovaLinha p={p} />} />;
}
