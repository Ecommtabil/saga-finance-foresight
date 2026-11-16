import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FolderOpen } from "lucide-react";
import { LISTA_ESTUDOS } from "@/lib/viabilidade/estudos";
import { ICONE_ESTUDO } from "@/components/viabilidade/nav";

export const Route = createFileRoute("/viabilidade/")({
  head: () => ({
    meta: [
      { title: "Estudos de Viabilidade Técnica e Econômica | Ecommtabil" },
      { name: "description", content: "Analise decisões de investimento de clientes PME: nova linha de produtos, comprar ou alugar, compra vs leasing e equipe interna vs terceirização." },
      { property: "og:title", content: "Estudos de Viabilidade Técnica e Econômica | Ecommtabil" },
      { property: "og:description", content: "Analise decisões de investimento de clientes PME: nova linha de produtos, comprar ou alugar, compra vs leasing e equipe interna vs terceirização." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InicioViabilidade,
});

function InicioViabilidade() {
  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-via-gold">Análise de Viabilidade</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-via-ink md:text-3xl">Estudos de Viabilidade Técnica e Econômica</h1>
        <p className="mt-2 text-sm text-via-muted md:text-base">Compare alternativas de investimento dos seus clientes com fluxos de caixa, VPL, TIR, payback e CAUE, e entregue um parecer pronto em PDF.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {LISTA_ESTUDOS.map((e) => {
          const Icone = ICONE_ESTUDO[e.id];
          return (
            <article key={e.id} className="flex flex-col rounded-xl border border-via-border bg-via-surface p-5 shadow-[var(--via-shadow)] transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-via-ink"><Icone className="h-5 w-5 text-via-gold" /></div>
              <h2 className="mt-4 text-base font-semibold text-via-ink">{e.titulo}</h2>
              <p className="mt-1 flex-1 text-sm text-via-muted">{e.descricao}</p>
              <p className="mt-3 inline-flex w-fit rounded-md bg-via-paper px-2 py-1 text-[11px] font-medium text-via-ink">{e.tipoAnalise}</p>
              <Link to={e.rota} className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-via-ink px-4 py-2 text-sm font-medium text-via-on-ink transition-colors hover:bg-via-ink/90">
                Abrir estudo<ArrowRight className="h-4 w-4 text-via-gold" />
              </Link>
            </article>
          );
        })}
      </div>
      <Link to="/viabilidade/cenarios" className="inline-flex items-center gap-2 text-sm font-medium text-via-ink underline-offset-4 hover:underline">
        <FolderOpen className="h-4 w-4 text-via-gold" />Ver meus cenários salvos e comparar
      </Link>
    </div>
  );
}
