import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  X,
  FileDown,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Scatter,
  ScatterChart,
  ZAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { useSaga } from "@/lib/saga/context";
import {
  baixarPlanilhaModeloEstatistica,
  parsePlanilhaEstatistica,
  descritiva,
  regLinear,
  correlacaoS,
  volatilidadeS,
  mediaMovel,
  histograma,
  retornos,
  glossarioMetricas,
} from "@/lib/saga/stats";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";
import { gerarRelatorioEstatisticasPDF } from "@/lib/saga/stats-pdf";

function Interpretacao({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-md border-l-4 border-primary bg-primary/5 p-3 text-sm leading-relaxed text-foreground">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">
        Interpretação
      </div>
      {children}
    </div>
  );
}

export const Route = createFileRoute("/estatisticas")({
  head: () => ({
    meta: [
      { title: "Análises Estatísticas — SAGA" },
      { name: "description", content: "Módulo estatístico com importação própria e ranges customizáveis." },
      { property: "og:title", content: "Análises Estatísticas — SAGA" },
      { property: "og:description", content: "Descritiva, tendência, correlação, volatilidade, média móvel e histograma." },
    ],
  }),
  component: EstPage,
});

const shortName = (n: string) => (n.includes("—") ? n.split("—").pop()!.trim() : n);

const CORES = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#7FA3C7",
  "#C85450",
  "#9B87C4",
];

