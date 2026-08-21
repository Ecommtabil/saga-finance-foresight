import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/saga/PageHeader";
import { useSimpl } from "@/lib/simpl/store";
import { fmtMoney, fmtMult, fmtPct, safeDiv } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Modelagem Simplificada" },
      {
        name: "description",
        content:
          "KPIs, evolução de receita e EBITDA, geração de caixa e ponte de valuation do modelo integrado.",
      },
      { property: "og:title", content: "Dashboard da modelagem — SAGA" },
      { property: "og:description", content: "Visão executiva das projeções do cliente ativo." },
    ],
  }),
  component: DashboardSimpl,
});

const NAVY = "#2A3566";
const PERIWINKLE = "#7B87D6";
const CORAL = "#E8705F";
const TEAL = "#3BA9A0";

function DashboardSimpl() {
  const { empresa, cenario, projecao, dcf, avisos } = useSimpl();
  if (!empresa || !cenario || !projecao || !dcf) return null;
  const moeda = empresa.moeda;
  const anos = projecao.anual;
  const ult = anos[anos.length - 1];
  const prim = anos[0];

  const cagr =
    anos.length > 1 && prim.receitaLiquida > 0
      ? Math.pow(ult.receitaLiquida / prim.receitaLiquida, 1 / (anos.length - 1)) - 1
      : 0;

  const serie = anos.map((a) => ({
    ano: a.rotulo,
    receita: a.receitaLiquida,
    ebitda: a.ebitda,
    lucro: a.lucroLiquido,
    margem: safeDiv(a.ebitda, a.receitaLiquida) * 100,
    caixa: a.caixa,
    fco: a.fco,
    fci: a.fci,
    fcf: a.fcf,
  }));

  const waterfall = (() => {
    const passos = [
      { nome: "VP explícito", valor: dcf.somaVp },
      { nome: "VP terminal", valor: dcf.vpTerminal },
      { nome: "(-) Dívida líq.", valor: -dcf.dividaLiquida },
    ];
    let acc = 0;
    const barras = passos.map((p) => {
      const base = p.valor >= 0 ? acc : acc + p.valor;
      acc += p.valor;
      return { nome: p.nome, base, valor: Math.abs(p.valor), positivo: p.valor >= 0 };
    });
    return [...barras, { nome: "Equity Value", base: 0, valor: acc, positivo: true, total: true }];
  })();

  const kpis = [
    { t: "Receita líquida (último ano)", v: fmtMoney(ult.receitaLiquida, moeda), s: `CAGR ${fmtPct(cagr)}` },
    { t: "EBITDA", v: fmtMoney(ult.ebitda, moeda), s: `Margem ${fmtPct(safeDiv(ult.ebitda, ult.receitaLiquida))}` },
    { t: "Lucro líquido", v: fmtMoney(ult.lucroLiquido, moeda), s: `Margem ${fmtPct(safeDiv(ult.lucroLiquido, ult.receitaLiquida))}` },
    { t: "Caixa final", v: fmtMoney(ult.caixa, moeda), s: `Dívida líq. ${fmtMoney(dcf.dividaLiquida, moeda)}` },
    { t: "WACC", v: fmtPct(dcf.wacc), s: `Ke ${fmtPct(dcf.ke)} · Kd ${fmtPct(dcf.kdLiquido)}` },
    { t: "Enterprise Value", v: fmtMoney(dcf.enterpriseValue, moeda), s: `EV/EBITDA ${fmtMult(dcf.evEbitda)}` },
    { t: "Equity Value", v: fmtMoney(dcf.equityValue, moeda), s: `Cenário ${cenario.nome}` },
    { t: "Horizonte", v: `${cenario.premissas.horizonteAnos} anos`, s: `${empresa.regime} · ${moeda}` },
  ];

  const tt = (v: number | string) => fmtMoney(Number(v), moeda);

  return (
    <>
      <PageHeader
        titulo={`Dashboard — ${empresa.nome}`}
        subtitulo={`Cenário ${cenario.nome}. Todos os números vêm do motor integrado DRE + Balanço + Fluxo de Caixa.`}
        action={
          <Button asChild size="sm">
            <Link to="/modelagem-simplificada/demonstrativos">
              Ver demonstrativos <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      {avisos.length > 0 && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-4 text-sm">
              {avisos.slice(0, 5).map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.t}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{k.t}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{k.v}</div>
              <div className="mt-1 text-xs text-muted-foreground">{k.s}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4 text-primary" /> Receita, EBITDA e margem
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={PERIWINKLE} stopOpacity={0.55} />
                    <stop offset="100%" stopColor={PERIWINKLE} stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="ano" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <YAxis yAxisId="p" orientation="right" tickLine={false} axisLine={false} fontSize={11} unit="%" />
                <Tooltip
                  formatter={(v: number, n: string) => (n === "margem" ? `${v.toFixed(1)}%` : tt(v))}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }}
                />
                <Legend />
                <Area type="monotone" dataKey="receita" name="Receita líquida" stroke={NAVY} fill="url(#gRec)" strokeWidth={2} />
                <Bar dataKey="ebitda" name="EBITDA" fill={TEAL} radius={[4, 4, 0, 0]} barSize={22} />
                <Line yAxisId="p" type="monotone" dataKey="margem" name="Margem EBITDA" stroke={CORAL} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Geração de caixa por ano</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="ano" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => tt(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                <Legend />
                <Bar dataKey="fco" name="Operacional" fill={NAVY} radius={[4, 4, 0, 0]} />
                <Bar dataKey="fci" name="Investimento" fill={CORAL} radius={[4, 4, 0, 0]} />
                <Bar dataKey="fcf" name="Financiamento" fill={PERIWINKLE} radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="caixa" name="Caixa final" stroke={TEAL} strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ponte de valuation</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfall} margin={{ left: 4, right: 8, top: 8 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="nome" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip
                  formatter={(v: number, n: string) => (n === "valor" ? tt(v) : "")}
                  contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }}
                />
                <Bar dataKey="base" stackId="w" fill="transparent" />
                <Bar dataKey="valor" stackId="w" radius={[4, 4, 0, 0]}>
                  {waterfall.map((b, i) => (
                    <Cell key={i} fill={"total" in b && b.total ? NAVY : b.positivo ? TEAL : CORAL} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lucro líquido projetado</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ left: 4, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gLuc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={NAVY} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={NAVY} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="ano" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} width={70} />
                <Tooltip formatter={(v: number) => tt(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E5E7EB" }} />
                <Area type="monotone" dataKey="lucro" name="Lucro líquido" stroke={NAVY} fill="url(#gLuc)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
