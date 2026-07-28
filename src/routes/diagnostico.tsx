import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { useSaga } from "@/lib/saga/context";
import {
  margens,
  indicadoresLiquidez,
  indicadoresEndividamento,
  indicadoresRentabilidade,
} from "@/lib/saga/calculations";
import { fmtPct, fmtMult, safeDiv } from "@/lib/saga/formatters";
import { gerarDiagnosticoPDF, type DiagSecao } from "@/lib/saga/diagnostico-pdf";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — SAGA" },
      { name: "description", content: "Diagnóstico financeiro consolidado: lucratividade, gestão e endividamento." },
      { property: "og:title", content: "Diagnóstico — SAGA" },
      { property: "og:description", content: "Painel de diagnóstico com semáforo de saúde financeira." },
    ],
  }),
  component: DiagnosticoPage,
});

type Status = "bom" | "atencao" | "ruim" | "neutro";

function classificar(valor: number, bom: number, atencao: number, maiorMelhor = true): Status {
  if (!isFinite(valor)) return "neutro";
  if (maiorMelhor) {
    if (valor >= bom) return "bom";
    if (valor >= atencao) return "atencao";
    return "ruim";
  }
  if (valor <= bom) return "bom";
  if (valor <= atencao) return "atencao";
  return "ruim";
}

const STATUS_STYLE: Record<Status, { dot: string; label: string; text: string }> = {
  bom: { dot: "bg-emerald-500", label: "Saudável", text: "text-emerald-700" },
  atencao: { dot: "bg-amber-500", label: "Atenção", text: "text-amber-700" },
  ruim: { dot: "bg-red-500", label: "Crítico", text: "text-red-700" },
  neutro: { dot: "bg-muted-foreground", label: "—", text: "text-muted-foreground" },
};

const STATUS_SCORE: Record<Status, number | null> = {
  bom: 100,
  atencao: 60,
  ruim: 20,
  neutro: null,
};

function classificarScore(score: number): {
  letra: string;
  rotulo: string;
  cor: string;
  anel: string;
  faixa: string;
} {
  if (score >= 85)
    return {
      letra: "A",
      rotulo: "Excelente",
      cor: "text-emerald-700",
      anel: "stroke-emerald-500",
      faixa: "bg-emerald-50 border-emerald-200",
    };
  if (score >= 70)
    return {
      letra: "B",
      rotulo: "Saudável",
      cor: "text-emerald-700",
      anel: "stroke-emerald-500",
      faixa: "bg-emerald-50 border-emerald-200",
    };
  if (score >= 55)
    return {
      letra: "C",
      rotulo: "Atenção",
      cor: "text-amber-700",
      anel: "stroke-amber-500",
      faixa: "bg-amber-50 border-amber-200",
    };
  if (score >= 40)
    return {
      letra: "D",
      rotulo: "Frágil",
      cor: "text-orange-700",
      anel: "stroke-orange-500",
      faixa: "bg-orange-50 border-orange-200",
    };
  return {
    letra: "E",
    rotulo: "Crítico",
    cor: "text-red-700",
    anel: "stroke-red-500",
    faixa: "bg-red-50 border-red-200",
  };
}

