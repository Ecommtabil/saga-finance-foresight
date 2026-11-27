import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { FinancialTable } from "@/components/saga/FinancialTable";
import { useSaga } from "@/lib/saga/context";
import {
  margens,
  indicadoresLiquidez,
  indicadoresEndividamento,
  indicadoresRentabilidade,
  cicloCaixa,
  crescimento,
} from "@/lib/saga/calculations";
import { fmtPct, fmtMult, fmtNum, fmtPctTable, fmtMoney } from "@/lib/saga/formatters";
import { safeDiv } from "@/lib/saga/formatters";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { cn } from "@/lib/utils";

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
  const gradId = `grad-${titulo.replace(/\W+/g, "")}`;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
              <defs>
                {series.map((s, idx) => (
                  <linearGradient key={s.name} id={`${gradId}-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="ano"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tickFormatter={(v: number) => (pct ? fmtPctTable(v / 100, 0) : fmtNum(v, 1))}
              />
              <Tooltip
                cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  boxShadow: "0 8px 24px -12px rgba(0,0,0,0.18)",
                  fontSize: 12,
                }}
                formatter={(v: number) => (pct ? fmtPctTable(v / 100, 1) : fmtNum(v, 2))}
              />
              <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              {series.map((s, idx) => (
                <Area
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={s.color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  fill={`url(#${gradId}-${idx})`}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--card)" }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface LinhaPE {
  label: string;
  real: number;
  pe: number;
  bold?: boolean;
  indent?: boolean;
  av?: number; // % sobre a receita líquida no PE
}

function DREPontoEquilibrio({
  dados,
  anoIdx,
}: {
  dados: import("@/lib/saga/types").DadosImportados;
  anoIdx: number;
}) {
  const rl = dados.dre.receitaLiquida[anoIdx] ?? 0;
  const bruta = dados.dre.receitaBruta[anoIdx] ?? 0;
  const deducoes = Math.abs(dados.dre.deducoes[anoIdx] ?? 0);
  const cmv = Math.abs(dados.dre.cmv[anoIdx] ?? 0);
  const despFixas = Math.abs(dados.dre.despOperacionais[anoIdx] ?? 0);
  const ano = dados.anos[anoIdx];

  const mcPct = safeDiv(rl - cmv, rl);
  const peValor = mcPct > 0 ? despFixas / mcPct : 0;
  const fatorPE = rl > 0 ? peValor / rl : 0;

  const linhas: LinhaPE[] = [
    { label: "Receita Bruta", real: bruta, pe: bruta * fatorPE, av: safeDiv(bruta * fatorPE, peValor) },
    {
      label: "(-) Deduções",
      real: deducoes,
      pe: deducoes * fatorPE,
      indent: true,
      av: safeDiv(deducoes * fatorPE, peValor),
    },
    { label: "= Receita Líquida", real: rl, pe: peValor, bold: true, av: 1 },
    {
      label: "(-) Custos Variáveis (CMV)",
      real: cmv,
      pe: peValor * safeDiv(cmv, rl || 1),
      indent: true,
      av: safeDiv(cmv, rl),
    },
    {
      label: "= Margem de Contribuição",
      real: rl - cmv,
      pe: despFixas,
      bold: true,
      av: mcPct,
    },
    {
      label: "(-) Custos Fixos (Despesas Operacionais)",
      real: despFixas,
      pe: despFixas,
      indent: true,
      av: safeDiv(despFixas, peValor),
    },
    { label: "= Resultado (Lucro Operacional)", real: rl - cmv - despFixas, pe: 0, bold: true, av: 0 },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          DRE do Ponto de Equilíbrio ({ano})
          <InfoTooltip text="Mostra como ficaria a DRE no exato ponto de equilíbrio do ano selecionado: a receita cai ao nível em que a margem de contribuição cobre apenas os custos fixos e o resultado zera. A coluna Real traz a DRE importada, para comparar a folga (ou o déficit) de cada conta." />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Conta (R$)</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">Real {ano}</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">No Ponto de Equilíbrio</th>
                <th className="px-4 py-2 text-right font-semibold text-muted-foreground">% da Receita (PE)</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr
                  key={l.label}
                  className={cn(
                    "border-t",
                    l.bold && "bg-muted/30 font-semibold",
                    i % 2 === 1 && !l.bold && "bg-muted/10",
                  )}
                >
                  <td className={cn("px-4 py-2", l.indent && "pl-8")}>{l.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span className={l.real < 0 ? "text-destructive" : undefined}>{fmtNum(l.real, 0)}</span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmtNum(l.pe, 0)}</td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums text-muted-foreground">
                    {l.av === undefined ? "—" : fmtPctTable(l.av)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {mcPct <= 0 && (
          <p className="mt-2 text-xs text-destructive">
            Não é possível calcular o ponto de equilíbrio neste ano: a margem de contribuição é nula ou negativa.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MargemContribuicao({ dados, anoIdx }: { dados: import("@/lib/saga/types").DadosImportados; anoIdx: number }) {
  const rl = dados.dre.receitaLiquida[anoIdx] ?? 0;
  const cmv = Math.abs(dados.dre.cmv[anoIdx] ?? 0);
  const despFixas = Math.abs(dados.dre.despOperacionais[anoIdx] ?? 0);

  // Premissa simplificada: CMV/CPV é o custo variável; despesas operacionais são fixas.
  const mc = rl - cmv;
  const mcPct = safeDiv(mc, rl);
  const peValor = mcPct > 0 ? despFixas / mcPct : 0;

  const margemSeguranca = peValor > 0 ? (rl - peValor) / rl : 0;
  const cobertura = peValor > 0 ? rl / peValor : 0;

  const chartData = dados.anos.map((a, i) => {
    const r = dados.dre.receitaLiquida[i] ?? 0;
    const mcp = safeDiv(r - Math.abs(dados.dre.cmv[i] ?? 0), r);
    const pe = mcp > 0 ? Math.abs(dados.dre.despOperacionais[i] ?? 0) / mcp : 0;
    return { ano: a, Receita: r, "Ponto de equilíbrio": pe };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Margem de Contribuição e Ponto de Equilíbrio</h2>
        <InfoTooltip text="Premissa simplificada: o CMV/CPV é tratado como custo variável e as despesas operacionais como fixas. Margem de contribuição = Receita líquida − CMV. Ponto de equilíbrio = Despesas fixas ÷ Margem de contribuição (%)." />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Kpi titulo="Margem de Contribuição" valor={fmtMoney(mc)} sub={`${fmtPct(mcPct)} da receita líquida`} />
        <Kpi
          titulo="Ponto de Equilíbrio"
          valor={fmtMoney(peValor)}
          sub="Receita necessária para cobrir as despesas fixas"
        />
        <Kpi
          titulo="Margem de Segurança"
          valor={fmtPct(margemSeguranca)}
          sub={margemSeguranca >= 0 ? "Receita acima do equilíbrio" : "Receita abaixo do equilíbrio"}
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            Receita líquida vs. ponto de equilíbrio
            <InfoTooltip text="Barras: receita líquida de cada ano. Linha: ponto de equilíbrio. Quando a barra supera a linha, a empresa lucra; abaixo, opera com prejuízo." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Cobertura do ponto de equilíbrio ({dados.anos[anoIdx]})</span>
              <span className="font-medium text-foreground">{fmtPct(cobertura)}</span>
            </div>
            <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${cobertura >= 1 ? "bg-emerald-500" : "bg-red-500"}`}
                style={{ width: `${Math.min(100, Math.max(0, cobertura * 100))}%` }}
              />
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.6} />
                <XAxis dataKey="ano" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickMargin={4} tickFormatter={(v: number) => fmtNum(v, 1)} />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                  contentStyle={{
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    boxShadow: "0 8px 24px -12px rgba(0,0,0,0.18)",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmtMoney(v)}
                />
                <Legend iconType="plainline" wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="Receita" fill="var(--chart-1)" radius={[6, 6, 0, 0]} maxBarSize={56} />
                <Bar dataKey="Ponto de equilíbrio" fill="var(--chart-3)" radius={[6, 6, 0, 0]} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DREPontoEquilibrio dados={dados} anoIdx={anoIdx} />
    </div>
  );
}

function IndicadoresPage() {
  const { dados, modo } = useSaga();
  const [anoBase, setAnoBase] = useState<number | null>(null);
  if (!dados) return <><PageHeader titulo="Indicadores" /><EmptyState titulo="Indicadores indisponíveis" /></>;

  const completa = modo === "completa" && !!dados.balanco;
  const m = margens(dados);
  const liq = completa ? indicadoresLiquidez(dados) : null;
  const end = completa ? indicadoresEndividamento(dados) : null;
  const rent = completa ? indicadoresRentabilidade(dados) : null;
  const ciclo = completa ? cicloCaixa(dados) : null;
  const cresc = crescimento(dados);
  const anoSel = anoBase ?? dados.anos[dados.anos.length - 1];
  const last = Math.max(0, dados.anos.indexOf(anoSel));

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Indicadores Financeiros"
        subtitulo={`Período base: ${dados.anos[last]} · evolução em ${dados.anos.length} anos.`}
        action={
          <Select value={String(dados.anos[last])} onValueChange={(v) => setAnoBase(Number(v))}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              {dados.anos.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="grid gap-3 md:grid-cols-4">
        <Kpi titulo="Margem Líquida" valor={fmtPct(m.liquida[last])} sub="Ano base" />
        {rent && <Kpi titulo="ROE" valor={fmtPct(rent.roe[last])} sub="Ano base" />}
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
        {rent && (
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
        )}
        {liq && (
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
        {end && (
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
        {ciclo && (
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

      <div>
        <h2 className="mb-3 text-lg font-semibold">Margens</h2>
        <FinancialTable
          anos={dados.anos}
          moeda="%"
          rows={[
            { label: "Margem Bruta", values: m.bruta, isPct: true },
            { label: "Margem EBITDA", values: m.ebitda, isPct: true },
            { label: "Margem Operacional", values: m.operacional, isPct: true },
            { label: "Margem Líquida", values: m.liquida, isPct: true, bold: true },
          ]}
        />
      </div>

      <MargemContribuicao dados={dados} anoIdx={last} />

      {liq && end && (
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