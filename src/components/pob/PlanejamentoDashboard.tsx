import { useMemo } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { calcularDemonstrativosPOB, rotulosMeses, vendasBase } from "@/lib/pob/projecao";
import { parametrosPadrao } from "@/lib/pob/parametros";
import { usePlanejamento } from "@/lib/pob/store";
import { fmtMoney, fmtPctTable } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

const SOMA = (valores: number[]) => valores.reduce((total, valor) => total + valor, 0);

function percentual(numerador: number, denominador: number): number | null {
  return Math.abs(denominador) > 0.004 ? numerador / denominador : null;
}

function variacao(atual: number, anterior: number): number | null {
  if (Math.abs(anterior) <= 0.004) return Math.abs(atual) <= 0.004 ? 0 : null;
  return (atual - anterior) / Math.abs(anterior);
}

function KpiCard({
  titulo,
  valor,
  detalhe,
  delta,
}: {
  titulo: string;
  valor: string;
  detalhe?: string;
  delta: number | null;
}) {
  const positivo = delta != null && delta > 0.0005;
  const negativo = delta != null && delta < -0.0005;
  const DeltaIcon = positivo ? ArrowUpRight : negativo ? ArrowDownRight : ArrowRight;

  return (
    <Card className="overflow-hidden border-t-2 border-t-primary/70">
      <CardHeader className="space-y-1 pb-2">
        <CardDescription className="text-xs font-medium uppercase">{titulo}</CardDescription>
        <CardTitle className="text-xl tabular-nums">{valor}</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-8 items-end justify-between gap-3 pt-0">
        <span className="text-xs text-muted-foreground">{detalhe}</span>
        <span
          className={cn(
            "flex shrink-0 items-center gap-0.5 text-xs font-semibold tabular-nums",
            positivo && "text-emerald-600",
            negativo && "text-destructive",
            !positivo && !negativo && "text-muted-foreground",
          )}
        >
          <DeltaIcon className="h-3.5 w-3.5" />
          {delta == null ? "—" : fmtPctTable(Math.abs(delta))}
        </span>
      </CardContent>
    </Card>
  );
}

function AnnualIndicator({ titulo, valor }: { titulo: string; valor: number | null }) {
  return (
    <div className="border-l-2 border-l-accent px-3 py-1">
      <p className="text-xs text-muted-foreground">{titulo}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{valor == null ? "—" : fmtPctTable(valor)}</p>
    </div>
  );
}

const tooltipMoney = (valor: number | string, nome: string) => [fmtMoney(Number(valor)), nome];