function scoreSecao(cards: { status: Status }[]): number | null {
  const vals = cards
    .map((c) => STATUS_SCORE[c.status])
    .filter((v): v is number => v !== null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function ScoreGauge({ score }: { score: number }) {
  const c = classificarScore(score);
  const size = 168;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          className="fill-none stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ - dash}`}
          className={`fill-none ${c.anel} transition-all`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-4xl font-bold tabular-nums ${c.cor}`}>
          {Math.round(score)}
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          de 100
        </span>
      </div>
    </div>
  );
}

function ScoreSummary({
  secoes,
  pesos,
  onPesosChange,
}: {
  secoes: { titulo: string; cards: { status: Status }[] }[];
  pesos: number[];
  onPesosChange: (i: number, v: number) => void;
}) {
  const secoesScore = secoes.map((s) => ({
    titulo: s.titulo,
    score: scoreSecao(s.cards),
  }));
  const pares = secoesScore
    .map((s, i) => ({ score: s.score, peso: pesos[i] ?? 0 }))
    .filter((p): p is { score: number; peso: number } => p.score !== null);
  const somaPesosAtivos = pares.reduce((a, b) => a + b.peso, 0);
  const overall =
    somaPesosAtivos > 0
      ? pares.reduce((acc, p) => acc + p.score * p.peso, 0) / somaPesosAtivos
      : 0;
  const c = classificarScore(overall);
  const totalCards = secoes.reduce((acc, s) => acc + s.cards.length, 0);
  const cont = { bom: 0, atencao: 0, ruim: 0, neutro: 0 } as Record<Status, number>;
  secoes.forEach((s) => s.cards.forEach((k) => (cont[k.status] += 1)));
  const totalPesos = pesos.reduce((a, b) => a + b, 0);

  return (
    <Card className={`overflow-hidden border ${c.faixa}`}>
      <CardContent className="p-6">
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3">
            <ScoreGauge score={overall} />
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-md bg-white text-lg font-bold shadow-sm ${c.cor}`}
              >
                {c.letra}
              </span>
              <span className={`text-sm font-semibold ${c.cor}`}>{c.rotulo}</span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Score Financeiro Consolidado
              </div>
              <p className="mt-1 text-sm text-foreground/80">
                Nota geral calculada a partir de <b>{totalCards}</b> indicadores nas
                três dimensões do diagnóstico, ponderada pelos pesos ajustáveis
                abaixo. Cada indicador contribui conforme seu status: Saudável
                (100), Atenção (60) e Crítico (20).
              </p>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> {cont.bom} saudáveis
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500" /> {cont.atencao} em atenção
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> {cont.ruim} críticos
                </span>
                {cont.neutro > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground" /> {cont.neutro} indisponíveis
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {secoesScore.map((s, i) => {
                const sc = s.score ?? 0;
                const cs = classificarScore(sc);
                const pesoRel = totalPesos > 0 ? (pesos[i] / totalPesos) * 100 : 0;
                return (
                  <div key={s.titulo} className="rounded-md border bg-white p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        {s.titulo}
                      </span>
                      <span className={`text-xs font-semibold ${cs.cor}`}>
                        {cs.letra}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className={`text-xl font-bold tabular-nums ${cs.cor}`}>
                        {s.score !== null ? Math.round(sc) : "—"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/100</span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${
                          sc >= 70
                            ? "bg-emerald-500"
                            : sc >= 55
                              ? "bg-amber-500"
                              : sc >= 40
                                ? "bg-orange-500"
                                : "bg-red-500"
                        }`}
                        style={{ width: `${Math.max(0, Math.min(100, sc))}%` }}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{cs.rotulo}</span>
                      <span className="tabular-nums">peso {pesoRel.toFixed(0)}%</span>
                    </div>
                    <div className="mt-2">
                      <Slider
                        value={[pesos[i]]}
                        min={0}
                        max={100}
                        step={1}
                        onValueChange={(v) => onPesosChange(i, v[0])}
                        aria-label={`Peso ${s.titulo}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Ajuste os pesos conforme a prioridade do seu negócio.</span>
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  onPesosChange(0, 34);
                  onPesosChange(1, 33);
                  onPesosChange(2, 33);
                }}
              >
                Redefinir pesos
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function IndicadorCard({
  titulo,
  valor,
  status,
  interpretacao,
  referencia,
  delta,
  deltaLabel,
  pctPoints,
}: {
  titulo: string;
  valor: string;
  status: Status;
  interpretacao: string;
  referencia: string;
  delta?: number;
  deltaLabel?: string;
  pctPoints?: boolean;
}) {
  const s = STATUS_STYLE[status];
  const hasDelta = delta !== undefined && isFinite(delta);
  const deltaPositive = hasDelta && delta! > 0.0001;
  const deltaNegative = hasDelta && delta! < -0.0001;
  const DeltaIcon = deltaPositive ? TrendingUp : deltaNegative ? TrendingDown : Minus;
  const deltaText = hasDelta
    ? pctPoints
      ? `${delta! > 0 ? "+" : ""}${(delta! * 100).toFixed(1)} p.p.`
      : `${delta! > 0 ? "+" : ""}${delta!.toFixed(2)}`
    : null;
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {titulo}
          </CardTitle>
          <span className={`flex items-center gap-1.5 text-[10px] font-medium ${s.text}`}>
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-2xl font-semibold tabular-nums">{valor}</div>
          {hasDelta && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${
                deltaPositive
                  ? "text-emerald-700"
                  : deltaNegative
                    ? "text-red-700"
                    : "text-muted-foreground"
              }`}
              title={deltaLabel}
            >
              <DeltaIcon className="h-3 w-3" />
              {deltaText}
            </span>
          )}
        </div>
        {deltaLabel && hasDelta && (
          <p className="mt-0.5 text-[10px] text-muted-foreground">{deltaLabel}</p>
        )}
        <p className="mt-2 text-xs text-foreground/80">{interpretacao}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Referência: {referencia}
        </p>
      </CardContent>
    </Card>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
        {titulo}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function DiagnosticoPage() {
  const { dados, modo, empresa } = useSaga();
  const anosDisponiveis = dados?.anos ?? [];
  const [anoSelecionado, setAnoSelecionado] = useState<number | null>(
    anosDisponiveis.length ? anosDisponiveis[anosDisponiveis.length - 1] : null,
  );
  const [pesos, setPesos] = useState<number[]>([34, 33, 33]);
  const atualizarPeso = (i: number, v: number) =>
    setPesos((prev) => prev.map((p, idx) => (idx === i ? v : p)));
  if (!dados) {
    return (
      <>
        <PageHeader titulo="Diagnóstico" />
        <EmptyState titulo="Diagnóstico indisponível" />
      </>
    );
  }

  const idx = Math.max(
    0,
    dados.anos.indexOf(anoSelecionado ?? dados.anos[dados.anos.length - 1]),
  );
  const prev = idx > 0 ? idx - 1 : null;
  const anoAtual = dados.anos[idx];
  const anoAnterior = prev !== null ? dados.anos[prev] : null;
  const deltaLabel = anoAnterior !== null ? `vs ${anoAnterior}` : undefined;
  const m = margens(dados);
  const rent = indicadoresRentabilidade(dados);
  const liq = indicadoresLiquidez(dados);
  const end = indicadoresEndividamento(dados);

  const mBruta = m.bruta[idx];
  const mEbitda = m.ebitda[idx];
  const mOp = m.operacional[idx];
  const mLiq = m.liquida[idx];

  const roe = rent.roe[idx];
  const roa = rent.roa[idx];
  const roic = rent.roic[idx];
  const giroFor = (i: number) =>
    dados.balanco
      ? safeDiv(dados.dre.receitaLiquida[i], dados.balanco.ativoTotal[i])
      : NaN;
  const giroAtivo = giroFor(idx);

  const divPL = end?.dividaSobrePL[idx] ?? NaN;
  const divAtivo = end?.dividaSobreAtivo[idx] ?? NaN;
  const cobJuros = end?.coberturaJuros[idx] ?? NaN;
  const liqCorr = liq?.corrente[idx] ?? NaN;

  const d = (curr: number, prevVal: number | undefined) =>
    prev === null || prevVal === undefined || !isFinite(prevVal) || !isFinite(curr)
      ? undefined
      : curr - prevVal;

  const secoes: DiagSecao[] = [
    {
      titulo: "Lucratividade",
      cards: [
        {
          titulo: "Margem Bruta",
          valor: fmtPct(mBruta),
          status: classificar(mBruta, 0.4, 0.2),
          delta: d(mBruta, prev !== null ? m.bruta[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            mBruta >= 0.4
              ? "Boa eficiência na produção/entrega, sobra saudável após CMV."
              : mBruta >= 0.2
                ? "Margem apertada — revisar custos diretos e política de preços."
                : "Margem crítica — o CMV consome quase toda a receita.",
          referencia: "≥ 40% saudável • 20–40% atenção",
        },
        {
          titulo: "Margem EBITDA",
          valor: fmtPct(mEbitda),
          status: classificar(mEbitda, 0.15, 0.08),
          delta: d(mEbitda, prev !== null ? m.ebitda[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            mEbitda >= 0.15
              ? "Geração de caixa operacional consistente."
              : mEbitda >= 0.08
                ? "Caixa operacional limitado — controle despesas fixas."
                : "Operação pressiona o caixa; risco de sustentabilidade.",
          referencia: "≥ 15% saudável • 8–15% atenção",
        },
        {
          titulo: "Margem Operacional",
          valor: fmtPct(mOp),
          status: classificar(mOp, 0.1, 0.04),
          delta: d(mOp, prev !== null ? m.operacional[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            mOp >= 0.1
              ? "Operação rentável mesmo após depreciação."
              : mOp >= 0.04
                ? "Rentabilidade operacional baixa — avaliar eficiência."
                : "Operação não cobre estrutura — revisão urgente.",
          referencia: "≥ 10% saudável • 4–10% atenção",
        },
        {
          titulo: "Margem Líquida",
          valor: fmtPct(mLiq),
          status: classificar(mLiq, 0.08, 0.03),
          delta: d(mLiq, prev !== null ? m.liquida[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            mLiq >= 0.08
              ? "Cada real de receita gera lucro final relevante."
              : mLiq >= 0.03
                ? "Lucro final apertado — pouca folga para reinvestir."
                : "Resultado final crítico ou negativo.",
          referencia: "≥ 8% saudável • 3–8% atenção",
        },
      ],
    },
    {
      titulo: "Gestão",
      cards: [
        {
          titulo: "ROE",
          valor: fmtPct(roe),
          status: classificar(roe, 0.15, 0.08),
          delta: d(roe, prev !== null ? rent.roe[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            roe >= 0.15
              ? "Excelente retorno sobre o capital do sócio."
              : roe >= 0.08
                ? "Retorno moderado — comparar com custo de oportunidade."
                : "Retorno baixo para o risco do negócio.",
          referencia: "≥ 15% saudável • 8–15% atenção",
        },
        {
          titulo: "ROA",
          valor: fmtPct(roa),
          status: classificar(roa, 0.08, 0.04),
          delta: d(roa, prev !== null ? rent.roa[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            roa >= 0.08
              ? "Ativos bem aproveitados na geração de lucro."
              : roa >= 0.04
                ? "Aproveitamento parcial dos ativos."
                : "Ativos ociosos ou pouco produtivos.",
          referencia: "≥ 8% saudável • 4–8% atenção",
        },
        {
          titulo: "ROIC",
          valor: fmtPct(roic),
          status: classificar(roic, 0.12, 0.06),
          delta: d(roic, prev !== null ? rent.roic[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao:
            roic >= 0.12
              ? "Capital investido gera valor acima do custo típico."
              : roic >= 0.06
                ? "Retorno próximo do custo de capital — atenção."
                : "Destruição de valor: retorno abaixo do custo de capital.",
          referencia: "≥ 12% saudável • 6–12% atenção",
        },
        {
          titulo: "Giro do Ativo",
          valor: isFinite(giroAtivo) ? fmtMult(giroAtivo, 2) : "—",
          status: classificar(giroAtivo, 1, 0.5),
          delta: d(giroAtivo, prev !== null ? giroFor(prev) : undefined),
          deltaLabel,
          interpretacao: !isFinite(giroAtivo)
            ? "Disponível apenas no modo Contabilidade Completa."
            : giroAtivo >= 1
              ? "Ativos giram bem e sustentam a receita."
              : giroAtivo >= 0.5
                ? "Giro médio — parte do ativo pouco produtiva."
                : "Ativos pesados frente à receita gerada.",
          referencia: "≥ 1,0x saudável • 0,5–1,0x atenção",
        },
      ],
    },
    {
      titulo: "Endividamento",
      cards: [
        {
          titulo: "Dívida / PL",
          valor: isFinite(divPL) ? fmtMult(divPL, 2) : "—",
          status: classificar(divPL, 0.5, 1, false),
          delta: d(divPL, prev !== null ? end?.dividaSobrePL[prev] : undefined),
          deltaLabel,
          interpretacao: !isFinite(divPL)
            ? "Disponível apenas no modo Contabilidade Completa."
            : divPL <= 0.5
              ? "Estrutura pouco alavancada, boa folga financeira."
              : divPL <= 1
                ? "Alavancagem moderada — monitorar prazos."
                : "Alta dependência de dívida frente ao capital próprio.",
          referencia: "≤ 0,5x saudável • 0,5–1,0x atenção",
        },
        {
          titulo: "Dívida / Ativo",
          valor: isFinite(divAtivo) ? fmtPct(divAtivo) : "—",
          status: classificar(divAtivo, 0.3, 0.5, false),
          delta: d(divAtivo, prev !== null ? end?.dividaSobreAtivo[prev] : undefined),
          deltaLabel,
          pctPoints: true,
          interpretacao: !isFinite(divAtivo)
            ? "Disponível apenas no modo Contabilidade Completa."
            : divAtivo <= 0.3
              ? "Baixa participação de dívida na estrutura de ativos."
              : divAtivo <= 0.5
                ? "Alavancagem média sobre os ativos."
                : "Ativos majoritariamente financiados por dívida.",
          referencia: "≤ 30% saudável • 30–50% atenção",
        },
        {
          titulo: "Cobertura de Juros",
          valor: isFinite(cobJuros) ? fmtMult(cobJuros, 2) : "—",
          status: classificar(cobJuros, 3, 1.5),
          delta: d(cobJuros, prev !== null ? end?.coberturaJuros[prev] : undefined),
          deltaLabel,
          interpretacao: !isFinite(cobJuros)
            ? "Disponível apenas no modo Contabilidade Completa."
            : cobJuros >= 3
              ? "EBIT cobre folgadamente as despesas financeiras."
              : cobJuros >= 1.5
                ? "Cobertura apertada — vulnerável a alta de juros."
                : "EBIT insuficiente para cobrir os juros.",
          referencia: "≥ 3,0x saudável • 1,5–3,0x atenção",
        },
        {
          titulo: "Liquidez Corrente",
          valor: isFinite(liqCorr) ? fmtMult(liqCorr, 2) : "—",
          status: classificar(liqCorr, 1.5, 1),
          delta: d(liqCorr, prev !== null ? liq?.corrente[prev] : undefined),
          deltaLabel,
          interpretacao: !isFinite(liqCorr)
            ? "Disponível apenas no modo Contabilidade Completa."
            : liqCorr >= 1.5
              ? "Curto prazo confortável para honrar obrigações."
              : liqCorr >= 1
                ? "Curto prazo equilibrado, sem folga relevante."
                : "Passivo circulante maior que o ativo circulante.",
          referencia: "≥ 1,5x saudável • 1,0–1,5x atenção",
        },
      ],
    },
  ];

  const exportar = () => {
    gerarDiagnosticoPDF({
      empresa: empresa?.nome || "Empresa",
      anoBase: anoAtual,
      secoes,
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Diagnóstico"
        subtitulo={`Leitura do período ${anoAtual}${anoAnterior !== null ? ` (variações vs ${anoAnterior})` : ""}.`}
        action={
          <div className="flex items-center gap-2">
            <Select
              value={String(anoAtual)}
              onValueChange={(v) => setAnoSelecionado(Number(v))}
            >
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {anosDisponiveis.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={exportar} size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </div>
        }
      />

      <ScoreSummary secoes={secoes} pesos={pesos} onPesosChange={atualizarPeso} />

      {secoes.map((sec) => (
        <Secao key={sec.titulo} titulo={sec.titulo}>
          {sec.cards.map((c) => (
            <IndicadorCard
              key={c.titulo}
              titulo={c.titulo}
              valor={c.valor}
              status={c.status}
              interpretacao={c.interpretacao}
              referencia={c.referencia}
              delta={c.delta}
              deltaLabel={c.deltaLabel}
              pctPoints={c.pctPoints}
            />
          ))}
        </Secao>
      ))}

      {modo === "basica" && (
        <p className="text-xs text-muted-foreground">
          Alguns indicadores de gestão e endividamento exigem o Balanço Patrimonial (modo Contabilidade Completa).
        </p>
      )}
    </div>
  );
}