import { createFileRoute } from "@tanstack/react-router";
import { PlanejamentoVariacao } from "@/components/pob/PlanejamentoVariacao";

export const Route = createFileRoute("/planejamento/variacao")({
  head: () => ({
    meta: [
      { title: "Variação Orçado x Realizado | SAGA" },
      { name: "description", content: "Decomposição da variação do lucro em efeitos de volume, preço, custos variáveis e fixos, com gráfico ponte." },
      { property: "og:title", content: "Variação Orçado x Realizado | SAGA" },
      { property: "og:description", content: "Comparação entre orçado e realizado com decomposição das variações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlanejamentoVariacao,
});
