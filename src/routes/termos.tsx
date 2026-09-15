import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [{ title: "Termos de Uso — SAGA" }],
  }),
  component: TermosPage,
});

function TermosPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader titulo="Termos de Uso" subtitulo="Rascunho — pendente aprovação jurídica" />
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Este texto é um placeholder. A versão definitiva deve ser revisada e aprovada pelo
            jurídico antes do lançamento em produção (Issue #15).
          </p>
          <p>
            Ver também a <Link to="/privacidade" className="underline">Política de Privacidade</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
