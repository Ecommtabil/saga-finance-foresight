import { useEffect, useRef, useState } from "react";
import { Expand, FileSpreadsheet, FileText, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { parGap, type ConfigVolatilidade, type Estudo, type SerieCalculada } from "@/lib/volatilidade/dados";
import { CurvasNormais, GapFatRec, Histograma, SerieTemporal } from "./Graficos";
import { CardsSeries, TabelaComparativa, TabelaFaixas } from "./Paineis";
import { Bolinha, VolCard } from "./ui";
import { SemDados } from "./AnaliseTab";

interface Props {
  estudo: Estudo;
  series: SerieCalculada[];
  config: ConfigVolatilidade;
  periodo: string;
  diagnosticoAuto: string;
  onDiagnostico: (t: string | null) => void;
}

export function RelatorioTab({ estudo, series, config, periodo, diagnosticoAuto, onDiagnostico }: Props) {
  const raiz = useRef<HTMLDivElement>(null);
  const [gerando, setGerando] = useState(false);
  const [pdf, setPdf] = useState<{ url: string; blob: Blob } | null>(null);
  useEffect(() => () => { if (pdf) URL.revokeObjectURL(pdf.url); }, [pdf]);
  if (!series.length) return <SemDados />;
  const texto = estudo.diagnostico ?? diagnosticoAuto;
  const par = parGap(series.map(s => s.serie));
  const fat = par && series.find(s => s.serie.id === par.fat.id);
  const rec = par && series.find(s => s.serie.id === par.rec.id);

  const gerarPdf = async () => {
    if (!raiz.current) return;
    setGerando(true);
    try {
      const { gerarPdfVolatilidade } = await import("@/lib/volatilidade/export-pdf");
      const blob = await gerarPdfVolatilidade(estudo, series, config, periodo, texto, raiz.current);
      setPdf({ blob, url: URL.createObjectURL(blob) });
    } catch {
      toast.error("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setGerando(false);
    }
  };
  const baixarPdf = async () => {
    if (!pdf) return;
    const { baixarArquivo } = await import("@/lib/ncg/download");
    const { nomeArquivoVolatilidade } = await import("@/lib/volatilidade/export-pdf");
    baixarArquivo(pdf.blob, nomeArquivoVolatilidade(estudo.cliente, "pdf"));
  };
  const exportarExcel = async () => {
    try {
      const { exportarExcelVolatilidade } = await import("@/lib/volatilidade/export-excel");
      const { nomeArquivoVolatilidade } = await import("@/lib/volatilidade/export-pdf");
      exportarExcelVolatilidade(estudo, series, config, nomeArquivoVolatilidade(estudo.cliente, "xlsx"));
    } catch {
      toast.error("Não foi possível exportar o Excel.");
    }
  };
  const apresentar = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await raiz.current?.requestFullscreen();
    } catch {
      toast.error("Este navegador não permitiu o modo apresentação.");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void gerarPdf()} disabled={gerando}>{gerando ? <Loader2 className="animate-spin" /> : <FileText />}{gerando ? "Gerando PDF…" : "Exportar PDF"}</Button>
        <Button variant="outline" onClick={() => void exportarExcel()}><FileSpreadsheet />Exportar Excel</Button>
        <Button variant="outline" onClick={() => void apresentar()}><Expand />Modo apresentação</Button>
      </div>

      <div ref={raiz} className="vol-report space-y-6">
        <header className="rounded-2xl bg-vol-ink p-6 text-vol-on-ink shadow-[var(--vol-shadow)] md:p-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-vol-gold">Ecommtabil</p>
          <h2 className="mt-2 text-2xl font-bold md:text-3xl">Estudo de Volatilidade Financeira</h2>
          <dl className="mt-5 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            {[["Cliente", estudo.cliente || "—"], ["CNPJ", estudo.cnpj || "—"], ["Período", periodo], ["Responsável técnico", estudo.responsavel || "—"]].map(([k, v]) => (
              <div key={k} className="min-w-0"><dt className="text-xs uppercase text-vol-on-ink/60">{k}</dt><dd className="truncate font-medium">{v}</dd></div>
            ))}
          </dl>
        </header>
        <CardsSeries series={series} config={config} />
        <VolCard titulo="Estatística comparativa"><TabelaComparativa series={series} config={config} /></VolCard>
        {series.map(s => <TabelaFaixas key={s.serie.id} s={s} />)}
        <VolCard titulo="Curvas normais sobrepostas">
          <CurvasNormais series={series} pontos={config.pontosCurva} normalizar={false} captura="Curvas normais sobrepostas" />
        </VolCard>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {series.map(s => (
            <VolCard key={s.serie.id} titulo={<span className="flex items-center gap-2"><Bolinha cor={s.serie.cor} />Série temporal — {s.serie.nome}</span>}>
              <SerieTemporal s={s} captura={`Série temporal — ${s.serie.nome}`} />
            </VolCard>
          ))}
          {series.map(s => (
            <VolCard key={`h-${s.serie.id}`} titulo={<span className="flex items-center gap-2"><Bolinha cor={s.serie.cor} />Histograma — {s.serie.nome}</span>}>
              <Histograma s={s} captura={`Histograma — ${s.serie.nome}`} />
            </VolCard>
          ))}
        </div>
        {fat && rec && <VolCard titulo="Gap Faturamento × Recebimento"><GapFatRec fat={fat} rec={rec} captura="Gap Faturamento × Recebimento" /></VolCard>}
        <VolCard titulo="Diagnóstico" acao={estudo.diagnostico !== null && <Button size="sm" variant="ghost" onClick={() => onDiagnostico(null)}><RotateCcw />Restaurar texto automático</Button>}>
          <Textarea value={texto} onChange={e => onDiagnostico(e.target.value)} rows={12} aria-label="Diagnóstico"
            className="border-vol-border bg-vol-surface text-sm leading-relaxed text-vol-text" />
          <p className="mt-2 text-xs text-vol-muted">{estudo.diagnostico === null ? "Texto gerado automaticamente a partir das regras. Edite à vontade antes de exportar." : "Texto editado manualmente (não é mais atualizado automaticamente)."}</p>
        </VolCard>
        <VolCard>
          <div className="flex flex-col items-start gap-1 pt-10">
            <div className="h-px w-72 max-w-full bg-vol-text" />
            <p className="font-semibold text-vol-text">{estudo.responsavel || "Responsável técnico"}</p>
            <p className="text-xs text-vol-muted">Responsável técnico — Ecommtabil</p>
          </div>
        </VolCard>
      </div>

      <Dialog open={!!pdf} onOpenChange={o => { if (!o) setPdf(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Pré-visualização do PDF</DialogTitle></DialogHeader>
          {pdf && <iframe title="Pré-visualização do PDF" src={pdf.url} className="h-[70vh] w-full rounded-md border" />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPdf(null)}>Fechar</Button>
            <Button onClick={() => void baixarPdf()}><FileText />Baixar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
