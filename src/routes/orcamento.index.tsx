import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/saga/PageHeader";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAnalises, useOrcamento } from "@/lib/orcamento/store";
import { MESES } from "@/lib/orcamento/types";
import { fmtMoney, fmtPctTable } from "@/lib/saga/formatters";

export const Route = createFileRoute("/orcamento/")({ component: DashboardOrcamento });

function Kpi({
  titulo,
  valor,
  sub,
  ajuda,
  bom,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  ajuda?: string;
  bom?: boolean | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {titulo}
          {ajuda && <InfoTooltip text={ajuda} />}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={
            bom == null
              ? "text-xl font-semibold tabular-nums"
              : bom
                ? "text-xl font-semibold tabular-nums text-emerald-600"
                : "text-xl font-semibold tabular-nums text-destructive"
          }
        >
          {valor}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function DashboardOrcamento() {
  const { orcamento } = useOrcamento();
  const { variancia, forecast, rolling } = useAnalises();

  if (!orcamento || !variancia || !forecast || !rolling) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum dado orçamentário carregado ainda.
          </p>
          <Button asChild>
            <Link to="/orcamento/dados">Importar planilha de orçamento</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const t = variancia.totais;
  const atingimento = t.receitaOrc ? t.receitaReal / t.receitaOrc : null;
  const dados = variancia.porMes.map((p, i) => ({
    mes: MESES[i],
    "Receita orçada": p.receitaOrc,
    "Receita realizada": p.receitaReal,
  }));
  const resultado = forecast.porMes.map((p) => ({
    mes: p.mes,
    Orçado: p.orcado,
    Forecast: p.forecast,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo={`Orçamento ${orcamento.ano} — visão geral`}
        subtitulo={`Acumulado até ${MESES[variancia.ateMes]} · método de forecast: ${orcamento.config.metodo}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Receita YTD realizada"
          valor={fmtMoney(t.receitaReal)}
          sub={`Orçado: ${fmtMoney(t.receitaOrc)}`}
          bom={t.receitaReal >= t.receitaOrc}
          ajuda="Soma das receitas realizadas do início do ano até o último mês fechado."
        />
        <Kpi
          titulo="Atingimento da receita"
          valor={atingimento == null ? "—" : fmtPctTable(atingimento)}
          sub="Realizado ÷ orçado no acumulado"
          bom={atingimento != null && atingimento >= 1}
          ajuda="Quanto da receita orçada foi efetivamente entregue no período acumulado."
        />
        <Kpi
          titulo="Resultado YTD"
          valor={fmtMoney(t.resultadoReal)}
          sub={`Orçado: ${fmtMoney(t.resultadoOrc)}`}
          bom={t.resultadoReal >= t.resultadoOrc}
          ajuda="Receitas menos custos e despesas realizados no acumulado do ano."
        />
        <Kpi
          titulo="Forecast de resultado (ano)"
          valor={fmtMoney(forecast.totais.resultado)}
          sub={`Orçado: ${fmtMoney(forecast.totais.resultadoOrc)}`}
          bom={forecast.totais.resultado >= forecast.totais.resultadoOrc}
          ajuda="Projeção de fechamento do ano: realizado até aqui + previsão para os meses restantes."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Receita: orçado × realizado</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gOrc" x1="0" y1="0" x2="0" y2="1">
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
                  dataKey="Receita orçada"
                  stroke="hsl(var(--primary))"
                  fill="url(#gOrc)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Receita realizada"
                  stroke="hsl(var(--chart-2, var(--primary)))"
                  fill="transparent"
                  strokeWidth={2}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resultado mensal: orçado × forecast</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={resultado} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <Bar dataKey="Orçado" fill="hsl(var(--muted-foreground))" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Forecast" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            Rolling forecast — próximos {rolling.pontos.length} meses
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4">
          <Kpi titulo="Receita projetada" valor={fmtMoney(rolling.totais.receita)} bom={null} />
          <Kpi titulo="Custos" valor={fmtMoney(rolling.totais.custo)} bom={null} />
          <Kpi titulo="Despesas" valor={fmtMoney(rolling.totais.despesa)} bom={null} />
          <Kpi
            titulo="Resultado"
            valor={fmtMoney(rolling.totais.resultado)}
            bom={rolling.totais.resultado >= 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
