import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Building2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmpresaForm } from "@/components/simples/EmpresaForm";
import { useSimples } from "@/lib/simples/store";
import { calcularEmpresa } from "@/lib/simples/calculo";
import { tabelaParaAno } from "@/lib/simples/tabelas";
import { brl } from "@/lib/simples/formato";

const TITULO = "Cálculo do Simples Nacional — Empresas | Ecommtabil";
const DESC = "Cadastre as empresas do Simples Nacional e calcule o DAS mês a mês por anexo, com RBT12 automático e partilha por tributo.";

export const Route = createFileRoute("/calculadoras/simples-nacional/")({
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
  component: EmpresasSimples,
});

function EmpresasSimples() {
  const { empresas, criarEmpresa, excluirEmpresa, tabelasPorAno } = useSimples();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [excluir, setExcluir] = useState<string | null>(null);
  const lista = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return empresas.filter((e) => !b || e.razaoSocial.toLowerCase().includes(b) || e.cnpj.replace(/\D/g, "").includes(b.replace(/\D/g, "") || "§"));
  }, [empresas, busca]);
  const alvo = empresas.find((e) => e.id === excluir);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-wider text-via-gold">Cálculo do Simples Nacional</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-via-ink md:text-3xl">Empresas</h1>
          <p className="mt-1 text-sm text-via-muted">Cada empresa tem um ano-calendário e os anexos em que atua. Abra uma empresa para lançar as receitas e ver o DAS.</p>
        </div>
        <Button onClick={() => setNovo(true)} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90"><Plus className="h-4 w-4 text-via-gold" />Nova empresa</Button>
      </div>
      {empresas.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-via-muted" />
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por razão social ou CNPJ" className="pl-9" aria-label="Buscar empresa" />
        </div>
      )}
      {empresas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-via-border bg-via-surface p-10 text-center">
          <Building2 className="mx-auto h-10 w-10 text-via-gold" />
          <h2 className="mt-3 text-lg font-semibold text-via-ink">Nenhuma empresa cadastrada</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-via-muted">Cadastre a primeira empresa com razão social, CNPJ, ano-calendário e anexos.</p>
          <Button onClick={() => setNovo(true)} className="mt-5 bg-via-ink text-via-on-ink hover:bg-via-ink/90"><Plus className="h-4 w-4 text-via-gold" />Cadastrar empresa</Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((e) => {
            const r = calcularEmpresa(e, tabelaParaAno(tabelasPorAno, e.ano).tabelas);
            return (
              <article key={e.id} className="flex flex-col rounded-xl border border-via-border bg-via-surface p-5 shadow-[var(--via-shadow)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-via-ink" title={e.razaoSocial}>{e.razaoSocial}</h2>
                    <p className="text-xs text-via-muted">{e.cnpj || "CNPJ não informado"} · Ano {e.ano}</p>
                  </div>
                  <button type="button" onClick={() => setExcluir(e.id)} aria-label={`Excluir ${e.razaoSocial}`} className="rounded-md p-1.5 text-via-muted hover:bg-via-paper hover:text-via-bad"><Trash2 className="h-4 w-4" /></button>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {e.anexos.map((a) => <span key={a} className="rounded bg-via-paper px-2 py-0.5 text-[11px] font-medium text-via-ink">Anexo {a}</span>)}
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-[11px] text-via-muted">Faturamento no ano</dt><dd className="font-semibold tabular-nums text-via-ink">{brl(r.consolidado.faturamento)}</dd></div>
                  <div><dt className="text-[11px] text-via-muted">DAS no ano</dt><dd className="font-semibold tabular-nums text-via-ink">{brl(r.consolidado.das)}</dd></div>
                </dl>
                <Link to="/calculadoras/simples-nacional/$empresaId" params={{ empresaId: e.id }} className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-via-ink px-4 py-2 text-sm font-medium text-via-on-ink hover:bg-via-ink/90">
                  Abrir empresa<ArrowRight className="h-4 w-4 text-via-gold" />
                </Link>
              </article>
            );
          })}
          {lista.length === 0 && <p className="text-sm text-via-muted">Nenhuma empresa encontrada para “{busca}”.</p>}
        </div>
      )}
      <EmpresaForm aberto={novo} onFechar={() => setNovo(false)} titulo="Nova empresa" onSalvar={(d) => {
        const id = criarEmpresa(d);
        setNovo(false);
        void navigate({ to: "/calculadoras/simples-nacional/$empresaId", params: { empresaId: id } });
      }} />
      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir empresa?</AlertDialogTitle>
            <AlertDialogDescription>“{alvo?.razaoSocial}” e todas as receitas lançadas serão apagadas deste projeto.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (excluir) excluirEmpresa(excluir); setExcluir(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
