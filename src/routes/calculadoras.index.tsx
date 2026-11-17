import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator } from "lucide-react";

const TITULO = "Calculadoras fiscais | Ecommtabil";
const DESC = "Calculadoras para o escritório: apuração mês a mês do DAS do Simples Nacional, com receita segregada e partilha por tributo.";

export const Route = createFileRoute("/calculadoras/")({
  head: () => ({
    meta: [
      { title: TITULO },
      { name: "description", content: DESC },
      { property: "og:title", content: TITULO },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InicioCalculadoras,
});

function InicioCalculadoras() {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-via-gold">Calculadoras</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-via-ink md:text-3xl">Calculadoras do escritório</h1>
        <p className="mt-2 text-sm text-via-muted md:text-base">Ferramentas de apuração que substituem as planilhas do dia a dia.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <article className="flex flex-col rounded-xl border border-via-border bg-via-surface p-5 shadow-[var(--via-shadow)]">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-via-ink"><Calculator className="h-5 w-5 text-via-gold" /></div>
          <h2 className="mt-4 text-base font-semibold text-via-ink">Cálculo do Simples Nacional</h2>
          <p className="mt-1 flex-1 text-sm text-via-muted">DAS mês a mês por anexo, com receita segregada (ST de ICMS, monofásico e retenção de ISS), RBT12 automático e partilha por tributo.</p>
          <Link to="/calculadoras/simples-nacional" className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-via-ink px-4 py-2 text-sm font-medium text-via-on-ink hover:bg-via-ink/90">
            Abrir calculadora<ArrowRight className="h-4 w-4 text-via-gold" />
          </Link>
        </article>
      </div>
    </div>
  );
}
