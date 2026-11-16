import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { NAV_VIABILIDADE } from "@/components/viabilidade/nav";

export const Route = createFileRoute("/viabilidade")({
  component: ViabilidadeLayout,
});

function ViabilidadeLayout() {
  return (
    <div className="via-tool min-h-full min-w-0 bg-via-paper font-[Inter,system-ui,sans-serif] text-via-text">
      <header className="border-b border-via-border bg-via-ink px-4 text-via-on-ink md:px-8">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-2 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight text-via-gold">Ecommtabil</span>
            <span className="text-sm text-via-on-ink/80">Análise de Viabilidade</span>
          </div>
          <nav aria-label="Estudos de viabilidade" className="-mx-1 flex gap-1 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
            {NAV_VIABILIDADE.map((i) => (
              <Link key={i.url} to={i.url} activeOptions={{ exact: true }}
                className="flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-via-on-ink/75 transition-colors hover:bg-via-on-ink/10 hover:text-via-on-ink data-[status=active]:bg-via-on-ink/15 data-[status=active]:text-via-gold">
                <i.icon className="h-3.5 w-3.5" />{i.curto}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-[1500px] p-4 md:p-8">
        <Outlet />
      </main>
    </div>
  );
}
