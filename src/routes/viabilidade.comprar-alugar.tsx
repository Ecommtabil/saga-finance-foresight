import { createFileRoute } from "@tanstack/react-router";
import { EstudoPagina } from "@/components/viabilidade/EstudoPagina";
import { GraficosComprarAlugar } from "@/components/viabilidade/Graficos";

export const Route = createFileRoute("/viabilidade/comprar-alugar")({
  head: () => ({
    meta: [
      { title: "Comprar ou Alugar — Estudo de Viabilidade | Ecommtabil" },
      { name: "description", content: "Fluxos comparativos e incrementais de compra e aluguel de imóvel ou ativo, com benefício fiscal, IR sobre ganho de capital e revenda de empate." },
      { property: "og:title", content: "Comprar ou Alugar — Estudo de Viabilidade | Ecommtabil" },
      { property: "og:description", content: "Fluxos comparativos e incrementais de compra e aluguel de imóvel ou ativo, com benefício fiscal, IR sobre ganho de capital e revenda de empate." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComprarAlugarPage,
});

function ComprarAlugarPage() {
  return (
    <EstudoPagina id="comprar-alugar" graficos={(p) => <GraficosComprarAlugar p={p} />}
      rodape={<p className="text-center text-xs text-via-muted">Benefício fiscal considera empresa no Lucro Real. Para Simples/Presumido, zere a alíquota.</p>} />
  );
}
