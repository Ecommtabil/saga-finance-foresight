import { createFileRoute } from "@tanstack/react-router";
import { formatBRL, formatPct } from "@/lib/finance";
import { LISTA_ESTUDOS } from "@/lib/viabilidade/estudos";
import { Demonstrativo } from "@/components/viabilidade/Demonstrativo";
import { Bloco, KpiCard, ParecerCard } from "@/components/viabilidade/ui";
import { calcularNovaLinha, PADRAO_NOVA_LINHA } from "@/lib/viabilidade/nova-linha";
import { calcularComprarAlugar, PADRAO_COMPRAR_ALUGAR } from "@/lib/viabilidade/comprar-alugar";
import { calcularMaquina, PADRAO_MAQUINA } from "@/lib/viabilidade/maquina-leasing";
import { calcularEquipe, PADRAO_EQUIPE } from "@/lib/viabilidade/equipe-terceirizar";

export const Route = createFileRoute("/viabilidade/debug")({
  head: () => ({
    meta: [
      { title: "Conferência dos cálculos — Viabilidade" },
      { name: "description", content: "Página interna de conferência dos estudos de viabilidade com premissas padrão." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Conferência dos cálculos — Viabilidade" },
      { property: "og:description", content: "Tabelas dos estudos com as premissas padrão." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DebugPage,
});

function conferencias() {
  const n = calcularNovaLinha(PADRAO_NOVA_LINHA);
  const c = calcularComprarAlugar(PADRAO_COMPRAR_ALUGAR);
  const m = calcularMaquina(PADRAO_MAQUINA);
  const e = calcularEquipe(PADRAO_EQUIPE);
  const r = (rot: string, v: number, esp: number, pct = false) => ({ rot, v, esp, ok: pct ? Math.abs(v - esp) <= 0.001 : Math.abs(v - esp) <= 1, pct });
  return [
    r("Nova Linha — VPL", n.vpl, 207000.51), r("Nova Linha — TIR", n.tir ?? NaN, 0.351, true), r("Nova Linha — Lucro Líquido Ano 1", n.lucroLiquido[1], 84480),
    r("Comprar — VPL Comprar", c.vplComprar, -392205.93), r("Comprar — VPL Alugar", c.vplAlugar, -249641.63), r("Comprar — VPL Incremental", c.vplIncremental, -142564.3),
    r("Máquina — VPL Compra", m.vplCompra, -154758.3), r("Máquina — CAUE Compra", m.caueCompra, -42931.46), r("Máquina — VPL Leasing", m.vplLeasing, -119909.28), r("Máquina — CAUE Leasing", m.caueLeasing, -33264),
    r("Equipe — Fluxo interno Ano 1", e.fluxoInterno[1], -344799.16), r("Equipe — Fluxo terceirizado Ano 1", e.fluxoTerc[1], -300960), r("Equipe — VPL Interno", e.vplInterno, -1380777), r("Equipe — VPL Terceirizado", e.vplTerc, -1185797.73),
  ];
}

function DebugPage() {
  const linhas = conferencias();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-via-ink">Conferência dos cálculos</h1>
        <p className="text-sm text-via-muted">Premissas padrão de cada estudo · tolerância de R$ 1,00 e 0,1 p.p.</p>
      </div>
      <Bloco titulo="Valores de referência">
        <div className="overflow-x-auto">
          <table className="via-table">
            <thead><tr><th>Conferência</th><th>Calculado</th><th>Esperado</th><th>Status</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.rot}>
                  <td>{l.rot}</td>
                  <td>{l.pct ? formatPct(l.v, 2) : formatBRL(l.v)}</td>
                  <td>{l.pct ? formatPct(l.esp, 1) : formatBRL(l.esp)}</td>
                  <td className={l.ok ? "font-semibold text-via-good" : "font-semibold text-via-bad"}>{l.ok ? "OK" : "DIVERGENTE"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Bloco>
      {LISTA_ESTUDOS.map((e) => {
        const rel = e.relatorio(e.padrao as never);
        return (
          <Bloco key={e.id} titulo={e.titulo}>
            <Demonstrativo relatorio={rel} />
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{rel.kpis.map((k) => <KpiCard key={k.id} kpi={k} />)}</div>
            <div className="mt-4"><ParecerCard parecer={rel.parecer} /></div>
          </Bloco>
        );
      })}
    </div>
  );
}
