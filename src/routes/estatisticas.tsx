import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  X,
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
} from "@/lib/saga/stats";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

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
        titulo="Análises Estatísticas"
        subtitulo="Módulo independente — importe sua própria planilha e trabalhe ranges customizados."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Fonte de dados estatísticos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Baixe a planilha modelo, preencha com quantos períodos e séries desejar (mensal, trimestral, anual)
            e faça o upload aqui. Este módulo é <strong>totalmente independente</strong> do restante do SAGA.
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
          <AlertTitle>Nenhum dataset carregado</AlertTitle>
          <AlertDescription>
            Envie uma planilha para liberar descritiva, tendência, correlação, média móvel, volatilidade e histograma.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function Analises({ dataset }: { dataset: import("@/lib/saga/stats").DatasetEstatistico }) {
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

  const chartFoco = periodos.map((p, i) => ({
    periodo: p,
    valor: foco?.valores[i] ?? null,
    tendencia: reg?.yPred[i] ?? null,
    mm: Number.isFinite(mm[i]) ? mm[i] : null,
  }));

  const corrMatrix = series.map((a) => series.map((b) => correlacaoS(a.valores, b.valores)));

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
  for (let i = 0; i < series.length; i++) {
    for (let j = i + 1; j < series.length; j++) {
      const v = corrMatrix[i][j];
      if (Math.abs(v) > maxAbs) {
        maxAbs = Math.abs(v);
        maxPar = { a: shortName(series[i].nome), b: shortName(series[j].nome), v };
      }
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Recorte de análise
            <InfoTooltip text="Define a janela de períodos analisada, a série em foco (usada nos gráficos individuais) e a janela n da média móvel. Alterar o recorte recalcula todas as estatísticas abaixo." />
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
            <Label className="text-xs uppercase text-muted-foreground">Série em foco</Label>
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
            <Label className="text-xs uppercase text-muted-foreground">Janela média móvel</Label>
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
          <AlertTitle>Amostra pequena (n = {fim - ini + 1})</AlertTitle>
          <AlertDescription>
            Com menos de 8 observações, resultados estatísticos são indicativos. Amplie o range para maior robustez.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Estatística Descritiva
            <InfoTooltip text="Resumo numérico de cada série no recorte selecionado. Média = valor médio; Mediana = valor central (robusta a outliers); Desvio = dispersão em torno da média; CV = desvio ÷ média (comparação entre séries de escalas diferentes); Volatilidade = desvio-padrão dos retornos período a período." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Série</th>
                <th className="p-2 text-right">n</th>
                <th className="p-2 text-right">Média</th>
                <th className="p-2 text-right">Mediana</th>
                <th className="p-2 text-right">Desvio</th>
                <th className="p-2 text-right">CV</th>
                <th className="p-2 text-right">Mín</th>
                <th className="p-2 text-right">Máx</th>
                <th className="p-2 text-right">Volatilidade</th>
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
              A série <strong>{foco?.nome}</strong> tem média de{" "}
              <strong>{fmtNum(focoDesc.media)}</strong> e mediana de{" "}
              <strong>{fmtNum(focoDesc.mediana)}</strong>
              {Math.abs(focoDesc.media - focoDesc.mediana) / (Math.abs(focoDesc.media) || 1) > 0.15
                ? " — a diferença sugere presença de valores atípicos que puxam a média."
                : " — média e mediana próximas indicam distribuição equilibrada."}{" "}
              O coeficiente de variação de <strong>{fmtPct(focoDesc.cv)}</strong> aponta dispersão{" "}
              <strong>{cvLabel}</strong>, e a volatilidade dos retornos é{" "}
              <strong>{fmtPct(focoVol)}</strong>
              {focoVol > 0.2 ? " (série instável entre períodos)." : " (série relativamente estável)."}
            </Interpretacao>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {foco?.nome} — Série, Tendência e Média Móvel
            <InfoTooltip text="Área azul: valores observados. Linha tracejada: tendência linear ajustada por mínimos quadrados (y = a·x + b). Linha contínua: média móvel de n períodos, que suaviza oscilações. Coef. angular indica o ganho médio por período; R² mede o quanto a tendência explica a variação (0% = não explica; 100% = ajuste perfeito)." />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reg && (
            <div className="grid gap-4 md:grid-cols-3 text-sm mb-4">
              <Metric label="Coef. angular" value={fmtNum(reg.slope, 2)} />
              <Metric label="Intercepto" value={fmtNum(reg.intercept, 2)} />
              <Metric label="R²" value={fmtPct(reg.r2, 1)} />
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
                <Line type="monotone" dataKey="tendencia" name="Tendência" stroke="var(--chart-3)" strokeWidth={2} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="mm" name={`MM(${janela})`} stroke="var(--chart-2)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {reg && (
            <Interpretacao>
              A tendência é <strong>{tendDir}</strong>, com variação média de{" "}
              <strong>{fmtNum(reg.slope, 2)}</strong> por período. O R² de{" "}
              <strong>{fmtPct(reg.r2, 1)}</strong> indica ajuste <strong>{r2Label}</strong> —{" "}
              {reg.r2 > 0.7
                ? "a tendência linear explica bem o comportamento da série."
                : reg.r2 > 0.4
                  ? "há tendência, mas com oscilações relevantes ao redor dela."
                  : "os dados oscilam demais para que uma reta descreva o comportamento; a média móvel tende a ser mais informativa."}
            </Interpretacao>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Distribuição — {foco?.nome}
              <InfoTooltip text="Histograma: divide os valores em 8 faixas e conta quantas observações caem em cada uma. Ajuda a identificar concentração, assimetria e valores atípicos (outliers) na série em foco." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hist}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="faixa" tickLine={false} axisLine={false} fontSize={11} interval={0} angle={-25} textAnchor="end" height={60} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                  <Bar dataKey="freq" name="Frequência" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {histTop && histTotal > 0 && (
              <Interpretacao>
                A faixa mais frequente é <strong>{histTop.faixa}</strong>, concentrando{" "}
                <strong>{fmtPct(histTop.freq / histTotal, 0)}</strong> das observações.{" "}
                {histTop.freq / histTotal > 0.4
                  ? "Distribuição concentrada — os valores se repetem em torno de uma faixa dominante."
                  : "Distribuição dispersa — os valores se espalham por várias faixas, indicando maior variabilidade."}
              </Interpretacao>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Retornos período a período — {foco?.nome}
              <InfoTooltip text="Variação percentual entre períodos consecutivos: (valor_t − valor_t−1) ÷ valor_t−1. Barras positivas indicam crescimento; negativas, queda. A amplitude das barras é a base da volatilidade da série." />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={rets.map((v, i) => ({ periodo: periodos[i + 1] ?? String(i + 1), retorno: v }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.5} />
                  <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} tickFormatter={(v) => fmtPct(v, 0)} />
                  <Tooltip formatter={(v: number) => fmtPct(v, 2)} contentStyle={{ borderRadius: 10, border: "1px solid var(--border)" }} />
                  <Bar dataKey="retorno" name="Retorno %" radius={[4, 4, 0, 0]} fill="var(--chart-3)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {rets.length > 0 && (
              <Interpretacao>
                Retorno médio por período de <strong>{fmtPct(retMedio, 2)}</strong>, com{" "}
                <strong>{retPos}</strong> alta(s) e <strong>{retNeg}</strong> queda(s) no recorte.{" "}
                {retPos > retNeg * 1.5
                  ? "Predominância clara de períodos positivos."
                  : retNeg > retPos * 1.5
                    ? "Predominância de períodos negativos — tendência de retração."
                    : "Altas e quedas se alternam de forma equilibrada."}
              </Interpretacao>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Regressão bivariada — dispersão X × Y
            <InfoTooltip text="Escolha duas séries: X (variável explicativa) e Y (variável explicada). O gráfico plota cada período como um ponto (X, Y) e ajusta uma reta de mínimos quadrados y = a·x + b. O coeficiente angular a mede quanto Y varia para cada unidade de X. R² indica o quanto de Y é explicado por X (0% a 100%). r é a correlação de Pearson entre X e Y." />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">Variável X (explicativa)</Label>
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
              <Label className="text-xs uppercase text-muted-foreground">Variável Y (explicada)</Label>
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
                <Metric label="Coef. angular (a)" value={fmtCoef(bivar.slope)} />
                <Metric label="R²" value={fmtPct(bivar.r2, 1)} />
                <Metric label="Correlação r" value={bivar.r.toFixed(2)} />
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
                    <Scatter name="Observações" data={bivar.pts} fill="var(--primary)" />
                    <Scatter
                      name={`Reta ajustada — ${equacao}`}
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
                A cada 1 unidade de <strong>{serieX?.nome}</strong>,{" "}
                <strong>{serieY?.nome}</strong> varia em média{" "}
                <strong>{fmtCoef(bivar.slope)}</strong> unidade(s)
                {bivar.slope >= 0 ? " no mesmo sentido" : " no sentido oposto"}. O R² de{" "}
                <strong>{fmtPct(bivar.r2, 1)}</strong> indica que{" "}
                {bivar.r2 > 0.7
                  ? "a variável X explica bem o comportamento de Y — a reta ajustada é confiável."
                  : bivar.r2 > 0.4
                    ? "há relação relevante, mas outras variáveis também influenciam Y."
                    : "X explica pouco de Y — os pontos se dispersam bastante em torno da reta e a previsão é frágil."}{" "}
                A correlação r = <strong>{bivar.r.toFixed(2)}</strong> confirma associação linear{" "}
                <strong>
                  {Math.abs(bivar.r) > 0.7 ? "forte" : Math.abs(bivar.r) > 0.4 ? "moderada" : "fraca"}
                </strong>
                . Correlação não implica causalidade — use este resultado como pista, não como prova.
              </Interpretacao>
            </>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Dados insuficientes</AlertTitle>
              <AlertDescription>
                Selecione duas séries com ao menos 2 pares de observações válidas no recorte.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Matriz de Correlação (mapa de calor)
            <InfoTooltip text="Correlação de Pearson entre cada par de séries no recorte. Varia de −1 a +1: próximo de +1 = movem-se juntas; próximo de −1 = movem-se em sentidos opostos; próximo de 0 = sem relação linear. Cores mais intensas indicam correlação mais forte (azul = positiva, vermelho = negativa). Correlação não implica causalidade." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2"></th>
                {series.map((s) => <th key={s.nome} className="p-2 text-right text-muted-foreground">{shortName(s.nome)}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.map((row, i) => (
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
          {maxPar && series.length > 1 && (
            <Interpretacao>
              O par mais correlacionado é <strong>{maxPar.a}</strong> ×{" "}
              <strong>{maxPar.b}</strong>, com r = <strong>{maxPar.v.toFixed(2)}</strong>{" "}
              — correlação{" "}
              <strong>
                {Math.abs(maxPar.v) > 0.7 ? "forte" : Math.abs(maxPar.v) > 0.4 ? "moderada" : "fraca"}
              </strong>{" "}
              {maxPar.v >= 0 ? "positiva" : "negativa"}
              {Math.abs(maxPar.v) > 0.7
                ? maxPar.v > 0
                  ? " — as séries tendem a subir e descer juntas."
                  : " — quando uma sobe, a outra tende a cair."
                : Math.abs(maxPar.v) > 0.4
                  ? " — existe relação, mas com ruído."
                  : " — praticamente sem relação linear entre as séries."}
              . Lembre-se: correlação não implica causalidade.
            </Interpretacao>
          )}
        </CardContent>
      </Card>
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