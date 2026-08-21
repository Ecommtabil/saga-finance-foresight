import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";

export const Route = createFileRoute("/modelagem-simplificada")({
  head: () => ({
    meta: [
      { title: "Modelagem Simplificada — SAGA" },
      {
        name: "description",
        content:
          "Modelagem financeira simplificada para empresas com dados básicos, sem contabilidade completa.",
      },
      { property: "og:title", content: "Modelagem Simplificada — SAGA" },
      {
        property: "og:description",
        content: "Projeções rápidas a partir de poucos dados essenciais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelagemSimplificadaPage,
});

function ModelagemSimplificadaPage() {
  return (
    <>
      <PageHeader
        titulo="Modelagem Simplificada"
        subtitulo="Módulo em construção: modelagem rápida com poucos dados de entrada."
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Em breve</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Este espaço vai reunir as análises simplificadas (projeções rápidas a partir
          de receita, margens e capital de giro). Me diga quais telas você quer aqui e
          eu monto cada uma.
        </CardContent>
      </Card>
    </>
  );
}