function EstPage() {
  const { statsDataset, setStatsDataset } = useSaga();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (file: File) => {
    setErro(null);
    setCarregando(true);
    try {
      const ds = await parsePlanilhaEstatistica(file);
      setStatsDataset(ds);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao processar planilha.");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Inteligência de Dados do Negócio"
        subtitulo="Transforme os números da sua operação em decisões — importe sua planilha e explore o período que quiser."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Base de dados do seu negócio
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Baixe o modelo, preencha com os números da sua empresa (receita, custos, despesas, volume — em qualquer periodicidade)
            e envie de volta. Esta área funciona <strong>de forma independente</strong> do restante do SAGA para você
            analisar cenários e recortes sem afetar as demais telas.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => baixarPlanilhaModeloEstatistica()}>
              <Download className="h-4 w-4 mr-2" /> Baixar Planilha Modelo
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                if (fileRef.current) fileRef.current.value = "";
              }}
            />
            <Button onClick={() => fileRef.current?.click()} disabled={carregando}>
              {carregando ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {statsDataset ? "Substituir dados" : "Enviar planilha"}
            </Button>
            {statsDataset && (
              <Button variant="ghost" onClick={() => setStatsDataset(null)}>
                <X className="h-4 w-4 mr-2" /> Limpar
              </Button>
            )}
          </div>
          {statsDataset && (
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="secondary">{statsDataset.nomeArquivo ?? "arquivo.xlsx"}</Badge>
              <Badge variant="secondary">{statsDataset.periodos.length} períodos</Badge>
              <Badge variant="secondary">{statsDataset.series.length} séries</Badge>
            </div>
          )}
          {erro && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Erro na importação</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {statsDataset ? (
        <Analises dataset={statsDataset} />
      ) : (
        <Alert>
          <FileSpreadsheet className="h-4 w-4" />
              <AlertTitle>Ainda não há dados carregados</AlertTitle>
          <AlertDescription>
            Envie sua planilha para desbloquear análises de desempenho, tendências, sazonalidade, relação entre indicadores e comportamento de resultados período a período.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Analises({ dataset }: { dataset: import("@/lib/saga/stats").DatasetEstatistico }) {
  const { empresa } = useSaga();
  const total = dataset.periodos.length;
  const [range, setRange] = useState<[number, number]>([0, total - 1]);
  const [serieFoco, setSerieFoco] = useState<string>(dataset.series[0]?.nome ?? "");
  const [janela, setJanela] = useState<number>(Math.min(3, total));

  const [ini, fim] = range;
  const periodos = dataset.periodos.slice(ini, fim + 1);

  const series = useMemo(
    () => dataset.series.map((s) => ({ nome: s.nome, valores: s.valores.slice(ini, fim + 1) })),
    [dataset, ini, fim],
  );

  const foco = series.find((s) => s.nome === serieFoco) ?? series[0];
  const reg = useMemo(() => (foco ? regLinear(foco.valores) : null), [foco]);
  const mm = useMemo(
    () => (foco ? mediaMovel(foco.valores, Math.max(2, Math.min(janela, foco.valores.length))) : []),
    [foco, janela],
  );
  const hist = useMemo(() => (foco ? histograma(foco.valores, 8) : []), [foco]);
  const rets = useMemo(() => (foco ? retornos(foco.valores) : []), [foco]);

  // --- Variáveis exibidas nos gráficos de faixas e crescimento ---
  const [varsSel, setVarsSel] = useState<string[] | null>(null);
  const varsAtivas = useMemo(() => {
    const nomes = varsSel ?? (foco ? [foco.nome] : []);
    const escolhidas = series.filter((s) => nomes.includes(s.nome));
    return escolhidas.length ? escolhidas : foco ? [foco] : [];
  }, [varsSel, series, foco]);
  const toggleVar = (nome: string) => {
    setVarsSel((prev) => {
      const base = prev ?? (foco ? [foco.nome] : []);
      return base.includes(nome) ? base.filter((n) => n !== nome) : [...base, nome];
    });
  };

  // --- Drilldowns ---
  const [drillFaixa, setDrillFaixa] = useState<{ serie: string; faixa: string; idx: number } | null>(null);
  const [drillPeriodo, setDrillPeriodo] = useState<{ periodo: string; idx: number } | null>(null);

  const detalheFaixa = useMemo(() => {
    if (!drillFaixa) return null;
    const s = series.find((x) => x.nome === drillFaixa.serie);
    if (!s) return null;
    const vals = s.valores.filter((v) => Number.isFinite(v));
    if (vals.length < 2) return null;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const step = (max - min || 1) / 8;
    const itens = s.valores
      .map((v, i) => ({ periodo: periodos[i], valor: v, i }))
      .filter(
        (o) =>
          Number.isFinite(o.valor) &&
          Math.min(7, Math.floor((o.valor - min) / step)) === drillFaixa.idx,
      );
    const media = itens.length ? itens.reduce((a, b) => a + b.valor, 0) / itens.length : 0;
    return { itens, media, participacao: itens.length / (vals.length || 1) };
  }, [drillFaixa, series, periodos]);

  const detalhePeriodo = useMemo(() => {
    if (!drillPeriodo) return null;
    const i = drillPeriodo.idx; // índice do período atual dentro do recorte
    return varsAtivas.map((s) => {
      const atual = s.valores[i];
      const anterior = s.valores[i - 1];
      const delta = atual - anterior;
      const pct = anterior ? delta / Math.abs(anterior) : 0;
      return { nome: shortName(s.nome), atual, anterior, delta, pct };
    });
  }, [drillPeriodo, varsAtivas]);

  const crescData = useMemo(() => {
    const linhas: Record<string, number | string>[] = [];
    for (let i = 1; i < periodos.length; i++) {
      const linha: Record<string, number | string> = { periodo: periodos[i], idx: i };
      for (const s of varsAtivas) {
        const ant = s.valores[i - 1];
        const at = s.valores[i];
        linha[shortName(s.nome)] =
          Number.isFinite(ant) && Number.isFinite(at) && ant ? (at - ant) / Math.abs(ant) : 0;
      }
      linhas.push(linha);
    }
    return linhas;
  }, [periodos, varsAtivas]);

  const chartFoco = periodos.map((p, i) => ({
    periodo: p,
    valor: foco?.valores[i] ?? null,
    tendencia: reg?.yPred[i] ?? null,
    mm: Number.isFinite(mm[i]) ? mm[i] : null,
  }));

  const [corrSelecionadas, setCorrSelecionadas] = useState<string[] | null>(null);
  const corrSeries = useMemo(() => {
    if (!corrSelecionadas) return series;
    const set = new Set(corrSelecionadas);
    const filtradas = series.filter((s) => set.has(s.nome));
    return filtradas.length >= 2 ? filtradas : series;
  }, [series, corrSelecionadas]);
  const corrMatrix = corrSeries.map((a) =>
    corrSeries.map((b) => correlacaoS(a.valores, b.valores)),
  );
  const toggleCorr = (nome: string) => {
    setCorrSelecionadas((prev) => {
      const base = prev ?? series.map((s) => s.nome);
      return base.includes(nome) ? base.filter((n) => n !== nome) : [...base, nome];
    });
  };

  // --- Regressão bivariada (Y vs X) ---
  const [xSerie, setXSerie] = useState<string>(dataset.series[0]?.nome ?? "");
  const [ySerie, setYSerie] = useState<string>(dataset.series[1]?.nome ?? dataset.series[0]?.nome ?? "");
  const serieX = series.find((s) => s.nome === xSerie) ?? series[0];
  const serieY = series.find((s) => s.nome === ySerie) ?? series[Math.min(1, series.length - 1)];
  const bivar = useMemo(() => {
    if (!serieX || !serieY) return null;
    const pts: { x: number; y: number; periodo: string }[] = [];
    const n = Math.min(serieX.valores.length, serieY.valores.length);
    for (let i = 0; i < n; i++) {
      const x = serieX.valores[i];
      const y = serieY.valores[i];
      if (Number.isFinite(x) && Number.isFinite(y)) {
        pts.push({ x, y, periodo: periodos[i] });
      }
    }
    if (pts.length < 2) return { pts, slope: 0, intercept: 0, r2: 0, r: 0, linha: [] as { x: number; y: number }[] };
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
    const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const slope = den ? num / den : 0;
    const intercept = my - slope * mx;
    const ssTot = pts.reduce((s, p) => s + (p.y - my) ** 2, 0);
    const ssRes = pts.reduce((s, p) => s + (p.y - (intercept + slope * p.x)) ** 2, 0);
    const r2 = ssTot ? 1 - ssRes / ssTot : 0;
    const r = correlacaoS(pts.map((p) => p.x), pts.map((p) => p.y));
    const xs = pts.map((p) => p.x);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const linha = [
      { x: xMin, y: intercept + slope * xMin },
      { x: xMax, y: intercept + slope * xMax },
    ];
    return { pts, slope, intercept, r2, r, linha };
  }, [serieX, serieY, periodos]);

  const fmtCoef = (v: number) => {
    const abs = Math.abs(v);
    const d = abs === 0 ? 2 : abs < 1 ? 4 : abs < 100 ? 2 : 0;
    return v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  const equacao = bivar
    ? `y = ${fmtCoef(bivar.slope)} · x ${bivar.intercept >= 0 ? "+" : "−"} ${fmtCoef(Math.abs(bivar.intercept))}`
    : "";

  const amostraFraca = fim - ini + 1 < 8;

  // --- Interpretações dinâmicas ---
  const focoDesc = foco ? descritiva(foco.valores) : null;
  const focoVol = foco ? volatilidadeS(foco.valores) : 0;
  const cvLabel = focoDesc
    ? focoDesc.cv < 0.15 ? "baixa" : focoDesc.cv < 0.35 ? "moderada" : "alta"
    : "";
  const tendDir = reg ? (reg.slope > 0 ? "de alta" : reg.slope < 0 ? "de queda" : "estável") : "";
  const r2Label = reg
    ? reg.r2 > 0.7 ? "forte" : reg.r2 > 0.4 ? "moderado" : "fraco"
    : "";
  const retMedio = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : 0;
  const retPos = rets.filter((v) => v > 0).length;
  const retNeg = rets.filter((v) => v < 0).length;
  const histTop = hist.length
    ? hist.reduce((a, b) => (b.freq > a.freq ? b : a), hist[0])
    : null;
  const histTotal = hist.reduce((s, b) => s + b.freq, 0);
  // par mais correlacionado (excluindo diagonal)
  let maxAbs = 0;
  let maxPar: { a: string; b: string; v: number } | null = null;
  for (let i = 0; i < corrSeries.length; i++) {
    for (let j = i + 1; j < corrSeries.length; j++) {
      const v = corrMatrix[i][j];
      if (Math.abs(v) > maxAbs) {
        maxAbs = Math.abs(v);
        maxPar = { a: shortName(corrSeries[i].nome), b: shortName(corrSeries[j].nome), v };
      }
    }
  }

  // --- Narrativa de causa e efeito (top pares) ---
  type Par = { a: string; b: string; v: number };
  const paresRanqueados: Par[] = [];
  for (let i = 0; i < corrSeries.length; i++) {
    for (let j = i + 1; j < corrSeries.length; j++) {
      const v = corrMatrix[i][j];
      if (!Number.isFinite(v)) continue;
      paresRanqueados.push({
        a: shortName(corrSeries[i].nome),
        b: shortName(corrSeries[j].nome),
        v,
      });
    }
  }
  paresRanqueados.sort((x, y) => Math.abs(y.v) - Math.abs(x.v));
  const topPares = paresRanqueados.filter((p) => Math.abs(p.v) >= 0.4).slice(0, 5);

  const hipotese = (p: Par) => {
    const forca = Math.abs(p.v) > 0.7 ? "forte" : "moderada";
    if (p.v >= 0) {
      return `Quando ${p.a} cresce, ${p.b} tende a crescer junto (relação ${forca}). Hipótese: ${p.a} pode estar puxando ${p.b} — vale testar se aumentar ${p.a} de forma controlada gera mais ${p.b}.`;
    }
    return `Quando ${p.a} sobe, ${p.b} tende a cair (relação inversa ${forca}). Hipótese: pode haver relação de eficiência, substituição ou trade-off entre ${p.a} e ${p.b} — investigue se um está roubando espaço do outro.`;
  };
  const comoValidar = (p: Par) => {
    const passos = [
      `Isole o efeito: rode um recorte curto (ex.: 1–2 meses) mudando apenas ${p.a} e observando ${p.b}, com o resto da operação estável.`,
      `Compare com um período de referência sem essa alteração para separar sazonalidade e efeitos externos.`,
      `Enriqueça a base: adicione variáveis de contexto (calendário promocional, campanhas ativas, sazonalidade do setor, câmbio, feriados) para descartar causas escondidas.`,
      `Aumente a granularidade: se hoje analisa mensal, tente semanal ou diário — relações reais tendem a aparecer também no curto prazo.`,
      `Segmente: quebre por canal, praça, produto ou cliente e veja se a relação se mantém em todos os cortes ou só em alguns.`,
    ];
    return passos;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recorte de análise
            <InfoTooltip text="Escolha o intervalo de tempo que quer estudar (ex.: últimos 12 meses, um trimestre específico), o indicador principal em foco e a janela da média móvel (nº de períodos usados para suavizar oscilações e enxergar a tendência sem ruído). Trocar o recorte recalcula tudo abaixo automaticamente." />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Período inicial</Label>
            <Select value={String(ini)} onValueChange={(v) => setRange([Number(v), Math.max(Number(v), fim)])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {dataset.periodos.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Período final</Label>
            <Select value={String(fim)} onValueChange={(v) => setRange([Math.min(Number(v), ini), Number(v)])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {dataset.periodos.map((p, i) => (
                  <SelectItem key={i} value={String(i)}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Indicador em foco</Label>
            <Select value={foco?.nome} onValueChange={setSerieFoco}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {series.map((s) => (
                  <SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">Suavização (média móvel)</Label>
            <Input
              type="number"
              min={2}
              max={periodos.length}
              value={janela}
              onChange={(e) => setJanela(Math.max(2, Number(e.target.value) || 2))}
            />
          </div>
        </CardContent>
      </Card>

      {amostraFraca && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Poucos períodos no recorte ({fim - ini + 1})</AlertTitle>
          <AlertDescription>
            Com menos de 8 períodos os resultados servem de indicação, mas não de conclusão. Amplie o intervalo para ganhar confiança nas leituras.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Radar de desempenho — visão geral dos indicadores
            <InfoTooltip text="Panorama de cada indicador no período escolhido. Passe o mouse sobre os cabeçalhos da tabela para entender cada métrica." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Indicador</th>
                <th className="p-2 text-right">Períodos</th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Média <InfoTooltip text={glossarioMetricas.media} />
                  </span>
                </th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Mediana <InfoTooltip text={glossarioMetricas.mediana} />
                  </span>
                </th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Desvio <InfoTooltip text={glossarioMetricas.desvio} />
                  </span>
                </th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    CV <InfoTooltip text={glossarioMetricas.cv} />
                  </span>
                </th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Pior <InfoTooltip text={glossarioMetricas.pior} />
                  </span>
                </th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Melhor <InfoTooltip text={glossarioMetricas.melhor} />
                  </span>
                </th>
                <th className="p-2 text-right">
                  <span className="inline-flex items-center justify-end gap-1">
                    Oscilação % <InfoTooltip text={glossarioMetricas.oscilacao} />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const e = descritiva(s.valores);
                const nomeCurto = shortName(s.nome);
                return (
                  <tr key={s.nome} className="border-t">
                    <td className="p-2 font-medium">{nomeCurto}</td>
                    <td className="p-2 text-right tabular-nums">{e.n}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.media)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.mediana)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.desvio)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtPct(e.cv)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.min)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.max)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtPct(volatilidadeS(s.valores))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {focoDesc && (
            <Interpretacao>
              <strong>{shortName(foco?.nome ?? "")}</strong> apresenta desempenho médio de{" "}
              <strong>{fmtNum(focoDesc.media)}</strong> e mediana de{" "}
              <strong>{fmtNum(focoDesc.mediana)}</strong>
              {Math.abs(focoDesc.media - focoDesc.mediana) / (Math.abs(focoDesc.media) || 1) > 0.15
                ? " — a diferença mostra que existem meses fora da curva puxando o resultado médio (vale investigar picos ou quedas pontuais)."
                : " — média e mediana próximas indicam desempenho consistente ao longo do período."}{" "}
              A oscilação relativa (CV) é de <strong>{fmtPct(focoDesc.cv)}</strong>, ou seja, previsibilidade{" "}
              <strong>{cvLabel === "baixa" ? "alta" : cvLabel === "alta" ? "baixa" : "média"}</strong>. A variação típica de um período para outro é de{" "}
              <strong>{fmtPct(focoVol)}</strong>
              {focoVol > 0.2 ? " — resultado instável, difícil de prever sem planejamento." : " — comportamento estável, favorece previsões e metas."}.
            </Interpretacao>
          )}
          <div className="mt-5 rounded-lg border bg-muted/30 p-4">
            <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-3">
              Dicionário rápido das métricas
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
              {Object.entries(glossarioMetricas).map(([chave, texto]) => (
                <div key={chave} className="flex gap-2">
                  <span className="font-semibold text-primary min-w-[90px] shrink-0 capitalize">
                    {chave === "cv" ? "CV" : chave}
                  </span>
                  <span className="text-muted-foreground leading-snug">{texto}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {shortName(foco?.nome ?? "")} — evolução, tendência e comportamento suavizado
            <InfoTooltip text="Área azul: resultado real de cada período. Linha tracejada: tendência de fundo (para onde o indicador está caminhando, ignorando oscilações). Linha contínua: média móvel — suaviza altos e baixos para revelar o comportamento sustentado. Ganho/perda por período: quanto o indicador tende a variar a cada novo mês/trimestre. Aderência (R²): o quanto essa tendência explica o comportamento real (100% = trajetória muito clara; próximo de 0% = comportamento errático)." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reg && (
            <div className="grid gap-4 md:grid-cols-3 text-sm mb-4">
              <Metric label="Ganho médio por período" value={fmtNum(reg.slope, 2)} />
              <Metric label="Valor de partida" value={fmtNum(reg.intercept, 2)} />
              <Metric label="Aderência da tendência (R²)" value={fmtPct(reg.r2, 1)} />
            </div>
          )}
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartFoco} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gValor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                <Legend />
                <Area type="monotone" dataKey="valor" name="Valor" stroke="var(--primary)" strokeWidth={2.5} fill="url(#gValor)" />
                <Line type="monotone" dataKey="tendencia" name="Tendência de fundo" stroke="var(--chart-3)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="mm" name={`Média móvel (${janela} períodos)`} stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {reg && (
            <Interpretacao>
              O indicador está em trajetória <strong>{tendDir === "de alta" ? "de crescimento" : tendDir === "de queda" ? "de retração" : "estável"}</strong>, ganhando/perdendo em média{" "}
              <strong>{fmtNum(reg.slope, 2)}</strong> a cada período. A aderência de{" "}
              <strong>{fmtPct(reg.r2, 1)}</strong> mostra que essa trajetória é <strong>{r2Label === "forte" ? "clara e consistente" : r2Label === "moderado" ? "visível, mas com oscilações" : "pouco definida"}</strong> —{" "}
              {reg.r2 > 0.7
                ? "dá para planejar e projetar com boa segurança seguindo essa direção."
                : reg.r2 > 0.4
                  ? "existe direção, mas o resultado varia bastante — vale acompanhar de perto e olhar a média móvel."
                  : "os resultados oscilam demais para confiar em uma trajetória; olhe a média móvel e busque as causas da instabilidade."}
            </Interpretacao>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            Variáveis nos gráficos de faixas e crescimento
            <InfoTooltip text="Selecione quantas variáveis quiser para comparar lado a lado nos gráficos de Faixas de resultado e Crescimento período a período. Clique em qualquer barra dos gráficos para abrir o detalhamento (drill-down) daquele ponto." />
          </CardTitle>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Selecionar variáveis ({varsAtivas.length}/{series.length})
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 max-h-80 overflow-y-auto space-y-2">
              <div className="flex gap-2 pb-2 border-b">
                <Button variant="ghost" size="sm" onClick={() => setVarsSel(series.map((s) => s.nome))}>
                  Todas
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setVarsSel(foco ? [foco.nome] : [])}>
                  Só o foco
                </Button>
              </div>
              {series.map((s) => (
                <label key={s.nome} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={varsAtivas.some((v) => v.nome === s.nome)}
                    onCheckedChange={() => toggleVar(s.nome)}
                  />
                  <span>{shortName(s.nome)}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {varsAtivas.map((s, i) => (
            <Badge key={s.nome} variant="secondary" className="gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: CORES[i % CORES.length] }}
              />
              {shortName(s.nome)}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Faixas de resultado
              <InfoTooltip text="Agrupa os períodos em 8 faixas de valor e mostra em quantos meses/trimestres cada variável ficou em cada faixa. Clique em uma barra para ver exatamente quais períodos compõem aquela faixa." />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {varsAtivas.map((s, vi) => {
              const h = histograma(s.valores, 8);
              return (
                <div key={s.nome}>
                  <div className="text-xs font-semibold text-muted-foreground mb-1">
                    {shortName(s.nome)}
                  </div>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={h}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                        <XAxis dataKey="faixa" tickLine={false} axisLine={false} fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} />
                        <YAxis tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                        <Bar
                          dataKey="freq"
                          name="Quantidade de períodos"
                          fill={CORES[vi % CORES.length]}
                          radius={[4, 4, 0, 0]}
                          cursor="pointer"
                          onClick={(_d: unknown, idx: number) =>
                            setDrillFaixa({ serie: s.nome, faixa: h[idx]?.faixa ?? "", idx })
                          }
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Clique em uma barra para ver os períodos que compõem a faixa.
            </p>
            {histTop && histTotal > 0 && (
              <Interpretacao>
                O resultado típico está na faixa <strong>{histTop.faixa}</strong>, presente em{" "}
                <strong>{fmtPct(histTop.freq / histTotal, 0)}</strong> dos períodos analisados.{" "}
                {histTop.freq / histTotal > 0.4
                  ? "Comportamento previsível — a operação entrega resultados dentro de uma faixa dominante, o que facilita metas e planejamento."
                  : "Comportamento disperso — os resultados variam bastante entre períodos, sinal de que a operação ainda depende de fatores instáveis."}
              </Interpretacao>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Crescimento período a período
              <InfoTooltip text="Quanto cada variável cresceu ou caiu (%) em relação ao período anterior. Barras positivas = crescimento; negativas = retração. Clique em uma barra para abrir o detalhamento daquele período com todas as variáveis selecionadas." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crescData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => fmtPct(v, 0)} />
                  <Tooltip formatter={(v: number) => fmtPct(v, 2)} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                  <Legend />
                  {varsAtivas.map((s, vi) => (
                    <Bar
                      key={s.nome}
                      dataKey={shortName(s.nome)}
                      name={shortName(s.nome)}
                      radius={[4, 4, 0, 0]}
                      fill={CORES[vi % CORES.length]}
                      cursor="pointer"
                      onClick={(d: { payload?: { periodo: string; idx: number } }) =>
                        d?.payload &&
                        setDrillPeriodo({ periodo: d.payload.periodo, idx: d.payload.idx })
                      }
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Clique em uma barra para abrir o detalhamento do período.
            </p>
            {rets.length > 0 && (
              <Interpretacao>
                Crescimento médio de <strong>{fmtPct(retMedio, 2)}</strong> por período, com{" "}
                <strong>{retPos}</strong> período(s) de alta e <strong>{retNeg}</strong> de queda no recorte.{" "}
                {retPos > retNeg * 1.5
                  ? "Ciclo predominantemente positivo — a operação vem entregando crescimento sustentado."
                  : retNeg > retPos * 1.5
                    ? "Ciclo predominantemente negativo — atenção: a operação vem perdendo tração."
                    : "Ciclo equilibrado — altas e quedas se alternam, indicando operação em ritmo estável ou dependente de sazonalidade."}
              </Interpretacao>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Relação de causa e efeito — como um indicador impacta o outro
            <InfoTooltip text="Escolha o indicador que você acredita ser a causa (X, ex.: investimento em marketing) e o que sofre o efeito (Y, ex.: receita). Cada ponto é um período. A reta mostra a relação média entre os dois. Impacto médio (coef. angular) = quanto Y muda para cada unidade a mais de X. Explicação (R²) = quanto de Y é explicado por X (100% = X sozinho basta; 0% = outros fatores dominam). Força da relação (r): −1 a +1." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Causa (X) — o que você controla</Label>
              <Select value={serieX?.nome} onValueChange={setXSerie}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {series.map((s) => (
                    <SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Efeito (Y) — o resultado esperado</Label>
              <Select value={serieY?.nome} onValueChange={setYSerie}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {series.map((s) => (
                    <SelectItem key={s.nome} value={s.nome}>{s.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {bivar && bivar.pts.length >= 2 ? (
            <>
              <div className="grid gap-4 md:grid-cols-4 text-sm">
                <Metric label="Equação" value={equacao} />
                <Metric label="Impacto médio (Δ Y por 1 de X)" value={fmtCoef(bivar.slope)} />
                <Metric label="Explicação (R²)" value={fmtPct(bivar.r2, 1)} />
                <Metric label="Força da relação (r)" value={bivar.r.toFixed(2)} />
              </div>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.5} />
                    <XAxis
                      type="number"
                      dataKey="x"
                      name={serieX?.nome}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      domain={["dataMin", "dataMax"]}
                      label={{ value: serieX?.nome, position: "insideBottom", offset: -5, fontSize: 11 }}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name={serieY?.nome}
                      tickLine={false}
                      axisLine={false}
                      fontSize={12}
                      label={{ value: serieY?.nome, angle: -90, position: "insideLeft", fontSize: 11 }}
                    />
                    <ZAxis range={[80, 80]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }}
                      formatter={(v: number) => fmtNum(v, 2)}
                      labelFormatter={() => ""}
                    />
                    <Legend />
                    <Scatter name="Períodos observados" data={bivar.pts} fill="var(--primary)" />
                    <Scatter
                      name={`Relação estimada — ${equacao}`}
                      data={bivar.linha}
                      line={{ stroke: "var(--chart-3)", strokeWidth: 2 }}
                      lineType="joint"
                      shape={() => <g />}
                      legendType="line"
                    />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              <Interpretacao>
                Cada unidade adicional de <strong>{shortName(serieX?.nome ?? "")}</strong> tende a{" "}
                {bivar.slope >= 0 ? "somar" : "reduzir"} em média{" "}
                <strong>{fmtCoef(Math.abs(bivar.slope))}</strong> em{" "}
                <strong>{shortName(serieY?.nome ?? "")}</strong>. A explicação de{" "}
                <strong>{fmtPct(bivar.r2, 1)}</strong> significa que{" "}
                {bivar.r2 > 0.7
                  ? "esse indicador é uma alavanca importante do resultado — mexer nele muda o placar."
                  : bivar.r2 > 0.4
                    ? "ele influencia o resultado, mas outros fatores também pesam — não é o único gargalo/alavanca."
                    : "ele explica pouco do resultado — mexer só nele provavelmente não move a agulha; busque outras causas."}{" "}
                A força da relação (r = <strong>{bivar.r.toFixed(2)}</strong>) é{" "}
                <strong>
                  {Math.abs(bivar.r) > 0.7 ? "forte" : Math.abs(bivar.r) > 0.4 ? "moderada" : "fraca"}
                </strong>
                . Importante: relação estatística é uma <em>pista</em> de gestão, não prova de causa — valide no dia a dia da operação antes de decidir grandes mudanças.
              </Interpretacao>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Poucos dados para analisar</AlertTitle>
              <AlertDescription>
                Escolha dois indicadores com pelo menos 2 períodos preenchidos em comum dentro do recorte.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              Mapa de relacionamentos entre indicadores
              <InfoTooltip text="Mostra como cada par de indicadores do seu negócio se movimenta em conjunto. Varia de −1 a +1: perto de +1 = sobem e caem juntos (ex.: marketing e receita); perto de −1 = quando um sobe o outro cai (ex.: eficiência e custo); perto de 0 = não há relação clara. Azul mais escuro = relação positiva forte; vermelho mais escuro = relação inversa forte. Ajuda a mapear alavancas e gargalos — lembre-se: correlação sinaliza padrão, não prova causa." />
            </CardTitle>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  Indicadores ({corrSeries.length}/{series.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase text-muted-foreground">Indicadores no mapa</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setCorrSelecionadas(series.map((s) => s.nome))}
                    >Todas</Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setCorrSelecionadas([])}
                    >Nenhuma</Button>
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {series.map((s) => {
                    const marcada = corrSeries.some((c) => c.nome === s.nome) &&
                      (corrSelecionadas === null || corrSelecionadas.includes(s.nome));
                    return (
                      <label key={s.nome} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          checked={marcada}
                          onCheckedChange={() => toggleCorr(s.nome)}
                        />
                        <span className="truncate">{shortName(s.nome)}</span>
                      </label>
                    );
                  })}
                </div>
                {corrSelecionadas && corrSelecionadas.length < 2 && (
                  <p className="mt-2 text-xs text-muted-foreground">Selecione pelo menos 2 indicadores — mostrando todos.</p>
                )}
              </PopoverContent>
            </Popover>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2"></th>
                {corrSeries.map((s) => <th key={s.nome} className="p-2 text-right text-muted-foreground">{shortName(s.nome)}</th>)}
              </tr>
            </thead>
            <tbody>
              {corrSeries.map((row, i) => (
                <tr key={row.nome} className="border-t">
                  <td className="p-2 font-medium text-muted-foreground">{shortName(row.nome)}</td>
                  {corrMatrix[i].map((v, j) => (
                    <td
                      key={j}
                      className={cn("p-2 text-right tabular-nums")}
                      style={{
                        backgroundColor: `color-mix(in oklab, ${v >= 0 ? "var(--primary)" : "var(--destructive)"} ${Math.round(Math.abs(v) * 60)}%, transparent)`,
                        color: Math.abs(v) > 0.6 ? "white" : undefined,
                      }}
                    >
                      {v.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {maxPar && corrSeries.length > 1 && (
            <Interpretacao>
              O par com maior conexão é <strong>{maxPar.a}</strong> ×{" "}
              <strong>{maxPar.b}</strong>, com força de <strong>{maxPar.v.toFixed(2)}</strong>{" "}
              — relação{" "}
              <strong>
                {Math.abs(maxPar.v) > 0.7 ? "forte" : Math.abs(maxPar.v) > 0.4 ? "moderada" : "fraca"}
              </strong>{" "}
              {maxPar.v >= 0 ? "no mesmo sentido" : "em sentido oposto"}
              {Math.abs(maxPar.v) > 0.7
                ? maxPar.v > 0
                  ? " — quando um cresce, o outro tende a acompanhar; boa dupla para acompanhar em conjunto."
                  : " — quando um sobe, o outro cai; possível relação de eficiência ou substituição, vale investigar."
                : Math.abs(maxPar.v) > 0.4
                  ? " — existe influência, mas outros fatores também pesam."
                  : " — sem padrão claro entre os dois indicadores no período."}
              . Use como <em>hipótese</em> de gestão e valide na operação.
            </Interpretacao>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              Narrativa de causa e efeito — hipóteses de negócio
              <InfoTooltip text="A partir das relações mais fortes do mapa de correlações (|r| ≥ 0,4), o SAGA transforma cada par em uma hipótese de gestão em linguagem de negócio e sugere passos práticos para validar com dados adicionais antes de tomar decisão. Correlação sinaliza padrão — a validação confirma (ou descarta) a causa." />
            </CardTitle>
            <Button
              size="sm"
              onClick={() =>
                gerarRelatorioEstatisticasPDF({
                  empresa: empresa?.nome || "Empresa",
                  arquivo: dataset.nomeArquivo,
                  periodoInicial: dataset.periodos[ini] ?? "",
                  periodoFinal: dataset.periodos[fim] ?? "",
                  totalPeriodos: fim - ini + 1,
                  totalSeries: corrSeries.length,
                  seriesNomes: corrSeries.map((s) => shortName(s.nome)),
                  corrMatrix,
                  paresNarrativa: topPares,
                  hipotese,
                  comoValidar,
                })
              }
            >
              <FileDown className="h-4 w-4 mr-2" /> Exportar PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {topPares.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Sem relações fortes o suficiente no recorte atual</AlertTitle>
              <AlertDescription>
                Nenhum par de indicadores selecionados atingiu força mínima (|r| ≥ 0,40) para gerar uma hipótese confiável. Amplie o intervalo de análise, inclua mais indicadores no mapa ou revise o preenchimento da planilha.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Cada bloco abaixo lê um par de indicadores fortemente relacionados no seu recorte e propõe uma <strong>hipótese de negócio</strong> + um roteiro de <strong>validação com dados adicionais</strong>. Use como ponto de partida da conversa com a operação — não como veredito.
              </p>
              <div className="space-y-4">
                {topPares.map((p, idx) => {
                  const forca = Math.abs(p.v) > 0.7 ? "forte" : "moderada";
                  const sentido = p.v >= 0 ? "mesmo sentido" : "sentido oposto";
                  return (
                    <div
                      key={`${p.a}-${p.b}-${idx}`}
                      className="rounded-lg border p-4 space-y-3 bg-card"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">#{idx + 1}</Badge>
                        <span className="font-semibold">
                          {p.a} <span className="text-muted-foreground">×</span> {p.b}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-xs",
                            p.v >= 0
                              ? "bg-primary/10 text-primary"
                              : "bg-destructive/10 text-destructive",
                          )}
                        >
                          {p.v >= 0 ? "+" : ""}{p.v.toFixed(2)} · {forca} · {sentido}
                        </Badge>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">
                          Hipótese de negócio
                        </div>
                        <p className="text-sm leading-relaxed">{hipotese(p)}</p>
                      </div>

                      <div>
                        <div className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">
                          Como validar com dados adicionais
                        </div>
                        <ol className="list-decimal pl-5 text-sm space-y-1 leading-relaxed">
                          {comoValidar(p).map((passo, i) => (
                            <li key={i}>{passo}</li>
                          ))}
                        </ol>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Interpretacao>
                Priorize testar primeiro a hipótese <strong>#1</strong>: é a relação mais consistente do seu recorte e, portanto, a alavanca (ou o trade-off) com maior potencial de mover o resultado. Se após um período de teste controlado a relação se mantiver, promova a hipótese a <em>regra de gestão</em>; caso contrário, descarte e siga para a próxima.
              </Interpretacao>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!drillFaixa} onOpenChange={(o) => !o && setDrillFaixa(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Faixa {drillFaixa?.faixa} — {shortName(drillFaixa?.serie ?? "")}
            </DialogTitle>
            <DialogDescription>
              Períodos em que o indicador ficou dentro desta faixa de valor.
            </DialogDescription>
          </DialogHeader>
          {detalheFaixa && detalheFaixa.itens.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Metric label="Períodos na faixa" value={String(detalheFaixa.itens.length)} />
                <Metric label="Participação no recorte" value={fmtPct(detalheFaixa.participacao, 0)} />
                <Metric label="Média da faixa" value={fmtNum(detalheFaixa.media)} />
              </div>
              <div className="max-h-64 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2 text-left">Período</th>
                      <th className="p-2 text-right">Valor</th>
                      <th className="p-2 text-right">vs. média da faixa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalheFaixa.itens.map((o) => (
                      <tr key={o.i} className="border-t">
                        <td className="p-2">{o.periodo}</td>
                        <td className="p-2 text-right tabular-nums">{fmtNum(o.valor)}</td>
                        <td className="p-2 text-right tabular-nums">
                          {fmtNum(o.valor - detalheFaixa.media)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhum período nesta faixa.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!drillPeriodo} onOpenChange={(o) => !o && setDrillPeriodo(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhamento de {drillPeriodo?.periodo}</DialogTitle>
            <DialogDescription>
              Comparação com o período anterior para todas as variáveis selecionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-2 text-left">Variável</th>
                  <th className="p-2 text-right">Anterior</th>
                  <th className="p-2 text-right">Atual</th>
                  <th className="p-2 text-right">Variação</th>
                  <th className="p-2 text-right">Variação %</th>
                </tr>
              </thead>
              <tbody>
                {(detalhePeriodo ?? []).map((d) => (
                  <tr key={d.nome} className="border-t">
                    <td className="p-2 font-medium">{d.nome}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(d.anterior)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(d.atual)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(d.delta)}</td>
                    <td
                      className={cn(
                        "p-2 text-right tabular-nums font-medium",
                        d.pct >= 0 ? "text-primary" : "text-destructive",
                      )}
                    >
                      {d.pct >= 0 ? "+" : ""}
                      {fmtPct(d.pct, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="font-medium text-base">{value}</div>
    </div>
  );
}