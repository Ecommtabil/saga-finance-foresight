import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VolCard } from "@/components/volatilidade/ui";
import { lerAbasPVM, mesNome, qtd, type ResultadoLeitura, type ResumoImportacao } from "@/lib/analise-pvm/importacao";
import { baixarModeloPVM } from "@/lib/analise-pvm/modelo";
import { usePVM } from "@/lib/analise-pvm/store";

export function ImportarPVM({ onConfirmado }: { onConfirmado: () => void }) {
  const { registros, resumo, importar, limpar } = usePVM();
  const [pendente, setPendente] = useState<ResultadoLeitura | null>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [ano, setAno] = useState(() => String(new Date().getFullYear()));
  const ref = useRef<HTMLInputElement>(null);

  const ler = async (f: File) => {
    setLendo(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const abas = wb.SheetNames.map(nome => ({ nome, matriz: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nome], { header: 1, raw: true, defval: null }) }));
      const anoNum = Number(ano) || new Date().getFullYear();
      const r = lerAbasPVM(abas, anoNum);
      if (!r) { toast.error("Não encontrei o cabeçalho Unidade | Categoria | Produto | Métrica | Mês | Valor em nenhuma aba."); return; }
      if (!r.registros.length) { toast.error("O cabeçalho foi encontrado, mas nenhuma linha válida foi lida."); return; }
      setPendente(r);
    } catch {
      toast.error("Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.");
    } finally {
      setLendo(false);
      if (ref.current) ref.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <VolCard titulo="Importar dados" acao={<Button variant="outline" size="sm" onClick={() => void baixarModeloPVM()}><Download />Baixar modelo de planilha</Button>}>
        <label
          onDragOver={e => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={e => { e.preventDefault(); setArrastando(false); const f = e.dataTransfer.files?.[0]; if (f) void ler(f); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center text-vol-text transition ${arrastando ? "border-vol-gold bg-vol-gold/10" : "border-vol-border bg-vol-paper hover:border-vol-gold"}`}>
          {lendo ? <Loader2 className="h-8 w-8 animate-spin text-vol-gold" /> : <FileUp className="h-8 w-8 text-vol-gold" />}
          <span className="font-medium">Arraste aqui ou clique para selecionar (.xlsx, .xls, .csv)</span>
          <span className="max-w-xl text-xs text-vol-muted">Formato longo: Unidade | Categoria | Produto | Métrica (Quantidade ou Receita) | Mês | Valor. O cabeçalho é localizado automaticamente (de preferência na aba “Base de Dados”); colunas extras à direita são ignoradas.</span>
          <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Arquivo da base PVM" onChange={e => { const f = e.target.files?.[0]; if (f) void ler(f); }} />
        </label>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-vol-text">
          <label htmlFor="pvm-ano">Ano dos meses informados só por nome (ex.: “Janeiro”):</label>
          <Input id="pvm-ano" value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))} className="h-8 w-24 border-vol-border bg-vol-surface" inputMode="numeric" />
        </div>
      </VolCard>

      {pendente && (
        <VolCard titulo="Resumo da importação">
          <Resumo resumo={pendente.resumo} />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => { importar(pendente.registros, pendente.resumo); setPendente(null); toast.success("Base importada."); onConfirmado(); }} disabled={pendente.resumo.meses.length < 2}><CheckCircle2 />Confirmar e analisar</Button>
            <Button variant="ghost" onClick={() => setPendente(null)}>Cancelar</Button>
            {pendente.resumo.meses.length < 2 && <p className="self-center text-sm text-vol-bad">São necessários pelo menos 2 meses para comparar.</p>}
          </div>
        </VolCard>
      )}

      {!pendente && resumo && registros.length > 0 && (
        <VolCard titulo="Base atual" acao={<Button variant="ghost" size="sm" onClick={() => { limpar(); toast.success("Base removida."); }}><Trash2 />Remover base</Button>}>
          <Resumo resumo={resumo} />
        </VolCard>
      )}
    </div>
  );
}

function Resumo({ resumo }: { resumo: ResumoImportacao }) {
  const cards: Array<[string, string]> = [
    ["Linhas lidas", qtd(resumo.linhasLidas)], ["Unidades", qtd(resumo.unidades.length)], ["Categorias", qtd(resumo.categorias.length)],
    ["Produtos", qtd(resumo.produtos.length)], ["Meses", qtd(resumo.meses.length)],
  ];
  const avisos = [...resumo.semPar, ...resumo.avisos];
  return (
    <div className="space-y-4 text-vol-text">
      <p className="text-sm text-vol-muted">Aba “{resumo.aba}”, cabeçalho na linha {resumo.linhaCabecalho}. Meses: {resumo.meses.map(mesNome).join(", ")}.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cards.map(([k, v]) => <div key={k} className="rounded-xl border border-vol-border bg-vol-paper p-3"><p className="text-xs text-vol-muted">{k}</p><p className="text-xl font-semibold tabular-nums">{v}</p></div>)}
      </div>
      {avisos.length === 0
        ? <p className="flex items-center gap-2 text-sm text-vol-good"><CheckCircle2 className="h-4 w-4" />Nenhum problema encontrado.</p>
        : (
          <div className="rounded-xl border border-vol-warn/40 bg-vol-warn/10 p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-vol-warn" />{avisos.length} aviso(s)</p>
            {resumo.semPar.length > 0 && <p className="mb-1 text-xs font-medium">Produto + Unidade + Mês com só uma das métricas: {resumo.semPar.length}</p>}
            <ul className="max-h-48 list-disc space-y-1 overflow-y-auto pl-5 text-xs">{avisos.slice(0, 40).map((a, i) => <li key={i}>{a}</li>)}</ul>
            {avisos.length > 40 && <p className="mt-1 text-xs text-vol-muted">… e mais {avisos.length - 40}.</p>}
          </div>
        )}
    </div>
  );
}
