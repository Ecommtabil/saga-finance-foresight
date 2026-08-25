import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
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
import { useOrcamento } from "@/lib/orcamento/store";
import { gerarRolling } from "@/lib/orcamento/engine";
import { fmtMoney, fmtNum, fmtPctTable } from "@/lib/saga/formatters";

export const Route = createFileRoute("/orcamento/rolling")({ component: RollingPage });

function RollingPage() {
  const { orcamento, atualizarConfig } = useOrcamento();

  if (!orcamento || orcamento.linhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Importe o orçamento para montar o rolling forecast.
          </p>
          <Button asChild>
            <Link to="/orcamento/dados">Ir para Dados & Importação</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const rf = gerarRolling(orcamento);
  const chart = rf.pontos.map((p) => ({
    mes: p.rotulo,
    Receita: p.receita,
    Resultado: p.resultado,
  }));
  const margem = rf.totais.receita ? rf.totais.resultado / rf.totais.receita : null;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Rolling Forecast"
        subtitulo={`Janela contínua a partir de ${rf.ancora}, atravessando a virada de ano.`}
        action={
          <div className="flex items-end gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Janela (meses)</span>
              <Input
                type="number"
                min={1}
                max={36}
                className="h-9 w-24"
                value={orcamento.config.janelaRolling}
                onChange={(e) => atualizarConfig({ janelaRolling: Number(e.target.value) || 12 })}
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Crescimento a.a. (%)</span>
              <Input
                type="number"
                className="h-9 w-32"
                value={orcamento.config.crescimentoRollingPct}
                onChange={(e) =>
                  atualizarConfig({ crescimentoRollingPct: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <InfoTooltip text="O rolling forecast avança a cada fechamento: sempre projeta os próximos N meses a partir do último mês realizado, em vez de parar em dezembro." />
        Projeção contínua dos próximos {rf.pontos.length} meses, recalculada automaticamente conforme
        novos meses realizados são lançados.
      </p>

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Receita projetada", v: fmtMoney(rf.totais.receita) },
          { l: "Custos", v: fmtMoney(rf.totais.custo) },
          { l: "Despesas", v: fmtMoney(rf.totais.despesa) },
          { l: "Resultado", v: fmtMoney(rf.totais.resultado) },
        ].map((k) => (
          <Card key={k.l}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">{k.l}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold tabular-nums">{k.v}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Receita e resultado projetados{margem != null && ` — margem média ${fmtPctTable(margem)}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chart} margin={{ left: 4, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="gRoll" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Receita"
                stroke="hsl(var(--primary))"
                fill="url(#gRoll)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="Resultado"
                stroke="hsl(var(--destructive))"
                dot={false}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento mês a mês</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">Mês</th>
                <th className="p-2 text-right">Receita</th>
                <th className="p-2 text-right">Custos</th>
                <th className="p-2 text-right">Despesas</th>
                <th className="p-2 text-right">Resultado</th>
                <th className="p-2 text-right">Margem</th>
                <th className="p-2 text-left">Origem</th>
              </tr>
            </thead>
            <tbody>
              {rf.pontos.map((p) => (
                <tr key={p.rotulo} className="border-t">
                  <td className="p-2">{p.rotulo}</td>
                  <td className="p-2 text-right tabular-nums">{fmtNum(p.receita)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtNum(p.custo)}</td>
                  <td className="p-2 text-right tabular-nums">{fmtNum(p.despesa)}</td>
                  <td className="p-2 text-right font-medium tabular-nums">{fmtNum(p.resultado)}</td>
                  <td className="p-2 text-right tabular-nums">
                    {p.receita ? fmtPctTable(p.resultado / p.receita) : "—"}
                  </td>
                  <td className="p-2 text-muted-foreground">
                    {p.origem === "rolling" ? "Extensão (ano seguinte)" : "Forecast"}
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
