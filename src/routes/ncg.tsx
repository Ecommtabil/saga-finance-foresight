import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, ClipboardList, Calculator, LayoutDashboard, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { PremissasForm } from "@/components/ncg/PremissasForm";
import { PREMISSAS_VAZIAS, type PremissasNCG } from "@/lib/ncg/premissas";
import { Button } from "@/components/ui/button";
import { MemorialNCG } from "@/components/ncg/MemorialNCG";
import { DashboardNCG } from "@/components/ncg/DashboardNCG";
import { resultadoDasPremissas } from "@/lib/ncg/apresentacao";
import { diasDoPeriodo } from "@/lib/ncg/premissas";

export const Route = createFileRoute("/ncg")({
  head: () => ({
    meta: [
      { title: "Calculadora de NCG – Simplificada | SAGA" },
      {
        name: "description",
        content:
          "Calculadora simplificada de Necessidade de Capital de Giro (NCG) para PMEs: premissas, cálculo, dashboard e simulações.",
      },
      { property: "og:title", content: "Calculadora de NCG – Simplificada | SAGA" },
      {
        property: "og:description",
        content: "Calcule a Necessidade de Capital de Giro de empresas clientes de forma simples e visual.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NcgPage,
});

type Aba = "premissas" | "calculo" | "dashboard" | "simulacoes";

const ABAS: { id: Aba; rotulo: string; icone: typeof ClipboardList }[] = [
  { id: "premissas", rotulo: "1. Premissas", icone: ClipboardList },
  { id: "calculo", rotulo: "2. Cálculo da NCG", icone: Calculator },
  { id: "dashboard", rotulo: "3. Dashboard", icone: LayoutDashboard },
  { id: "simulacoes", rotulo: "4. Simulações", icone: SlidersHorizontal },
];

function PlaceholderAba({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="rounded-2xl bg-white p-8 shadow-[0_2px_12px_rgba(31,58,95,0.08)]">
      <h2 className="text-lg font-semibold text-[#1F3A5F]">{titulo}</h2>
      <p className="mt-2 text-sm text-[#1F3A5F]/70">{descricao}</p>
      <div className="mt-6 flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-[#1F3A5F]/15 text-sm text-[#1F3A5F]/50">
        Os campos e cálculos desta etapa serão adicionados nos próximos passos.
      </div>
    </div>
  );
}

function NcgPage() {
  const [aba, setAba] = useState<Aba>("premissas");
  const [empresa, setEmpresa] = usePersistedState<string>("saga.ncg.empresa", "");
  const [cnpj, setCnpj] = usePersistedState<string>("saga.ncg.cnpj", "");
  const [premissas, setPremissas] = usePersistedState<PremissasNCG>(
    "saga.ncg.premissas",
    PREMISSAS_VAZIAS
  );
  const resultado = resultadoDasPremissas(premissas);
  const periodoValido = diasDoPeriodo(premissas) > 0;

  return (
    <div className="ncg-tool min-h-full min-w-0 bg-ncg-paper p-4 font-[Inter,system-ui,sans-serif] md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="rounded-2xl bg-[#1F3A5F] p-6 shadow-[0_4px_20px_rgba(31,58,95,0.25)] md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C9A227]">
                  <Calculator className="h-6 w-6 text-[#1F3A5F]" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white md:text-2xl">
                    Calculadora de NCG <span className="text-[#C9A227]">– Simplificada</span>
                  </h1>
                  <p className="text-sm text-white/70">
                    Necessidade de Capital de Giro para empresas clientes
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="min-w-[220px]">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-white/60">
                  Empresa analisada
                </label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1F3A5F]/50" />
                  <Input
                    value={empresa}
                    onChange={(e) => setEmpresa(e.target.value)}
                    placeholder="Nome da empresa"
                    className="border-white/20 bg-white pl-9 text-[#1F3A5F] placeholder:text-[#1F3A5F]/40 focus-visible:ring-[#C9A227]"
                  />
                </div>
              </div>
              <div className="min-w-[180px]">
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-white/60">
                  CNPJ (opcional)
                </label>
                <Input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  className="border-white/20 bg-white text-[#1F3A5F] placeholder:text-[#1F3A5F]/40 focus-visible:ring-[#C9A227]"
                />
              </div>
            </div>
          </div>
        </header>

        {/* Navegação em abas */}
        <nav className="flex gap-2 overflow-x-auto rounded-2xl bg-white p-2 shadow-[0_2px_12px_rgba(31,58,95,0.08)]">
          {ABAS.map(({ id, rotulo, icone: Icone }) => {
            const ativa = aba === id;
            return (
              <Button
                key={id}
                variant="ghost"
                role="tab"
                aria-selected={ativa}
                aria-label={rotulo}
                onClick={() => setAba(id)}
                className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  ativa
                    ? "bg-[#1F3A5F] text-white shadow-[0_2px_8px_rgba(31,58,95,0.3)]"
                    : "text-[#1F3A5F]/70 hover:bg-[#1F3A5F]/5 hover:text-[#1F3A5F]"
                }`}
              >
                <Icone className={`h-4 w-4 ${ativa ? "text-[#C9A227]" : ""}`} />
                <span className="hidden sm:inline">{rotulo}</span>
                <span className="sm:hidden">{rotulo.split(". ")[0]}</span>
              </Button>
            );
          })}
        </nav>

        {/* Conteúdo das abas */}
        {aba === "premissas" && (
          <PremissasForm premissas={premissas} onChange={setPremissas} />
        )}
        {(aba === "calculo" || aba === "dashboard") && !periodoValido && <div className="border-l-4 border-ncg-gold bg-ncg-gold/10 p-5 text-ncg-ink"><p>Informe um período válido nas Premissas para visualizar os resultados.</p><Button variant="outline" className="mt-3" onClick={() => setAba("premissas")}>1. Premissas</Button></div>}
        {aba === "calculo" && periodoValido && <MemorialNCG premissas={premissas} resultado={resultado}/>}
        {aba === "dashboard" && periodoValido && <DashboardNCG premissas={premissas} resultado={resultado}/>}
        {aba === "simulacoes" && (
          <PlaceholderAba
            titulo="Simulações"
            descricao="Cenários what-if: ajuste prazos e premissas para ver o impacto na Necessidade de Capital de Giro."
          />
        )}
      </div>
    </div>
  );
}
