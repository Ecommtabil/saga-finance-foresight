import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { useSaga } from "@/lib/saga/context";
import { calcularValuation, calcularWACC, margens } from "@/lib/saga/calculations";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";

export const Route = createFileRoute("/simuladores")({
  head: () => ({
    meta: [
      { title: "Simuladores — SAGA" },
      { name: "description", content: "Simule cenários alterando WACC, g, crescimento e margem operacional." },
      { property: "og:title", content: "Simuladores — SAGA" },
      { property: "og:description", content: "Análise de cenários em tempo real." },
    ],
  }),
  component: SimPage,
});

function SimPage() {
  const { dados, empresa } = useSaga();
  const moeda = empresa?.moeda ?? "R$";

  if (!dados) return <><PageHeader titulo="Simuladores" /><EmptyState titulo="Simuladores indisponíveis" /></>;

  const baseWacc = calcularWACC(dados.premissas);
  const baseG = dados.premissas.crescimentoPerp;
  const baseCresc = dados.premissas.crescimentoProj;
  const baseMargem = margens(dados).operacional[4];

  const [wacc, setWacc] = useState(baseWacc);
  const [g, setG] = useState(baseG);
  const [cresc, setCresc] = useState(baseCresc);
  const [margem, setMargem] = useState(baseMargem);

  const base = calcularValuation(dados);
  const sim = calcularValuation(dados, wacc, g, cresc, margem);
  const delta = sim.equity - base.equity;
  const deltaPct = base.equity ? delta / Math.abs(base.equity) : 0;

  return (
    <div className="space-y-6">
      <PageHeader titulo="Simuladores" subtitulo="Ajuste as premissas e veja o impacto no Equity Value em tempo real." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Premissas Simuladas</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <Simu label="WACC" value={wacc} baseValue={baseWacc} min={0.03} max={0.30} step={0.001} onChange={setWacc} format={fmtPct} />
            <Simu label="Crescimento Perpetuidade (g)" value={g} baseValue={baseG} min={0} max={0.08} step={0.001} onChange={setG} format={fmtPct} />
            <Simu label="Crescimento Projetado" value={cresc} baseValue={baseCresc} min={-0.10} max={0.30} step={0.005} onChange={setCresc} format={fmtPct} />
            <Simu label="Margem Operacional" value={margem} baseValue={baseMargem} min={-0.10} max={0.50} step={0.005} onChange={setMargem} format={fmtPct} />
          </CardContent>
        </Card>

        <Card className="border-primary/40">
          <CardHeader><CardTitle>Resultado do Cenário</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Row label="Enterprise Value" v={`${moeda} ${fmtNum(sim.ev)}`} />
            <Row label="Equity Value (Base)" v={`${moeda} ${fmtNum(base.equity)}`} muted />
            <Row label="Equity Value (Simulado)" v={`${moeda} ${fmtNum(sim.equity)}`} strong />
            <div className={`rounded-md border p-4 ${delta >= 0 ? "border-emerald-500/30 bg-emerald-50" : "border-destructive/30 bg-destructive/10"}`}>
              <div className="text-xs uppercase text-muted-foreground">Impacto vs. cenário base</div>
              <div className={`text-2xl font-semibold tabular-nums ${delta >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                {delta >= 0 ? "+" : ""}{fmtNum(delta)} ({fmtPct(deltaPct)})
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Simu({
  label, value, baseValue, min, max, step, onChange, format,
}: {
  label: string; value: number; baseValue: number; min: number; max: number; step: number;
  onChange: (n: number) => void; format: (n: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular-nums text-sm">
          <span className="font-semibold">{format(value)}</span>
          <span className="ml-2 text-xs text-muted-foreground">base {format(baseValue)}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function Row({ label, v, muted, strong }: { label: string; v: string; muted?: boolean; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b pb-2 last:border-0">
      <span className={`text-sm ${muted ? "text-muted-foreground" : ""}`}>{label}</span>
      <span className={`tabular-nums ${strong ? "text-xl font-semibold text-primary" : "text-base"}`}>{v}</span>
    </div>
  );
}