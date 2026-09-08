import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  ComposedChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { NavRelatorios } from "@/components/mf2/RelatorioFinanceiro";
import { useMF2 } from "@/lib/mf2/store";
import { projetarModelo, type LinhaSchedAtivo, type LinhaSchedDivida } from "@/lib/mf2/engine";
import { calcularIndicadores } from "@/lib/mf2/indicadores";
import { fmtMoney, fmtMult, fmtNum, fmtPctTable } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-financeira-2/indicadores/$modeloId")({
  head: () => ({
    meta: [
      { title: "Indicadores do modelo — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Endividamento, rentabilidade, capital de giro, margem de contribuição, ponto de equilíbrio e schedules detalhados do modelo projetado.",
      },
      { property: "og:title", content: "Indicadores do modelo — SAGA" },
      {
        property: "og:description",
        content: "Dívida líquida/EBITDA, ROE, ROA, capital de giro e auditoria linha a linha dos schedules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IndicadoresMF2,
});

const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

function Grafico({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function Kpi({ rotulo, valor, hint }: { rotulo: string; valor: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
        {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}

function IndicadoresMF2() {
  const { modeloId } = Route.useParams();
  const { obterModelo, pronto } = useMF2();
  const modelo = obterModelo(modeloId);
  const projecao = useMemo(() => (modelo ? projetarModelo(modelo) : null), [modelo]);
  const indicadores = useMemo(() => (projecao ? calcularIndicadores(projecao) : []), [projecao]);
  const [schedSel, setSchedSel] = useState("divida-0");

  if (!pronto) return null;
  if (!modelo || !projecao) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Modelo não encontrado.{" "}
          <Link className="underline" to="/modelagem-financeira-2">
            Voltar aos modelos
          </Link>
        </CardContent>
      </Card>
    );
  }

  const moeda = modelo.unidadeMonetaria === "BRL" ? "R$" : modelo.unidadeMonetaria;
  const m$ = (v: number | null | undefined) => fmtMoney(v ?? 0, moeda);
  const ultimo = indicadores[indicadores.length - 1];
  const sched = projecao.schedules;

  const dadosEnd = indicadores.map((x) => ({
    mes: x.rotulo,
    "Dívida bruta": x.dividaBruta,
    Caixa: x.caixa,
    "Dívida líquida": x.dividaLiquida,
    "EBITDA 12m": x.ebitda12m,
    "DL/EBITDA": x.dividaLiquidaEbitda ?? 0,
  }));
  const dadosRent = indicadores.map((x) => ({
    mes: x.rotulo,
    ROE: (x.roe ?? 0) * 100,
    ROA: (x.roa ?? 0) * 100,
  }));
  const dadosCg = indicadores.map((x) => ({
    mes: x.rotulo,
    "Capital de giro líquido": x.capitalGiroLiquido,
    "% da receita líquida": (x.cglSobreReceita ?? 0) * 100,
  }));
  const dadosPe = indicadores.map((x) => ({
    mes: x.rotulo,
    "Receita líquida": x.receitaLiquida,
    "Ponto de equilíbrio": x.pontoEquilibrioValor ?? 0,
    "Margem de contribuição %": (x.margemContribuicaoPct ?? 0) * 100,
  }));

  const opcoesSched = [
    ...sched.dividas.map((d, i) => ({ valor: `divida-${i}`, rotulo: `Dívida — ${d.nome}` })),
    { valor: "revolvente", rotulo: "Dívida revolvente" },
    ...sched.ativos.map((a, i) => ({ valor: `ativo-${i}`, rotulo: `Ativo — ${a.nome} ${i + 1}` })),
    { valor: "wc", rotulo: "Tributos a recuperar e obrigações trabalhistas" },
  ];

  const linhasDivida: LinhaSchedDivida[] | null = schedSel.startsWith("divida-")
    ? (sched.dividas[Number(schedSel.split("-")[1])]?.linhas ?? null)
    : schedSel === "revolvente"
      ? sched.revolvente
      : null;
  const linhasAtivo: LinhaSchedAtivo[] | null = schedSel.startsWith("ativo-")
    ? (sched.ativos[Number(schedSel.split("-")[1])]?.linhas ?? null)
    : null;

  return (
    <>
      <PageHeader
        titulo={`Indicadores — ${modelo.nomeEmpresa}`}
        subtitulo="Endividamento, rentabilidade, capital de giro, ponto de equilíbrio e schedules para auditoria do modelo."
      />
      <NavRelatorios modeloId={modeloId} atual="indicadores" />

      <Tabs defaultValue="endividamento">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="endividamento">Endividamento</TabsTrigger>
          <TabsTrigger value="rentabilidade">Rentabilidade</TabsTrigger>
          <TabsTrigger value="giro">Capital de giro</TabsTrigger>
          <TabsTrigger value="equilibrio">Margem e equilíbrio</TabsTrigger>
          <TabsTrigger value="avancado">Avançado (Schedules)</TabsTrigger>
        </TabsList>

        <TabsContent value="endividamento" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi rotulo="Dívida bruta" valor={m$(ultimo?.dividaBruta)} hint="Dívidas + revolvente" />
            <Kpi rotulo="Caixa" valor={m$(ultimo?.caixa)} />
            <Kpi rotulo="Dívida líquida" valor={m$(ultimo?.dividaLiquida)} />
            <Kpi rotulo="EBITDA 12 meses" valor={m$(ultimo?.ebitda12m)} />
            <Kpi
              rotulo="Dívida líquida / EBITDA"
              valor={ultimo?.dividaLiquidaEbitda == null ? "—" : fmtMult(ultimo.dividaLiquidaEbitda)}
              hint="Último mês projetado"
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Endividamento ao longo dos 60 meses</CardTitle>
            </CardHeader>
            <CardContent>
              <Grafico>
                <LineChart data={dadosEnd} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} interval={5} />
                  <YAxis tick={AXIS} tickFormatter={(v) => fmtNum(v / 1000)} />
                  <Tooltip formatter={(v: number) => m$(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="Dívida bruta" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Caixa" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="Dívida líquida" stroke="hsl(var(--chart-3))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="EBITDA 12m" stroke="hsl(var(--chart-4))" dot={false} strokeWidth={2} />
                </LineChart>
              </Grafico>
              <p className="mt-2 text-xs text-muted-foreground">Valores em milhares no eixo.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dívida líquida / EBITDA (x)</CardTitle>
            </CardHeader>
            <CardContent>
              <Grafico>
                <LineChart data={dadosEnd} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} interval={5} />
                  <YAxis tick={AXIS} tickFormatter={(v) => `${fmtNum(v, 1)}x`} />
                  <Tooltip formatter={(v: number) => fmtMult(v)} />
                  <ReferenceLine y={3} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label="3,0x" />
                  <Line type="monotone" dataKey="DL/EBITDA" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
                </LineChart>
              </Grafico>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rentabilidade" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Lucro líquido 12m" valor={m$(ultimo?.lucro12m)} />
            <Kpi rotulo="Patrimônio líquido" valor={m$(ultimo?.patrimonioLiquido)} />
            <Kpi rotulo="ROE" valor={ultimo?.roe == null ? "—" : fmtPctTable(ultimo.roe)} />
            <Kpi rotulo="ROA" valor={ultimo?.roa == null ? "—" : fmtPctTable(ultimo.roa)} />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ROE e ROA (lucro dos últimos 12 meses)</CardTitle>
            </CardHeader>
            <CardContent>
              <Grafico>
                <LineChart data={dadosRent} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} interval={5} />
                  <YAxis tick={AXIS} tickFormatter={(v) => `${fmtNum(v, 1)}%`} />
                  <Tooltip formatter={(v: number) => `${fmtNum(v, 1)}%`} />
                  <Legend />
                  <Line type="monotone" dataKey="ROE" stroke="hsl(var(--chart-1))" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ROA" stroke="hsl(var(--chart-2))" dot={false} strokeWidth={2} />
                </LineChart>
              </Grafico>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="giro" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Ativos de giro" valor={m$(ultimo?.ativosGiro)} hint="Receber + estoques + tributos + adiantamentos" />
            <Kpi rotulo="Passivos de giro" valor={m$(ultimo?.passivosGiro)} hint="Pagar + obrigações + adiantamento de clientes" />
            <Kpi rotulo="Capital de giro líquido" valor={m$(ultimo?.capitalGiroLiquido)} />
            <Kpi
              rotulo="% da receita líquida"
              valor={ultimo?.cglSobreReceita == null ? "—" : fmtPctTable(ultimo.cglSobreReceita)}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capital de giro líquido</CardTitle>
            </CardHeader>
            <CardContent>
              <Grafico>
                <AreaChart data={dadosCg} margin={{ left: 8, right: 8 }}>
                  <defs>
                    <linearGradient id="gradCg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} interval={5} />
                  <YAxis tick={AXIS} tickFormatter={(v) => fmtNum(v / 1000)} />
                  <Tooltip formatter={(v: number) => m$(v)} />
                  <Area
                    type="monotone"
                    dataKey="Capital de giro líquido"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#gradCg)"
                  />
                </AreaChart>
              </Grafico>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Capital de giro como % da receita líquida</CardTitle>
            </CardHeader>
            <CardContent>
              <Grafico>
                <BarChart data={dadosCg} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} interval={5} />
                  <YAxis tick={AXIS} tickFormatter={(v) => `${fmtNum(v, 0)}%`} />
                  <Tooltip formatter={(v: number) => `${fmtNum(v, 1)}%`} />
                  <Bar dataKey="% da receita líquida" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </Grafico>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equilibrio" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi rotulo="Margem de contribuição" valor={m$(ultimo?.margemContribuicao)} />
            <Kpi
              rotulo="Margem de contribuição %"
              valor={ultimo?.margemContribuicaoPct == null ? "—" : fmtPctTable(ultimo.margemContribuicaoPct)}
            />
            <Kpi rotulo="Ponto de equilíbrio (R$)" valor={m$(ultimo?.pontoEquilibrioValor)} />
            <Kpi
              rotulo="Ponto de equilíbrio (unidades)"
              valor={ultimo?.pontoEquilibrioVolume == null ? "—" : fmtNum(ultimo.pontoEquilibrioVolume, 0)}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receita líquida x ponto de equilíbrio</CardTitle>
            </CardHeader>
            <CardContent>
              <Grafico>
                <ComposedChart data={dadosPe} margin={{ left: 8, right: 8 }}>
                  <defs>
                    <linearGradient id="gradRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" tick={AXIS} interval={5} />
                  <YAxis tick={AXIS} tickFormatter={(v) => fmtNum(v / 1000)} />
                  <Tooltip formatter={(v: number) => m$(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="Receita líquida"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={2}
                    fill="url(#gradRec)"
                  />
                  <Line
                    type="monotone"
                    dataKey="Ponto de equilíbrio"
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="5 4"
                    dot={false}
                    strokeWidth={2}
                  />
                </ComposedChart>
              </Grafico>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cobertura do ponto de equilíbrio mês a mês</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[420px] overflow-y-auto">
              <div className="space-y-2">
                {indicadores.map((x) => {
                  const cob = x.coberturaPE ?? 0;
                  const acima = cob >= 1;
                  return (
                    <div key={x.indice} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs tabular-nums text-muted-foreground">{x.rotulo}</span>
                      <Progress value={Math.min(cob * 100, 200) / 2} className="h-2 flex-1" />
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums">{fmtNum(cob * 100, 0)}%</span>
                      <Badge variant={acima ? "secondary" : "destructive"} className="w-24 justify-center text-[10px]">
                        {acima ? "Acima do PE" : "Abaixo do PE"}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="avancado" className="space-y-4">
          <Card>
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <span className="text-sm text-muted-foreground">Schedule:</span>
              <Select value={schedSel} onValueChange={setSchedSel}>
                <SelectTrigger className="w-[340px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {opcoesSched.map((o) => (
                    <SelectItem key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="overflow-x-auto p-0">
              {linhasDivida ? (
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Mês</th>
                      <th className="p-2 text-right">Mês após captação</th>
                      <th className="p-2 text-right">Saldo inicial</th>
                      <th className="p-2 text-right">Captação</th>
                      <th className="p-2 text-right">Juros</th>
                      <th className="p-2 text-right">Pagamento</th>
                      <th className="p-2 text-right">Amortização</th>
                      <th className="p-2 text-right">Saldo final</th>
                      <th className="p-2 text-right">Curto prazo</th>
                      <th className="p-2 text-right">Longo prazo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasDivida.map((l) => (
                      <tr key={l.indice} className="border-t">
                        <td className="p-2">{l.rotulo}</td>
                        <td className="p-2 text-right tabular-nums">{l.mesAposCaptacao ?? "—"}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.saldoInicial)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.captacao)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.juros)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.pagamento)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.amortizacao)}</td>
                        <td className="p-2 text-right font-medium tabular-nums">{m$(l.saldoFinal)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.curtoPrazo)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.longoPrazo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : linhasAtivo ? (
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Mês</th>
                      <th className="p-2 text-right">Saldo inicial</th>
                      <th className="p-2 text-right">CAPEX</th>
                      <th className="p-2 text-right">Depreciação/amortização</th>
                      <th className="p-2 text-right">Saldo final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhasAtivo.map((l) => (
                      <tr key={l.indice} className="border-t">
                        <td className="p-2">{l.rotulo}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.saldoInicial)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.capex)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.depreciacao)}</td>
                        <td className="p-2 text-right font-medium tabular-nums">{m$(l.saldoFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[800px] text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="p-2 text-left">Mês</th>
                      <th className="p-2 text-right">Tributos — saldo inicial</th>
                      <th className="p-2 text-right">Tributos — variação</th>
                      <th className="p-2 text-right">Tributos — saldo final</th>
                      <th className="p-2 text-right">Trabalhistas — saldo inicial</th>
                      <th className="p-2 text-right">Provisão</th>
                      <th className="p-2 text-right">Pagamento</th>
                      <th className="p-2 text-right">Trabalhistas — saldo final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sched.capitalGiro.map((l) => (
                      <tr key={l.indice} className="border-t">
                        <td className="p-2">{l.rotulo}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.tribInicial)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.tribGerado)}</td>
                        <td className="p-2 text-right font-medium tabular-nums">{m$(l.tribFinal)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.trabInicial)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.trabProvisao)}</td>
                        <td className="p-2 text-right tabular-nums">{m$(l.trabPago)}</td>
                        <td className="p-2 text-right font-medium tabular-nums">{m$(l.trabFinal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
