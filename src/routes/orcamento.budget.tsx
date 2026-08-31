import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/saga/PageHeader";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrcamento } from "@/lib/orcamento/store";
import { calcularBudget, ultimoMesRealizado } from "@/lib/orcamento/engine";
import { MESES, TIPO_LABEL } from "@/lib/orcamento/types";
import { fmtMoney, fmtNum, fmtPctTable } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orcamento/budget")({
  head: () => ({
    meta: [
      { title: "Budget — Discrepâncias entre orçado e realizado | SAGA" },
      {
        name: "description",
        content:
          "KPIs de controle orçamentário: atingimento, acurácia, execução de gastos, ponte de variações e ranking de desvios por conta.",
      },
      { property: "og:title", content: "Budget — Discrepâncias entre orçado e realizado | SAGA" },
      {
        property: "og:description",
        content: "Análise Budget do SAGA: variações, acurácia orçamentária e ranking de desvios.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BudgetPage,
});

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
          className={cn(
            "text-xl font-semibold tabular-nums",
            bom == null ? "" : bom ? "text-emerald-600" : "text-destructive",
          )}
        >
          {valor}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function BudgetPage() {
  const { orcamento } = useOrcamento();
  const [ate, setAte] = useState("auto");

  if (!orcamento || orcamento.linhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            Importe o orçado e o realizado para calcular as discrepâncias.
          </p>
          <Button asChild>
            <Link to="/orcamento/dados">Ir para Dados &amp; Importação</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const limite = ate === "auto" ? Math.max(ultimoMesRealizado(orcamento.linhas), 0) : Number(ate);
  const b = calcularBudget(orcamento, limite);
  const t = b.variancia.totais;
  const grupos = [...new Set(orcamento.linhas.map((l) => l.grupo))];

  const ponte = [
    { nome: "Receita", v: b.ponte.receita },
    { nome: "Custos", v: b.ponte.custo },
    { nome: "Despesas", v: b.ponte.despesa },
    { nome: "Outros", v: b.ponte.outros },
  ].filter((p) => p.v !== 0 || p.nome !== "Outros");

  const serie = b.porMes.slice(0, b.ateMes + 1).map((p) => ({
    mes: p.mes,
    Desvio: p.desvio,
    "Desvio acumulado": p.desvioAcum,
  }));

  const top = b.ranking.slice(0, 8).map((r) => ({ ...r, nome: r.conta }));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Budget — orçado × realizado"
        subtitulo={`Discrepâncias acumuladas de ${MESES[0]} a ${MESES[b.ateMes]} (${b.mesesFechados} ${b.mesesFechados === 1 ? "mês" : "meses"}).`}
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Acumulado até</span>
            <Select value={ate} onValueChange={setAte}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (último real)</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Atingimento da receita"
          valor={b.atingimentoReceita == null ? "—" : fmtPctTable(b.atingimentoReceita)}
          sub={`${fmtMoney(t.receitaReal)} de ${fmtMoney(t.receitaOrc)}`}
          bom={b.atingimentoReceita != null && b.atingimentoReceita >= 1}
          ajuda="Receita realizada dividida pela receita orçada no período acumulado."
        />
        <Kpi
          titulo="Execução de gastos"
          valor={b.execucaoGastos == null ? "—" : fmtPctTable(b.execucaoGastos)}
          sub={`${fmtMoney(t.custoReal + t.despesaReal)} de ${fmtMoney(t.custoOrc + t.despesaOrc)}`}
          bom={b.execucaoGastos != null && b.execucaoGastos <= 1}
          ajuda="Custos e despesas realizados sobre o orçado do período. Acima de 100% indica estouro de orçamento."
        />
        <Kpi
          titulo="Impacto no resultado"
          valor={fmtMoney(b.impactoResultado)}
          sub={`Resultado ${fmtMoney(t.resultadoReal)} vs orçado ${fmtMoney(t.resultadoOrc)}`}
          bom={b.impactoResultado >= 0}
          ajuda="Diferença líquida entre resultado realizado e orçado no acumulado."
        />
        <Kpi
          titulo="Acurácia orçamentária"
          valor={b.acuracia == null ? "—" : fmtPctTable(b.acuracia)}
          sub={`Desvio absoluto ${fmtMoney(b.desvioAbsoluto)}`}
          bom={b.acuracia != null && b.acuracia >= 0.9}
          ajuda="1 − (soma dos desvios em módulo ÷ orçado total). Mede o quanto o orçamento acertou, independentemente do sinal."
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo="Contas dentro do alvo (±5%)"
          valor={`${b.contasNoAlvo}/${b.contasTotal}`}
          sub={`${b.contasFavoraveis} favoráveis · ${b.contasDesfavoraveis} desfavoráveis`}
          bom={b.contasTotal ? b.contasNoAlvo / b.contasTotal >= 0.7 : null}
          ajuda="Quantidade de contas cujo desvio percentual ficou dentro da tolerância de 5%."
        />
        <Kpi
          titulo="Margem realizada"
          valor={b.margemRealizada == null ? "—" : fmtPctTable(b.margemRealizada)}
          sub={`Orçada: ${b.margemOrcada == null ? "—" : fmtPctTable(b.margemOrcada)}`}
          bom={
            b.margemRealizada != null && b.margemOrcada != null
              ? b.margemRealizada >= b.margemOrcada
              : null
          }
          ajuda="Resultado dividido pela receita, comparando realizado com o previsto no orçamento."
        />
        <Kpi
          titulo="Orçamento anual consumido"
          valor={b.consumoOrcamentoAno == null ? "—" : fmtPctTable(b.consumoOrcamentoAno)}
          sub={`Referência linear: ${fmtPctTable(b.mesesFechados / 12)}`}
          bom={
            b.consumoOrcamentoAno == null ? null : b.consumoOrcamentoAno <= b.mesesFechados / 12
          }
          ajuda="Parcela do orçamento anual de custos e despesas já consumida, comparada ao ritmo linear esperado."
        />
        <Kpi
          titulo="Volatilidade do desvio"
          valor={b.volatilidadeMensal == null ? "—" : fmtPctTable(b.volatilidadeMensal)}
          sub="Desvio-padrão mensal do erro de resultado"
          bom={b.volatilidadeMensal == null ? null : b.volatilidadeMensal <= 0.15}
          ajuda="Dispersão dos desvios mensais do resultado. Valores altos indicam previsibilidade baixa."
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Ponte de variações do resultado
              <InfoTooltip text="Contribuição de cada bloco para a diferença entre resultado realizado e orçado. Barras positivas somam ao resultado; negativas destroem." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ponte} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="nome" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                <Bar dataKey="v" name="Impacto" radius={[3, 3, 0, 0]}>
                  {ponte.map((p) => (
                    <Cell
                      key={p.nome}
                      fill={p.v >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1.5 text-sm">
              Desvio mensal e acumulado do resultado
              <InfoTooltip text="Barras: desvio do mês (realizado − orçado). Linha: desvio acumulado no ano." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => fmtMoney(v)} />
                <Legend />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />
                <Bar dataKey="Desvio" radius={[3, 3, 0, 0]}>
                  {serie.map((s, i) => (
                    <Cell
                      key={i}
                      fill={
                        (s.Desvio ?? 0) >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"
                      }
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="Desvio acumulado"
                  stroke="hsl(var(--foreground))"
                  dot={false}
                  strokeWidth={2}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            Maiores discrepâncias por conta
            <InfoTooltip text="Ordenado pelo impacto no resultado: receita acima do orçado e gasto abaixo do orçado somam; o inverso subtrai." />
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={top} layout="vertical" margin={{ left: 8, right: 16, top: 8 }}>
              <CartesianGrid horizontal={false} strokeOpacity={0.2} />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis
                type="category"
                dataKey="nome"
                width={160}
                tickLine={false}
                axisLine={false}
                fontSize={11}
              />
              <Tooltip formatter={(v: number) => fmtMoney(v)} />
              <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" />
              <Bar dataKey="impacto" name="Impacto no resultado" radius={[0, 3, 3, 0]}>
                {top.map((r) => (
                  <Cell
                    key={r.conta}
                    fill={r.impacto >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            Detalhamento por conta
            <InfoTooltip text="Variação = realizado − orçado no acumulado. Verde = favorável ao resultado; vermelho = desfavorável." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">Conta</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-right">Orçado YTD</th>
                <th className="p-2 text-right">Realizado YTD</th>
                <th className="p-2 text-right">Variação</th>
                <th className="p-2 text-right">Var %</th>
                <th className="p-2 text-right">Impacto</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <tr key={`g-${g}`} className="contents">
                  <td className="hidden" />
                </tr>
              ))}
              {grupos.flatMap((g) => [
                <tr key={`h-${g}`} className="border-t bg-muted/30">
                  <td colSpan={8} className="p-2 font-semibold">
                    {g}
                  </td>
                </tr>,
                ...b.ranking
                  .filter((r) => r.grupo === g)
                  .map((r) => {
                    const dentro = r.variacaoPct != null && Math.abs(r.variacaoPct) <= 0.05;
                    return (
                      <tr key={`${g}-${r.conta}`} className="border-t">
                        <td className="p-2">{r.conta}</td>
                        <td className="p-2 text-muted-foreground">{TIPO_LABEL[r.tipo]}</td>
                        <td className="p-2 text-right tabular-nums">{fmtNum(r.orcado)}</td>
                        <td className="p-2 text-right tabular-nums">{fmtNum(r.realizado)}</td>
                        <td
                          className={cn(
                            "p-2 text-right font-medium tabular-nums",
                            r.favoravel ? "text-emerald-600" : "text-destructive",
                          )}
                        >
                          {fmtNum(r.variacao)}
                        </td>
                        <td
                          className={cn(
                            "p-2 text-right tabular-nums",
                            r.favoravel ? "text-emerald-600" : "text-destructive",
                          )}
                        >
                          {r.variacaoPct == null ? "—" : fmtPctTable(r.variacaoPct)}
                        </td>
                        <td
                          className={cn(
                            "p-2 text-right tabular-nums",
                            r.impacto >= 0 ? "text-emerald-600" : "text-destructive",
                          )}
                        >
                          {fmtNum(r.impacto)}
                        </td>
                        <td className="p-2 text-center">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-medium",
                              dentro
                                ? "bg-muted text-muted-foreground"
                                : r.favoravel
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-destructive/10 text-destructive",
                            )}
                          >
                            {dentro ? "No alvo" : r.favoravel ? "Favorável" : "Desfavorável"}
                          </span>
                        </td>
                      </tr>
                    );
                  }),
              ])}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Variação mês a mês por conta</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">Conta</th>
                {MESES.map((m) => (
                  <th key={m} className="p-2 text-right">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.variancia.linhas.map((l) => (
                <tr key={l.linha.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{l.linha.conta}</td>
                  {l.variacao.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-2 text-right tabular-nums",
                        v == null
                          ? "text-muted-foreground"
                          : (l.linha.tipo === "receita" || l.linha.tipo === "outros") === v >= 0
                            ? "text-emerald-600"
                            : "text-destructive",
                      )}
                    >
                      {v == null ? "—" : fmtNum(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
