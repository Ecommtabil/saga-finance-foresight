import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { useSaga } from "@/lib/saga/context";
import {
  calcularValuation, calcularWACC, margens, projetarFCFF,
} from "@/lib/saga/calculations";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dcf-explicado")({
  head: () => ({
    meta: [
      { title: "DCF Explicado — SAGA" },
      { name: "description", content: "Entenda passo a passo o método de Fluxo de Caixa Descontado e como WACC, g e margem operacional impactam o Enterprise Value e o Equity Value." },
      { property: "og:title", content: "DCF Explicado — SAGA" },
      { property: "og:description", content: "Tutorial interativo do Valuation por DCF." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DcfExplicadoPage,
});

function DcfExplicadoPage() {
  const { dados, empresa } = useSaga();
  const moeda = empresa?.moeda ?? "R$";

  if (!dados)
    return (
      <>
        <PageHeader titulo="DCF Explicado" />
        <EmptyState titulo="Importe os dados para explorar o DCF passo a passo" />
      </>
    );

  const baseWacc = calcularWACC(dados.premissas);
  const baseG = dados.premissas.crescimentoPerp;
  const baseCresc = dados.premissas.crescimentoProj;
  const baseMargem = margens(dados).operacional[4];

  const [wacc, setWacc] = useState(baseWacc);
  const [g, setG] = useState(baseG);
  const [cresc, setCresc] = useState(baseCresc);
  const [margem, setMargem] = useState(baseMargem);

  const base = calcularValuation(dados);
  const sim = calcularValuation(dados, wacc, g, cresc, margem);
  const proj = projetarFCFF(dados, cresc, 5);

  // Curva de sensibilidade individual: varia UMA premissa por vez
  const rangeWacc = Array.from({ length: 21 }, (_, i) => Math.max(0.03, baseWacc - 0.05 + i * 0.005));
  const curvaWacc = rangeWacc.map((w) => ({ x: w, equity: calcularValuation(dados, w, g, cresc, margem).equity }));
  const rangeG = Array.from({ length: 21 }, (_, i) => Math.max(0, baseG - 0.02 + i * 0.002));
  const curvaG = rangeG.map((gg) => ({ x: gg, equity: calcularValuation(dados, wacc, gg, cresc, margem).equity }));
  const rangeMargem = Array.from({ length: 21 }, (_, i) => Math.max(0, baseMargem - 0.10 + i * 0.01));
  const curvaMargem = rangeMargem.map((m) => ({ x: m, equity: calcularValuation(dados, wacc, g, cresc, m).equity }));

  const bridge = [
    { name: "VP FCFF", value: sim.vpSum, color: "var(--chart-1)" },
    { name: "VP Valor Terminal", value: sim.vpVt, color: "var(--chart-2)" },
    { name: "Enterprise Value", value: sim.ev, color: "var(--primary)" },
    { name: "(+) Caixa", value: sim.caixa, color: "var(--chart-4)" },
    { name: "(−) Dívida", value: -sim.divida, color: "var(--chart-3)" },
    { name: "Equity Value", value: sim.equity, color: "var(--accent)" },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        titulo="DCF Explicado"
        subtitulo="Um tour interativo pelo método de Fluxo de Caixa Descontado — mova os sliders e observe o efeito em cada etapa."
      />

      {/* Controles ancorados */}
      <Card className="border-primary/40">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Premissas Interativas</span>
            <Badge variant="outline">ao vivo</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-2">
          <SliderRow label="WACC (custo de capital)" value={wacc} baseValue={baseWacc} min={0.03} max={0.30} step={0.001} onChange={setWacc} format={fmtPct} />
          <SliderRow label="g — crescimento na perpetuidade" value={g} baseValue={baseG} min={0} max={0.08} step={0.001} onChange={setG} format={fmtPct} />
          <SliderRow label="Crescimento projetado (5 anos)" value={cresc} baseValue={baseCresc} min={-0.10} max={0.30} step={0.005} onChange={setCresc} format={fmtPct} />
          <SliderRow label="Margem operacional (EBIT / Receita)" value={margem} baseValue={baseMargem} min={-0.10} max={0.50} step={0.005} onChange={setMargem} format={fmtPct} />
        </CardContent>
      </Card>

      {/* Passo 1 */}
      <Step numero={1} titulo="Projete o FCFF (Fluxo de Caixa Livre para a Firma)">
        <p>
          O DCF começa projetando quanto caixa a operação vai gerar nos próximos anos, <b>antes</b> de pagar credores e sócios.
          Partimos do EBIT, aplicamos impostos, somamos depreciação (não é saída de caixa) e descontamos <i>CAPEX</i> e variação de capital de giro.
        </p>
        <Formula>FCFF = EBIT × (1 − t) + Depreciação − CAPEX − Δ Capital de Giro</Formula>
        <p className="text-sm text-muted-foreground">
          Duas premissas moldam essa projeção: o <b>crescimento projetado</b> (quanto a receita cresce ao ano) e a <b>margem operacional</b>
          (quanto de cada real de receita vira EBIT). Aumente qualquer uma delas e cada barra abaixo sobe.
        </p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={proj.anos.map((a, i) => ({ ano: a, fcff: proj.fcff[i] }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="ano" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(x: number) => fmtNum(x)} />
              <Tooltip formatter={(x: number) => `${moeda} ${fmtNum(x)}`} />
              <Bar dataKey="fcff" fill="var(--chart-1)" name="FCFF projetado" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Step>

      {/* Passo 2 */}
      <Step numero={2} titulo="Traga cada FCFF a valor presente pelo WACC">
        <p>
          Um real amanhã vale menos que um real hoje. O <b>WACC</b> é a taxa que representa o custo médio de capital da empresa
          (média ponderada entre custo do equity e da dívida, líquido de impostos). Usamos o WACC para descontar cada FCFF futuro:
        </p>
        <Formula>VP(FCFF₍t₎) = FCFF₍t₎ / (1 + WACC)ᵗ</Formula>
        <p className="text-sm">
          <b>Impacto:</b> WACC ↑ → denominador maior → valores presentes menores → EV cai.
          É a relação mais poderosa do modelo. Veja abaixo como o Equity varia só mexendo no WACC:
        </p>
        <SensitivityChart data={curvaWacc} current={wacc} label="WACC" moeda={moeda} />
      </Step>

      {/* Passo 3 */}
      <Step numero={3} titulo="Calcule o Valor Terminal (perpetuidade)">
        <p>
          Depois do horizonte explícito (5 anos), assumimos que a empresa continua gerando caixa <i>para sempre</i>,
          crescendo a uma taxa modesta <b>g</b> (tipicamente próxima da inflação de longo prazo). O valor terminal é uma perpetuidade de Gordon:
        </p>
        <Formula>VT = FCFF₍5₎ × (1 + g) / (WACC − g)</Formula>
        <p className="text-sm">
          <b>Impacto:</b> g ↑ aumenta o VT (numerador maior e denominador menor), e o VT costuma ser <b>50–80% do EV</b>.
          Mas g nunca pode chegar perto do WACC — a fórmula explode. É por isso que g é uma premissa delicada.
        </p>
        <SensitivityChart data={curvaG} current={g} label="g" moeda={moeda} />
      </Step>

      {/* Passo 4 */}
      <Step numero={4} titulo="Some tudo → Enterprise Value">
        <p>
          O <b>Enterprise Value</b> é a soma dos valores presentes dos FCFFs explícitos com o valor presente do VT.
          É quanto vale a <b>operação inteira</b>, independentemente de como está financiada.
        </p>
        <Formula>EV = Σ VP(FCFF) + VP(VT)</Formula>
      </Step>

      {/* Passo 5 */}
      <Step numero={5} titulo="Da firma para o acionista → Equity Value">
        <p>
          O acionista fica com o que sobra depois de pagar os credores. Somamos o caixa (que é do acionista) e subtraímos a dívida:
        </p>
        <Formula>Equity Value = EV + Caixa − Dívida</Formula>
        <p className="text-sm">
          Também é onde a <b>margem operacional</b> aparece mais claramente — margens maiores viram FCFFs maiores, que viram EV maior, que vira Equity maior.
        </p>
        <SensitivityChart data={curvaMargem} current={margem} label="Margem" moeda={moeda} />

        <div className="mt-6 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={bridge} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" fontSize={11} stroke="var(--muted-foreground)" />
              <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(x: number) => fmtNum(x)} />
              <Tooltip formatter={(x: number) => `${moeda} ${fmtNum(x)}`} />
              <Bar dataKey="value">
                {bridge.map((b, i) => <Cell key={i} fill={b.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Step>

      {/* Resumo */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader><CardTitle>Cenário atual × cenário base</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <Resumo label="Enterprise Value" v={`${moeda} ${fmtNum(sim.ev)}`} baseV={`${moeda} ${fmtNum(base.ev)}`} delta={sim.ev - base.ev} />
          <Resumo label="Equity Value" v={`${moeda} ${fmtNum(sim.equity)}`} baseV={`${moeda} ${fmtNum(base.equity)}`} delta={sim.equity - base.equity} highlight />
          <Resumo label="VP Valor Terminal" v={`${moeda} ${fmtNum(sim.vpVt)}`} baseV={`${moeda} ${fmtNum(base.vpVt)}`} delta={sim.vpVt - base.vpVt} />
          <Resumo label="VP FCFF explícito" v={`${moeda} ${fmtNum(sim.vpSum)}`} baseV={`${moeda} ${fmtNum(base.vpSum)}`} delta={sim.vpSum - base.vpSum} />
        </CardContent>
      </Card>

      {/* Cheat sheet */}
      <Card>
        <CardHeader><CardTitle>Regras de bolso</CardTitle></CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <Regra sinal="↑ WACC" efeito="↓↓ EV e Equity" motivo="Desconta mais tudo, inclusive o VT (que é grande)." />
          <Regra sinal="↑ g" efeito="↑↑ EV e Equity" motivo="Aumenta a perpetuidade — cuidado ao se aproximar do WACC." />
          <Regra sinal="↑ Margem" efeito="↑ EV e Equity" motivo="Cada real de receita vira mais FCFF; impacto proporcional." />
          <Regra sinal="↑ Crescimento projetado" efeito="↑ EV" motivo="FCFFs maiores nos 5 anos explícitos." />
          <Regra sinal="↑ Dívida" efeito="↓ Equity (EV igual)" motivo="EV é da firma; Equity é o que sobra ao acionista." />
          <Regra sinal="↑ Caixa" efeito="↑ Equity (EV igual)" motivo="Caixa é do acionista e entra na ponte EV → Equity." />
        </CardContent>
      </Card>
    </div>
  );
}

function Step({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {numero}
          </span>
          <span>{titulo}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/50 px-4 py-3 font-mono text-sm">
      {children}
    </div>
  );
}

function SliderRow({
  label, value, baseValue, min, max, step, onChange, format,
}: {
  label: string; value: number; baseValue: number; min: number; max: number; step: number;
  onChange: (n: number) => void; format: (n: number) => string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="tabular-nums text-sm">
          <span className="font-semibold">{format(value)}</span>
          <span className="ml-2 text-xs text-muted-foreground">base {format(baseValue)}</span>
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={step} onValueChange={(v) => onChange(v[0])} />
    </div>
  );
}

function SensitivityChart({
  data, current, label, moeda,
}: { data: { x: number; equity: number }[]; current: number; label: string; moeda: string }) {
  return (
    <div className="mt-4 h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="x"
            fontSize={11}
            stroke="var(--muted-foreground)"
            tickFormatter={(x: number) => fmtPct(x)}
            label={{ value: label, position: "insideBottom", offset: -2, fontSize: 11 }}
          />
          <YAxis fontSize={11} stroke="var(--muted-foreground)" tickFormatter={(x: number) => fmtNum(x)} />
          <Tooltip
            formatter={(x: number) => `${moeda} ${fmtNum(x)}`}
            labelFormatter={(x: number) => `${label} = ${fmtPct(x)}`}
          />
          <Legend />
          <Line type="monotone" dataKey="equity" stroke="var(--primary)" strokeWidth={2} dot={false} name="Equity Value" />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-1 text-center text-xs text-muted-foreground">
        Atualmente em <b>{fmtPct(current)}</b>
      </div>
    </div>
  );
}

function Resumo({
  label, v, baseV, delta, highlight,
}: { label: string; v: string; baseV: string; delta: number; highlight?: boolean }) {
  const up = delta >= 0;
  return (
    <div className={cn("rounded-md border p-3", highlight && "border-primary/40 bg-background")}>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-lg font-semibold tabular-nums", highlight && "text-primary")}>{v}</div>
      <div className="text-xs text-muted-foreground">base {baseV}</div>
      <div className={cn("mt-1 text-xs font-medium tabular-nums", up ? "text-emerald-700" : "text-destructive")}>
        {up ? "▲" : "▼"} {fmtNum(Math.abs(delta))}
      </div>
    </div>
  );
}

function Regra({ sinal, efeito, motivo }: { sinal: string; efeito: string; motivo: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="font-mono">{sinal}</Badge>
        <span className="font-semibold">{efeito}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{motivo}</p>
    </div>
  );
}