export function PlanejamentoDashboard() {
  const { cenario } = usePlanejamento();
  const dados = useMemo(() => {
    if (!cenario) return null;
    const parametros = cenario.parametros ?? parametrosPadrao(cenario.ano);
    const demonstrativos = calcularDemonstrativosPOB(parametros);
    const meses = rotulosMeses(vendasBase(parametros).mesBase, cenario.ano);
    return { parametros, demonstrativos, meses };
  }, [cenario]);

  if (!cenario || !dados) return null;

  const { metricas: m } = dados.demonstrativos;
  const ultimo = 11;
  const anterior = 10;
  const receitaAnual = SOMA(m.receita);
  const ebitdaAnual = SOMA(m.ebitda);
  const lucroAnual = SOMA(m.lucroLiquido);
  const ebitAnual = SOMA(m.ebit);
  const plFinal = m.patrimonioLiquido[ultimo];
  const dividaLiquida = m.divida[ultimo] - m.saldoFinalCaixa[ultimo];
  const capitalInvestido = plFinal + dividaLiquida;

  const serieMensal = dados.meses.map((mes, i) => ({
    mes,
    operacional: m.fluxoOperacional[i],
    investimento: m.fluxoInvestimento[i],
    financiamento: m.fluxoFinanciamento[i],
    caixa: m.saldoFinalCaixa[i],
    receita: m.receita[i],
    lucro: m.lucroLiquido[i],
  }));

  const composicaoCustos = [
    { nome: "Matéria-prima", valor: Math.abs(m.consumoMP[ultimo]), fill: "var(--color-chart-1)" },
    { nome: "Mão de obra", valor: Math.abs(m.custoMOD[ultimo]), fill: "var(--color-chart-2)" },
    { nome: "Custos indiretos", valor: Math.abs(m.cifTotal[ultimo]), fill: "var(--color-chart-4)" },
    { nome: "Despesas operacionais", valor: Math.abs(m.despOp[ultimo]), fill: "var(--color-chart-5)" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Visão executiva</p>
          <h1 className="mt-1 text-2xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {cenario.nome} · Último mês projetado: {dados.meses[ultimo]}
          </p>
        </div>
        <span className="rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          Valores em {cenario.moeda}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          titulo="Receita líquida"
          valor={fmtMoney(m.receita[ultimo], cenario.moeda)}
          detalhe={dados.meses[ultimo]}
          delta={variacao(m.receita[ultimo], m.receita[anterior])}
        />
        <KpiCard
          titulo="EBITDA"
          valor={fmtMoney(m.ebitda[ultimo], cenario.moeda)}
          detalhe={`Margem ${fmtPctTable(percentual(m.ebitda[ultimo], m.receita[ultimo]))}`}
          delta={variacao(m.ebitda[ultimo], m.ebitda[anterior])}
        />
        <KpiCard
          titulo="Lucro líquido"
          valor={fmtMoney(m.lucroLiquido[ultimo], cenario.moeda)}
          detalhe={`Margem ${fmtPctTable(percentual(m.lucroLiquido[ultimo], m.receita[ultimo]))}`}
          delta={variacao(m.lucroLiquido[ultimo], m.lucroLiquido[anterior])}
        />
        <KpiCard
          titulo="Saldo final de caixa"
          valor={fmtMoney(m.saldoFinalCaixa[ultimo], cenario.moeda)}
          detalhe={dados.meses[ultimo]}
          delta={variacao(m.saldoFinalCaixa[ultimo], m.saldoFinalCaixa[anterior])}
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Indicadores anuais</CardTitle>
          <CardDescription>Acumulado dos 12 meses do cenário</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <AnnualIndicator titulo="Margem bruta" valor={percentual(SOMA(m.lucroBruto), receitaAnual)} />
          <AnnualIndicator titulo="CPV / receita" valor={percentual(SOMA(m.cpv), receitaAnual)} />
          <AnnualIndicator titulo="SG&A / receita" valor={percentual(SOMA(m.despOp), receitaAnual)} />
          <AnnualIndicator
            titulo="Geração de caixa"
            valor={percentual(
              SOMA(m.fluxoOperacional) + SOMA(m.fluxoInvestimento) + SOMA(m.fluxoFinanciamento),
              SOMA(m.recebimentoOperacional),
            )}
          />
          <AnnualIndicator titulo="ROE" valor={percentual(lucroAnual, plFinal)} />
          <AnnualIndicator titulo="ROIC" valor={percentual(ebitAnual, capitalInvestido)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Movimentação e saldo de caixa</CardTitle>
          <CardDescription>Barras por atividade e linha do saldo final acumulado</CardDescription>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={serieMensal} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeOpacity={0.2} />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickLine={false} axisLine={false} width={72} fontSize={11} tickFormatter={(v) => fmtMoney(Number(v), "")} />
              <Tooltip formatter={tooltipMoney} />
              <Legend />
              <Bar dataKey="operacional" name="Operacional" stackId="fluxo" fill="var(--color-chart-1)" />
              <Bar dataKey="investimento" name="Investimento" stackId="fluxo" fill="var(--color-chart-2)" />
              <Bar dataKey="financiamento" name="Financiamento" stackId="fluxo" fill="var(--color-chart-4)" radius={[3, 3, 0, 0]} />
              <Line type="monotone" dataKey="caixa" name="Saldo final de caixa" stroke="var(--color-foreground)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Receita líquida x lucro líquido</CardTitle>
            <CardDescription>Evolução mensal do resultado projetado</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serieMensal} margin={{ top: 12, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} width={72} fontSize={11} tickFormatter={(v) => fmtMoney(Number(v), "")} />
                <Tooltip formatter={tooltipMoney} />
                <Legend />
                <Line type="monotone" dataKey="receita" name="Receita líquida" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="lucro" name="Lucro líquido" stroke="var(--color-chart-4)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Composição dos custos</CardTitle>
            <CardDescription>{dados.meses[ultimo]} · valores do mês</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={composicaoCustos}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius="48%"
                  outerRadius="72%"
                  paddingAngle={2}
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
                <Tooltip formatter={tooltipMoney} />
                <Legend verticalAlign="bottom" iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}