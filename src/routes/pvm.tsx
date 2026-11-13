import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, Database, FileUp, LayoutDashboard, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePVM } from "@/lib/analise-pvm/store";
import { ImportarPVM } from "@/components/pvm/ImportarPVM";
import { DashboardPVM } from "@/components/pvm/DashboardPVM";
import { BasePVM } from "@/components/pvm/BasePVM";

export const Route = createFileRoute("/pvm")({
  head: () => ({
    meta: [
      { title: "Análise PVM — Preço, Volume e Mix | SAGA" },
      { name: "description", content: "Explique a variação da receita entre períodos pelos efeitos de Preço, Volume e Mix, a partir de uma planilha Excel." },
      { property: "og:title", content: "Análise PVM — Preço, Volume e Mix | SAGA" },
      { property: "og:description", content: "Cascata da receita, efeitos por unidade, categoria e produto e leitura automática da variação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PvmPage,
});

type Aba = "importar" | "dashboard" | "base";

function PvmPage() {
  const { registros, cliente, setCliente } = usePVM();
  const [aba, setAba] = useState<Aba>("importar");
  const [pronto, setPronto] = useState(false);
  useEffect(() => {
    void Promise.resolve(usePVM.persist.rehydrate()).then(() => {
      setPronto(true);
      if (usePVM.getState().registros.length) setAba("dashboard");
    });
  }, []);
  const temDados = registros.length > 0;
  const abas: Array<{ id: Aba; nome: string; icone: typeof FileUp; desabilitada?: boolean }> = [
    { id: "importar", nome: "Importar dados", icone: FileUp },
    { id: "dashboard", nome: "Dashboard PVM", icone: LayoutDashboard, desabilitada: !temDados },
    { id: "base", nome: "Base de dados", icone: Database, desabilitada: !temDados },
  ];
  return (
    <div className="vol-tool pvm-tool min-h-full min-w-0 bg-vol-paper font-[Inter,system-ui,sans-serif] text-vol-text">
      <header className="sticky top-0 z-20 bg-vol-ink px-4 py-3 text-vol-on-ink shadow-[var(--vol-shadow)] md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-vol-gold"><TrendingUp className="h-5 w-5 text-vol-ink" /></div>
            <div>
              <h1 className="text-base font-bold md:text-lg">Análise PVM <span className="text-vol-gold">— Preço, Volume e Mix</span></h1>
              <p className="text-xs text-vol-on-ink/70">Variação da receita entre períodos</p>
            </div>
          </div>
          <div className="relative w-full md:w-72">
            <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vol-ink/50" />
            <Input aria-label="Cliente / Empresa" placeholder="Cliente / Empresa" value={cliente} onChange={e => setCliente(e.target.value)} className="h-9 border-vol-on-ink/20 bg-vol-on-ink pl-9 text-vol-ink placeholder:text-vol-ink/40" />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <nav role="tablist" aria-label="Telas da Análise PVM" className="flex gap-2 overflow-x-auto rounded-2xl border border-vol-border bg-vol-surface p-2 shadow-[var(--vol-shadow)]">
          {abas.map(({ id, nome, icone: Icone, desabilitada }) => (
            <Button key={id} role="tab" aria-selected={aba === id} variant="ghost" disabled={desabilitada} onClick={() => setAba(id)} title={desabilitada ? "Importe dados para liberar" : undefined}
              className={`h-auto min-w-fit flex-1 gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${aba === id ? "bg-vol-ink text-vol-on-ink hover:bg-vol-ink hover:text-vol-on-ink" : "text-vol-muted hover:bg-vol-ink/5 hover:text-vol-text"}`}>
              <Icone className={`h-4 w-4 ${aba === id ? "text-vol-gold" : ""}`} />{nome}
            </Button>
          ))}
        </nav>
        {pronto && (aba === "importar" || !temDados) && <ImportarPVM onConfirmado={() => setAba("dashboard")} />}
        {pronto && aba === "dashboard" && temDados && <DashboardPVM registros={registros} />}
        {pronto && aba === "base" && temDados && <BasePVM registros={registros} />}
      </div>
    </div>
  );
}
