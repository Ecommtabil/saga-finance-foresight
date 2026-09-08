import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, CheckCircle2, Download, FileSpreadsheet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { NavRelatorios } from "@/components/mf2/RelatorioFinanceiro";
import { useMF2 } from "@/lib/mf2/store";
import { projetarModelo } from "@/lib/mf2/engine";
import {
  agregarProdutos,
  baseProdutos,
  exportarDashboardExcel,
  exportarDashboardPdf,
  provasReais,
  resumoAno,
} from "@/lib/mf2/dashboard";
import { fmtNum, fmtPctTable, safeDiv } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-financeira-2/dashboard/$modeloId")({
  head: () => ({
    meta: [
      { title: "Dashboard do modelo — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Resumo do modelo projetado: receita líquida, EBITDA, lucro líquido, caixa, dívida líquida/EBITDA, análise por produto e provas reais de integridade.",
      },
      { property: "og:title", content: "Dashboard do modelo — SAGA" },
      {
        property: "og:description",
        content: "Cards de resumo, gráficos mensais e anuais, tabela dinâmica por produto e conferências do modelo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardMF2,
});

const AXIS = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const CORES = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const MESES_NOME = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function Kpi({
  rotulo,
  valor,
  sub,
  variacao,
  inverso,
}: {
  rotulo: string;
  valor: string;
  sub?: string;
  variacao?: number | null;
  inverso?: boolean;
}) {
  const positivo = variacao != null && (inverso ? variacao < 0 : variacao > 0);
  const negativo = variacao != null && (inverso ? variacao > 0 : variacao < 0);
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{rotulo}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{valor}</p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {sub ? <span>{sub}</span> : null}
          {variacao != null && isFinite(variacao) ? (
            <span
              className={
                positivo ? "flex items-center text-emerald-600" : negativo ? "flex items-center text-destructive" : "flex items-center"
              }
            >
              {positivo ? <ArrowUpRight className="h-3 w-3" /> : negativo ? <ArrowDownRight className="h-3 w-3" /> : null}
              {fmtPctTable(variacao)} vs. ano anterior
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardMF2() {
  const { modeloId } = Route.useParams();
  const { obterModelo, pronto } = useMF2();
  const modelo = obterModelo(modeloId);
  const projecao = useMemo(() => (modelo ? projetarModelo(modelo) : null), [modelo]);
  const base = useMemo(() => (modelo && projecao ? baseProdutos(modelo, projecao) : []), [modelo, projecao]);

  const [anoSel, setAnoSel] = useState("1");
  const [visao, setVisao] = useState<"mensal" | "anual">("mensal");
  const [visaoProd, setVisaoProd] = useState<"mensal" | "anual">("anual");
  const [filtroAno, setFiltroAno] = useState("todos");
  const [filtroMes, setFiltroMes] = useState("todos");

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

  const ano = Number(anoSel);
  const atual = resumoAno(projecao.meses, ano);
  const anterior = resumoAno(projecao.meses, ano - 1);
  const varia = (a?: number, b?: number | null) =>
    b == null || !b ? null : safeDiv((a ?? 0) - b, Math.abs(b));

  const serieMensal = projecao.meses.map((m) => ({
    periodo: m.rotulo,
    receita: m.receitaLiquida,
    ebitda: m.ebitda,
    lucro: m.lucroLiquido,
  }));
  const serieAnual = [1, 2, 3, 4, 5]
    .map((a) => resumoAno(projecao.meses, a))
    .filter((r) => !!r)
    .map((r) => ({
      periodo: `Ano ${r!.ano}`,
      receita: r!.receitaLiquida,
      ebitda: r!.ebitda,
      lucro: r!.lucroLiquido,
    }));

  const composicao =
    visaoProd === "mensal"
      ? projecao.meses.map((m) => {
          const row: Record<string, number | string> = { periodo: m.rotulo };
          for (const p of modelo.produtos) row[p.id] = m.receitaPorProduto[p.id] ?? 0;
          return row;
        })
      : [1, 2, 3, 4, 5].map((a) => {
          const ms = projecao.meses.filter((m) => m.ano === a);
          const row: Record<string, number | string> = { periodo: `Ano ${a}` };
          for (const p of modelo.produtos)
            row[p.id] = ms.reduce((s, m) => s + (m.receitaPorProduto[p.id] ?? 0), 0);
          return row;
        });

  const baseFiltrada = base.filter(
    (l) =>
      (filtroAno === "todos" || l.ano === Number(filtroAno)) &&
      (filtroMes === "todos" || l.mes === Number(filtroMes)),
  );
  const agregados = agregarProdutos(baseFiltrada);
  const totalReceita = agregados.reduce((s, a) => s + a.receita, 0);
  const totalEbitda = agregados.reduce((s, a) => s + a.ebitda, 0);

  const provas = provasReais(modelo, projecao);

  return (
    <>
      <PageHeader
        titulo={`Dashboard — ${modelo.nomeEmpresa}`}
        subtitulo="Visão executiva da projeção de 60 meses, com análise por produto e provas reais de integridade."
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => exportarDashboardExcel(modelo, projecao, base)}>
              <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button size="sm" onClick={() => exportarDashboardPdf(modelo, projecao, base)}>
              <Download className="mr-1.5 h-4 w-4" /> PDF
            </Button>
          </div>
        }
      />
      <NavRelatorios modeloId={modeloId} atual="dashboard" />

      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Ano de referência:</span>
        <Select value={anoSel} onValueChange={setAnoSel}>
          <SelectTrigger className="h-8 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5].map((a) => (
              <SelectItem key={a} value={String(a)}>
                Ano {a}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        <Kpi
          rotulo="Receita líquida"
          valor={fmtNum(atual?.receitaLiquida ?? 0, 0)}
          variacao={varia(atual?.receitaLiquida, anterior?.receitaLiquida)}
        />
        <Kpi
          rotulo="EBITDA"
          valor={fmtNum(atual?.ebitda ?? 0, 0)}
          sub={`Margem ${fmtPctTable(atual?.margemEbitda ?? 0)}`}
          variacao={varia(atual?.ebitda, anterior?.ebitda)}
        />
        <Kpi
          rotulo="Lucro líquido"
          valor={fmtNum(atual?.lucroLiquido ?? 0, 0)}
          sub={`Margem ${fmtPctTable(atual?.margemLiquida ?? 0)}`}
          variacao={varia(atual?.lucroLiquido, anterior?.lucroLiquido)}
        />
        <Kpi
          rotulo="Saldo de caixa"
          valor={fmtNum(atual?.caixaFinal ?? 0, 0)}
          sub="Dezembro do ano selecionado"
          variacao={varia(atual?.caixaFinal, anterior?.caixaFinal)}
        />
        <Kpi
          rotulo="Dívida líquida / EBITDA"
          valor={`${fmtNum(atual?.dlEbitda ?? 0, 1)}x`}
          sub={`Dívida líquida ${fmtNum(atual?.dividaLiquida ?? 0, 0)}`}
          variacao={varia(atual?.dlEbitda, anterior?.dlEbitda)}
          inverso
        />
      </div>

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Receita líquida, EBITDA e lucro líquido</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={visao === "mensal" ? "default" : "outline"} onClick={() => setVisao("mensal")}>
              Mensal
            </Button>
            <Button size="sm" variant={visao === "anual" ? "default" : "outline"} onClick={() => setVisao("anual")}>
              Anual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {visao === "mensal" ? (
                <LineChart data={serieMensal} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="periodo" tick={AXIS} interval={5} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickFormatter={(v) => fmtNum(Number(v), 0)} tickLine={false} axisLine={false} width={80} />
                  <Tooltip formatter={(v) => fmtNum(Number(v), 0)} />
                  <Legend />
                  <Line type="monotone" dataKey="receita" name="Receita líquida" stroke={CORES[0]} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="ebitda" name="EBITDA" stroke={CORES[1]} dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="lucro" name="Lucro líquido" stroke={CORES[2]} dot={false} strokeWidth={2} />
                </LineChart>
              ) : (
                <BarChart data={serieAnual} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="periodo" tick={AXIS} tickLine={false} axisLine={false} />
                  <YAxis tick={AXIS} tickFormatter={(v) => fmtNum(Number(v), 0)} tickLine={false} axisLine={false} width={80} />
                  <Tooltip formatter={(v) => fmtNum(Number(v), 0)} />
                  <Legend />
                  <Bar dataKey="receita" name="Receita líquida" fill={CORES[0]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="ebitda" name="EBITDA" fill={CORES[1]} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="lucro" name="Lucro líquido" fill={CORES[2]} radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Composição da receita por produto</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={visaoProd === "mensal" ? "default" : "outline"} onClick={() => setVisaoProd("mensal")}>
              Mensal
            </Button>
            <Button size="sm" variant={visaoProd === "anual" ? "default" : "outline"} onClick={() => setVisaoProd("anual")}>
              Anual
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={composicao} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="periodo"
                  tick={AXIS}
                  interval={visaoProd === "mensal" ? 5 : 0}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={AXIS} tickFormatter={(v) => fmtNum(Number(v), 0)} tickLine={false} axisLine={false} width={80} />
                <Tooltip formatter={(v) => fmtNum(Number(v), 0)} />
                <Legend />
                {modelo.produtos.map((p, i) => (
                  <Bar
                    key={p.id}
                    dataKey={p.id}
                    name={p.nome || `Produto ${i + 1}`}
                    stackId="receita"
                    fill={CORES[i % CORES.length]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">Análise por produto</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={filtroAno} onValueChange={setFiltroAno}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {[1, 2, 3, 4, 5].map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    Ano {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroMes} onValueChange={setFiltroMes}>
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {MESES_NOME.map((n, i) => (
                  <SelectItem key={n} value={String(i + 1)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Produto</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Volume</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Ticket médio</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Receita</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">EBITDA rateado</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Mg. EBITDA</th>
                  <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Part. receita</th>
                </tr>
              </thead>
              <tbody>
                {agregados.map((a) => (
                  <tr key={a.produtoId} className="border-t">
                    <td className="px-4 py-1.5">{a.produto}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(a.volume, 0)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(a.ticketMedio, 2)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(a.receita, 0)}</td>
                    <td
                      className={
                        a.ebitda < 0
                          ? "px-3 py-1.5 text-right tabular-nums text-destructive"
                          : "px-3 py-1.5 text-right tabular-nums"
                      }
                    >
                      {fmtNum(a.ebitda, 0)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtPctTable(a.margemEbitda)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtPctTable(a.participacao)}</td>
                  </tr>
                ))}
                {!agregados.length ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                      Nenhum produto cadastrado nas premissas.
                    </td>
                  </tr>
                ) : (
                  <tr className="border-t bg-muted/40 font-semibold">
                    <td className="px-4 py-1.5">Total</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {fmtNum(agregados.reduce((s, a) => s + a.volume, 0), 0)}
                    </td>
                    <td className="px-3 py-1.5 text-right">—</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(totalReceita, 0)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtNum(totalEbitda, 0)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtPctTable(safeDiv(totalEbitda, totalReceita))}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{fmtPctTable(1)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Provas reais do modelo</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {provas.map((p) => (
            <div
              key={p.chave}
              className={
                p.ok
                  ? "rounded-lg border border-emerald-600/30 bg-emerald-600/5 p-4"
                  : "rounded-lg border border-destructive/40 bg-destructive/5 p-4"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">{p.titulo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.descricao}</p>
                </div>
                <Badge variant={p.ok ? "default" : "destructive"} className={p.ok ? "bg-emerald-600 hover:bg-emerald-600" : ""}>
                  {p.ok ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <XCircle className="mr-1 h-3 w-3" />}
                  {p.ok ? "OK" : "Erro"}
                </Badge>
              </div>
              <p className={p.ok ? "mt-2 text-xs text-muted-foreground" : "mt-2 text-xs font-medium text-destructive"}>
                {p.detalhe}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
