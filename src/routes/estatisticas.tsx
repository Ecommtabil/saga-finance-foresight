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

  const amostraFraca = fim - ini + 1 < 8;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recorte de análise</CardTitle>
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
        <CardHeader><CardTitle>Estatística Descritiva</CardTitle></CardHeader>
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
                return (
                  <tr key={s.nome} className="border-t">
                    <td className="p-2 font-medium">{s.nome}</td>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{foco?.nome} — Série, Tendência e Média Móvel</CardTitle>
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
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Distribuição — {foco?.nome}</CardTitle></CardHeader>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Retornos período a período — {foco?.nome}</CardTitle></CardHeader>
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
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Matriz de Correlação</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2"></th>
                {series.map((s) => <th key={s.nome} className="p-2 text-right text-muted-foreground">{s.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.map((row, i) => (
                <tr key={row.nome} className="border-t">
                  <td className="p-2 font-medium text-muted-foreground">{row.nome}</td>
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