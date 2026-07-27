import { createFileRoute } from "@tanstack/react-router";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { useSaga } from "@/lib/saga/context";
import { calcularValuation, sensibilidade } from "@/lib/saga/calculations";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/valuation")({
  head: () => ({
    meta: [
      { title: "Valuation DCF — SAGA" },
      { name: "description", content: "Fluxo de caixa descontado: FCFF, WACC, VT, EV e Equity Value." },
      { property: "og:title", content: "Valuation DCF — SAGA" },
      { property: "og:description", content: "Valuation por FCD com tabela de sensibilidade WACC × g." },
    ],
  }),
  component: ValuationPage,
});

function ValuationPage() {
  const { dados, empresa } = useSaga();
  if (!dados) return <><PageHeader titulo="Valuation (DCF)" /><EmptyState titulo="Valuation indisponível" /></>;
  const v = calcularValuation(dados);
  const sens = sensibilidade(dados);
  const moeda = empresa?.moeda ?? "R$";

  const bridge = [
    { name: "VP FCFF", value: v.vpSum, color: "var(--chart-1)" },
    { name: "VP Valor Terminal", value: v.vpVt, color: "var(--chart-2)" },
    { name: "Enterprise Value", value: v.ev, color: "var(--primary)" },
    { name: "(+) Caixa", value: v.caixa, color: "var(--chart-4)" },
    { name: "(-) Dívida", value: -v.divida, color: "var(--chart-3)" },
    { name: "Equity Value", value: v.equity, color: "var(--accent)" },
  ];

  // valores min/max para escala do heatmap
  const flat = sens.matriz.flat();
  const minV = Math.min(...flat);
  const maxV = Math.max(...flat);

  return (
    <div className="space-y-6">
      <PageHeader titulo="Valuation (DCF)" subtitulo="Fluxo de caixa livre para a firma, descontado ao WACC." />

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="WACC" v={fmtPct(v.wacc)} />
        <Metric label="g (perpetuidade)" v={fmtPct(v.g)} />
        <Metric label="Enterprise Value" v={`${moeda} ${fmtNum(v.ev)}`} highlight />
        <Metric label="Equity Value" v={`${moeda} ${fmtNum(v.equity)}`} highlight />
      </div>

      <Card>
        <CardHeader><CardTitle>FCFF Projetado</CardTitle></CardHeader>
        <CardContent>
          <FinancialTable
            anos={v.anos}
            moeda={moeda}
            rows={[
              { label: "FCFF", values: v.fcff, bold: true },
              { label: "Valor Presente", values: v.vp, indent: true },
            ]}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Ponte EV → Equity Value</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bridge} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
                <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(x: number) => fmtNum(x)} />
                <Tooltip formatter={(x: number) => fmtNum(x)} />
                <Bar dataKey="value">
                  {bridge.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sensibilidade — Equity Value (WACC × g)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-muted-foreground">WACC ↓ / g →</th>
                {sens.gs.map((g) => (
                  <th key={g} className="p-2 text-right text-muted-foreground">{fmtPct(g)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sens.waccs.map((w, i) => (
                <tr key={w} className="border-t">
                  <td className="p-2 font-medium">{fmtPct(w)}</td>
                  {sens.matriz[i].map((val, j) => {
                    const t = maxV === minV ? 0.5 : (val - minV) / (maxV - minV);
                    return (
                      <td
                        key={j}
                        className={cn("p-2 text-right tabular-nums")}
                        style={{ backgroundColor: `color-mix(in oklab, var(--accent) ${Math.round(t * 60)}%, transparent)` }}
                      >
                        {fmtNum(val)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, v, highlight }: { label: string; v: string; highlight?: boolean }) {
  return (
    <Card className={highlight ? "border-primary/50" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tabular-nums", highlight && "text-primary")}>{v}</div>
      </CardContent>
    </Card>
  );
}