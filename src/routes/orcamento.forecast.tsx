import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/saga/PageHeader";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrcamento } from "@/lib/orcamento/store";
import { gerarForecast, ultimoMesRealizado } from "@/lib/orcamento/engine";
import { MESES, TIPO_LABEL, type MetodoForecast } from "@/lib/orcamento/types";
import { fmtMoney, fmtNum, fmtPctTable } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orcamento/forecast")({ component: ForecastPage });

const METODOS: { v: MetodoForecast; l: string; d: string }[] = [
  { v: "orcado", l: "Manter orçado", d: "Meses restantes seguem exatamente o orçamento aprovado." },
  { v: "runrate", l: "Run-rate", d: "Meses restantes repetem a média mensal já realizada." },
  { v: "tendencia", l: "Tendência", d: "Projeta a reta de tendência dos meses realizados." },
  {
    v: "sazonal",
    l: "Sazonal (orçado ajustado)",
    d: "Mantém a sazonalidade do orçamento, calibrada pelo desempenho realizado até aqui.",
  },
];

function ForecastPage() {
  const { orcamento, atualizarConfig } = useOrcamento();

  if (!orcamento || orcamento.linhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">Importe o orçamento para gerar o forecast.</p>
          <Button asChild>
            <Link to="/orcamento/dados">Ir para Dados & Importação</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const fc = gerarForecast(orcamento);
  const ultimo = ultimoMesRealizado(orcamento.linhas);
  const metodo = METODOS.find((m) => m.v === orcamento.config.metodo)!;
  const chart = fc.porMes.map((p) => ({
    mes: p.mes,
    Orçado: p.orcado,
    Realizado: p.realizado,
    Forecast: p.forecast,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Forecast do ano"
        subtitulo={`Realizado até ${ultimo >= 0 ? MESES[ultimo] : "—"} + previsão dos meses restantes.`}
        action={
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Método</span>
              <Select
                value={orcamento.config.metodo}
                onValueChange={(v) => atualizarConfig({ metodo: v as MetodoForecast })}
              >
                <SelectTrigger className="h-9 w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METODOS.map((m) => (
                    <SelectItem key={m.v} value={m.v}>
                      {m.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Ajuste (%)</span>
              <Input
                type="number"
                className="h-9 w-24"
                value={orcamento.config.ajustePct}
                onChange={(e) => atualizarConfig({ ajustePct: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <InfoTooltip text={metodo.d} /> {metodo.d}
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Receita (forecast ano)", v: fc.totais.receita, o: fc.totais.receitaOrc, rec: true },
          { l: "Custos", v: fc.totais.custo, o: null, rec: false },
          { l: "Despesas", v: fc.totais.despesa, o: null, rec: false },
          { l: "Resultado", v: fc.totais.resultado, o: fc.totais.resultadoOrc, rec: true },
        ].map((k) => (
          <Card key={k.l}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.l}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold tabular-nums">{fmtMoney(k.v)}</p>
              {k.o != null && (
                <p
                  className={cn(
                    "text-xs tabular-nums",
                    (k.v - k.o >= 0) === k.rec ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  vs orçado {fmtNum(k.v - k.o)} ({k.o ? fmtPctTable((k.v - k.o) / Math.abs(k.o)) : "—"})
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Resultado mensal: orçado, realizado e forecast</CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="Orçado"
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Realizado"
                stroke="hsl(var(--primary))"
                dot={false}
                strokeWidth={2.5}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="Forecast"
                stroke="hsl(var(--destructive))"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Forecast por conta</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">Conta</th>
                <th className="p-2 text-left">Tipo</th>
                {MESES.map((m, i) => (
                  <th key={m} className={cn("p-2 text-right", i >= fc.previstoDe && "text-primary")}>
                    {m}
                  </th>
                ))}
                <th className="p-2 text-right">Forecast ano</th>
                <th className="p-2 text-right">vs orçado</th>
              </tr>
            </thead>
            <tbody>
              {fc.linhas.map((l) => (
                <tr key={l.linha.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{l.linha.conta}</td>
                  <td className="p-2 text-muted-foreground">{TIPO_LABEL[l.linha.tipo]}</td>
                  {l.valores.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-2 text-right tabular-nums",
                        i >= fc.previstoDe && "text-primary",
                      )}
                    >
                      {fmtNum(v)}
                    </td>
                  ))}
                  <td className="p-2 text-right font-medium tabular-nums">
                    {fmtNum(l.totalForecast)}
                  </td>
                  <td
                    className={cn(
                      "p-2 text-right tabular-nums",
                      (l.desvio >= 0) === (l.linha.tipo === "receita" || l.linha.tipo === "outros")
                        ? "text-emerald-600"
                        : "text-destructive",
                    )}
                  >
                    {l.desvioPct == null ? fmtNum(l.desvio) : fmtPctTable(l.desvioPct)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
