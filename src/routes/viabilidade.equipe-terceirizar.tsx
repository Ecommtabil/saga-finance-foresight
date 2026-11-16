import { createFileRoute } from "@tanstack/react-router";
import { EstudoPagina } from "@/components/viabilidade/EstudoPagina";
import { GraficosEquipe } from "@/components/viabilidade/Graficos";
import { RiscosQualitativos, TabelaFuncionarios } from "@/components/viabilidade/ExtrasEquipe";

export const Route = createFileRoute("/viabilidade/equipe-terceirizar")({
  head: () => ({
    meta: [
      { title: "Equipe Interna vs Terceirizar — Estudo de Viabilidade | Ecommtabil" },
      { name: "description", content: "Custo incremental de equipe própria contra terceirização, com ponto de inflexão por mensalidade e por número de funcionários." },
      { property: "og:title", content: "Equipe Interna vs Terceirizar — Estudo de Viabilidade | Ecommtabil" },
      { property: "og:description", content: "Custo incremental de equipe própria contra terceirização, com ponto de inflexão por mensalidade e por número de funcionários." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EquipePage,
});

function EquipePage() {
  return (
    <EstudoPagina
      id="equipe-terceirizar"
      graficos={(p) => <GraficosEquipe p={p} />}
      extras={(p, alterar) => (
        <>
          <TabelaFuncionarios p={p} />
          <RiscosQualitativos riscos={p.riscos} onChange={(riscos) => alterar({ riscos })} />
        </>
      )}
      rodape={<p className="text-center text-xs text-via-muted">Benefício fiscal considera empresa no Lucro Real. Para Simples/Presumido, zere a alíquota.</p>}
    />
  );
}
