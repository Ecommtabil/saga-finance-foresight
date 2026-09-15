import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [{ title: "Política de Privacidade — SAGA" }],
  }),
  component: PrivacidadePage,
});

function PrivacidadePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        titulo="Política de Privacidade"
        subtitulo="Rascunho — pendente aprovação jurídica"
      />
      <Card>
        <CardHeader>
          <CardTitle>Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Placeholder LGPD. Dados financeiros de clientes e arquivos enviados ao ETL devem ser
            tratados conforme política aprovada pelo jurídico (Issue #15).
          </p>
          <p>
            Ver também os <Link to="/termos" className="underline">Termos de Uso</Link>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
