import { createFileRoute } from "@tanstack/react-router";
import { EstudoPagina } from "@/components/viabilidade/EstudoPagina";
import { GraficosMaquina } from "@/components/viabilidade/Graficos";

export const Route = createFileRoute("/viabilidade/maquina-leasing")({
  head: () => ({
    meta: [
      { title: "Máquina: Compra vs Leasing — Estudo de Viabilidade | Ecommtabil" },
      { name: "description", content: "VPL do custo líquido e CAUE da compra de equipamento contra leasing, com benefício fiscal e mensalidade de equilíbrio." },
      { property: "og:title", content: "Máquina: Compra vs Leasing — Estudo de Viabilidade | Ecommtabil" },
      { property: "og:description", content: "VPL do custo líquido e CAUE da compra de equipamento contra leasing, com benefício fiscal e mensalidade de equilíbrio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MaquinaPage,
});

function MaquinaPage() {
  return (
    <EstudoPagina id="maquina-leasing" graficos={(p) => <GraficosMaquina p={p} />}
      rodape={<p className="text-center text-xs text-via-muted">Benefício fiscal considera empresa no Lucro Real. Para Simples/Presumido, zere a alíquota.</p>} />
  );
}
