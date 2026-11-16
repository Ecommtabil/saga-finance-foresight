import { useMemo, useRef, useState, type ReactNode } from "react";
import { Copy, FileDown, FileSpreadsheet, RotateCcw, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { baixarArquivo } from "@/lib/ncg/download";
import { ESTUDOS, premissasCompletas, type DefinicaoEstudo, type PremissasPorEstudo } from "@/lib/viabilidade/estudos";
import { CABECALHO_VAZIO, CHAVE_CABECALHO, CHAVE_ESTUDO, camposVisiveis, nomeArquivo, resumoExecutivo, salvarCenario, type CabecalhoEstudo } from "@/lib/viabilidade/estado";
import type { CampoPremissa, EstudoId } from "@/lib/viabilidade/tipos";
import { Bloco, FormPremissas, KpiCard, ParecerCard } from "./ui";
import { Demonstrativo } from "./Demonstrativo";
import { CabecalhoEstudoForm } from "./CabecalhoEstudo";

interface Props<K extends EstudoId> {
  id: K;
  graficos: (p: PremissasPorEstudo[K]) => ReactNode;
  extras?: (p: PremissasPorEstudo[K], alterar: (patch: Partial<PremissasPorEstudo[K]>) => void) => ReactNode;
  rodape?: ReactNode;
}

function Legenda() {
  const itens = [
    ["bg-via-input border border-via-border", "Premissa"],
    ["bg-via-calc", "Calculado"],
    ["bg-via-sub", "Subtotal"],
    ["bg-via-ink", "Total"],
  ];
  return (
    <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-via-muted">
      {itens.map(([c, t]) => <span key={t} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded-sm ${c}`} />{t}</span>)}
      <span className="flex items-center gap-1.5"><span className="font-semibold text-via-bad">(R$)</span>negativo</span>
    </div>
  );
}

export function EstudoPagina<K extends EstudoId>({ id, graficos, extras, rodape }: Props<K>) {
  const def = ESTUDOS[id] as unknown as DefinicaoEstudo<K>;
  const [salvas, setSalvas] = usePersistedState<PremissasPorEstudo[K]>(CHAVE_ESTUDO(id), def.padrao);
  const [cab, setCab] = usePersistedState<CabecalhoEstudo>(CHAVE_CABECALHO, CABECALHO_VAZIO);
  const premissas = useMemo(() => premissasCompletas(id, salvas), [id, salvas]);
  const cabecalho = useMemo(() => ({ ...CABECALHO_VAZIO, ...cab }), [cab]);
  const relatorio = useMemo(() => def.relatorio(premissas), [def, premissas]);
  const graficosRef = useRef<HTMLDivElement>(null);
  const [dialogo, setDialogo] = useState(false);
  const [nomeCenario, setNomeCenario] = useState("");
  const [gerando, setGerando] = useState<"pdf" | "xlsx" | null>(null);

  const alterar = (patch: Partial<PremissasPorEstudo[K]>) => setSalvas((atual) => ({ ...premissasCompletas(id, atual), ...patch }));
  const campos = camposVisiveis(id, premissas) as unknown as CampoPremissa<never>[];

  const salvar = () => {
    const c = salvarCenario(nomeCenario || `${def.titulo}${cabecalho.cliente ? ` — ${cabecalho.cliente}` : ""}`, id, premissas, cabecalho);
    if (c) { toast.success(`Cenário "${c.nome}" salvo`); setDialogo(false); setNomeCenario(""); }
    else toast.error("Não foi possível salvar: o espaço do navegador está cheio.");
  };

  const copiar = async () => {
    const texto = resumoExecutivo(def as unknown as DefinicaoEstudo, cabecalho, relatorio);
    try { await navigator.clipboard.writeText(texto); toast.success("Resumo copiado. Cole no e-mail ou WhatsApp."); }
    catch { toast.error("Não foi possível copiar. Verifique a permissão da área de transferência."); }
  };

  const exportarPdf = async () => {
    setGerando("pdf");
    try {
      const { gerarPdfViabilidade } = await import("@/lib/viabilidade/export-pdf");
      const graficosEls = Array.from(graficosRef.current?.querySelectorAll<HTMLElement>("[data-via-chart]") ?? []);
      const blob = await gerarPdfViabilidade({
        def: def as unknown as DefinicaoEstudo, cabecalho, campos, premissas: premissas as unknown as Record<string, unknown>, relatorio, graficos: graficosEls,
        riscos: (premissas as { riscos?: never }).riscos,
      });
      baixarArquivo(blob, nomeArquivo(def as unknown as DefinicaoEstudo, cabecalho, "pdf"));
      toast.success("PDF gerado");
    } catch (e) {
      console.error(e); toast.error("Falha ao gerar o PDF.");
    } finally { setGerando(null); }
  };

  const exportarExcel = async () => {
    setGerando("xlsx");
    try {
      const { exportarExcelViabilidade } = await import("@/lib/viabilidade/export-excel");
      const blob = await exportarExcelViabilidade(def as unknown as DefinicaoEstudo, cabecalho, campos, premissas as unknown as Record<string, unknown>, relatorio);
      baixarArquivo(blob, nomeArquivo(def as unknown as DefinicaoEstudo, cabecalho, "xlsx"));
      toast.success("Planilha gerada");
    } catch (e) {
      console.error(e); toast.error("Falha ao gerar a planilha.");
    } finally { setGerando(null); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-via-gold">{def.tipoAnalise}</p>
          <h1 className="text-2xl font-bold tracking-tight text-via-ink">{def.titulo}</h1>
          <p className="text-sm text-via-muted">{def.descricao}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setDialogo(true)} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90"><Save className="h-4 w-4" />Salvar cenário</Button>
          <Button size="sm" variant="outline" onClick={copiar} className="border-via-border"><Copy className="h-4 w-4" />Copiar resumo</Button>
          <Button size="sm" variant="outline" onClick={exportarExcel} disabled={gerando !== null} className="border-via-border">
            {gerando === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}Exportar Excel
          </Button>
          <Button size="sm" variant="outline" onClick={exportarPdf} disabled={gerando !== null} className="border-via-gold text-via-ink">
            {gerando === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}Exportar PDF
          </Button>
        </div>
      </div>

      <CabecalhoEstudoForm valor={cabecalho} onChange={setCab} />

      <div className="space-y-5">
        <Bloco numero={1} titulo="Premissas"
          acao={<Button size="sm" variant="ghost" onClick={() => { setSalvas({ ...def.padrao }); toast.success("Premissas padrão restauradas"); }} className="h-8 text-xs text-via-muted"><RotateCcw className="h-3.5 w-3.5" />Restaurar padrão</Button>}>
          <FormPremissas campos={def.campos as unknown as CampoPremissa<PremissasPorEstudo[K]>[]} valores={premissas} onChange={(k, v) => alterar({ [k]: v } as Partial<PremissasPorEstudo[K]>)} />
        </Bloco>

        <div className="min-w-0 space-y-5">
          <Bloco numero={2} titulo={`Demonstrativo (Ano 0 a Ano ${relatorio.anos})`}>
            <Legenda />
            <Demonstrativo relatorio={relatorio} />
          </Bloco>
          <Bloco numero={3} titulo="Indicadores e Parecer">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {relatorio.kpis.map((k) => <KpiCard key={k.id} kpi={k} />)}
            </div>
            <div className="mt-4"><ParecerCard parecer={relatorio.parecer} /></div>
            <div ref={graficosRef} className="mt-4">{graficos(premissas)}</div>
            {extras && <div className="mt-4 space-y-4">{extras(premissas, alterar)}</div>}
          </Bloco>
        </div>
      </div>
      {rodape}

      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar cenário</DialogTitle>
            <DialogDescription>Guarda as premissas e o cabeçalho deste estudo neste navegador, dentro do projeto atual.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label htmlFor="via-nome-cenario">Nome do cenário</Label>
            <Input id="via-nome-cenario" autoFocus value={nomeCenario} placeholder={`${def.titulo}${cabecalho.cliente ? ` — ${cabecalho.cliente}` : ""}`}
              onChange={(e) => setNomeCenario(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") salvar(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
