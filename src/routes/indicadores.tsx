import { createFileRoute } from "@tanstack/react-router";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { useSaga } from "@/lib/saga/context";
import {
  margens,
  indicadoresLiquidez,
  indicadoresEndividamento,
  indicadoresRentabilidade,
  cicloCaixa,
  crescimento,
} from "@/lib/saga/calculations";
import { fmtPct, fmtMult } from "@/lib/saga/formatters";

export const Route = createFileRoute("/indicadores")({
  head: () => ({
    meta: [
      { title: "Indicadores — SAGA" },
      { name: "description", content: "Painel de indicadores financeiros: liquidez, endividamento, rentabilidade." },
      { property: "og:title", content: "Indicadores — SAGA" },
      { property: "og:description", content: "Evolução dos principais indicadores em 5 anos." },
    ],
  }),
  component: IndicadoresPage,
});

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{valor}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  titulo,
  anos,
  series,
  pct,
}: {
  titulo: string;
  anos: number[];
  series: { name: string; data: number[]; color: string }[];
  pct?: boolean;
}) {
  const data = anos.map((a, i) => {
    const row: Record<string, number> = { ano: a };
    series.forEach((s) => (row[s.name] = pct ? s.data[i] * 100 : s.data[i]));
    return row;
  });
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="ano" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickFormatter={(v: number) => (pct ? `${v.toFixed(0)}%` : v.toFixed(1))}
              />
              <Tooltip formatter={(v: number) => (pct ? `${v.toFixed(1)}%` : v.toFixed(2))} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {series.map((s) => (
                <Line key={s.name} type="monotone" dataKey={s.name} stroke={s.color} strokeWidth={2} dot />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function IndicadoresPage() {
  const { dados, modo } = useSaga();
  if (!dados) return <><PageHeader titulo="Indicadores" /><EmptyState titulo="Indicadores indisponíveis" /></>;

  const m = margens(dados);
  const liq = indicadoresLiquidez(dados);
  const end = indicadoresEndividamento(dados);
  const rent = indicadoresRentabilidade(dados);
  const ciclo = cicloCaixa(dados);
  const cresc = crescimento(dados);
  const last = 4;

  return (
    <div className="space-y-6">
      <PageHeader titulo="Indicadores Financeiros" subtitulo="Ano base + evolução em 5 anos." />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi titulo="Margem Líquida" valor={fmtPct(m.liquida[last])} sub="Ano base" />
        <Kpi titulo="ROE" valor={fmtPct(rent.roe[last])} sub="Ano base" />
        <Kpi titulo="CAGR Receita" valor={fmtPct(cresc.cagrReceita)} sub={`${dados.anos[0]}–${dados.anos[4]}`} />
        <Kpi titulo="CAGR Lucro" valor={fmtPct(cresc.cagrLucro)} sub={`${dados.anos[0]}–${dados.anos[4]}`} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard
          titulo="Rentabilidade (%)"
          anos={dados.anos}
          pct
          series={[
            { name: "M. Bruta", data: m.bruta, color: "var(--chart-1)" },
            { name: "M. EBITDA", data: m.ebitda, color: "var(--chart-2)" },
            { name: "M. Líquida", data: m.liquida, color: "var(--chart-3)" },
          ]}
        />
        <ChartCard
          titulo="Retornos (%)"
          anos={dados.anos}
          pct
          series={[
            { name: "ROE", data: rent.roe, color: "var(--chart-1)" },
            { name: "ROA", data: rent.roa, color: "var(--chart-2)" },
            { name: "ROIC", data: rent.roic, color: "var(--chart-4)" },
          ]}
        />
        {modo === "completa" && liq && (
          <ChartCard
            titulo="Liquidez (x)"
            anos={dados.anos}
            series={[
              { name: "Corrente", data: liq.corrente, color: "var(--chart-1)" },
              { name: "Seca", data: liq.seca, color: "var(--chart-2)" },
              { name: "Imediata", data: liq.imediata, color: "var(--chart-4)" },
            ]}
          />
        )}
        {modo === "completa" && end && (
          <ChartCard
            titulo="Endividamento"
            anos={dados.anos}
            series={[
              { name: "Dívida/PL", data: end.dividaSobrePL, color: "var(--chart-1)" },
              { name: "Dívida/Ativo", data: end.dividaSobreAtivo, color: "var(--chart-2)" },
            ]}
          />
        )}
        <ChartCard
          titulo="Crescimento YoY (%)"
          anos={dados.anos}
          pct
          series={[
            { name: "Receita", data: cresc.receitaYoY, color: "var(--chart-1)" },
            { name: "Lucro", data: cresc.lucroYoY, color: "var(--chart-3)" },
          ]}
        />
        {modo === "completa" && ciclo && (
          <ChartCard
            titulo="Ciclo de Caixa (dias)"
            anos={dados.anos}
            series={[
              { name: "PMR", data: ciclo.pmr, color: "var(--chart-1)" },
              { name: "PME", data: ciclo.pme, color: "var(--chart-2)" },
              { name: "PMP", data: ciclo.pmp, color: "var(--chart-4)" },
              { name: "Ciclo Fin.", data: ciclo.cicloFinanceiro, color: "var(--chart-3)" },
            ]}
          />
        )}
      </div>

      {modo === "completa" && liq && end && (
        <div className="grid gap-3 md:grid-cols-4">
          <Kpi titulo="Liquidez Corrente" valor={fmtMult(liq.corrente[last])} />
          <Kpi titulo="Dívida / PL" valor={fmtMult(end.dividaSobrePL[last])} />
          <Kpi titulo="Cobertura de Juros" valor={fmtMult(end.coberturaJuros[last])} />
          {ciclo && <Kpi titulo="Ciclo Financeiro" valor={`${ciclo.cicloFinanceiro[last].toFixed(0)} dias`} />}
        </div>
      )}
    </div>
  );
}