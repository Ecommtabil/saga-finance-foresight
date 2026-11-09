import { useState } from "react";
import { Copy, FolderOpen, Trash2, Search } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { buscarAnalises, compararAnalises, mesmaEmpresa, periodoNCG, type AnaliseNCG } from "@/lib/ncg/analises";
import { diasTexto, resultadoDasPremissas } from "@/lib/ncg/apresentacao";
import { formatarMoeda } from "@/lib/ncg/premissas";

interface Props { open: boolean; onOpenChange: (v: boolean) => void; analises: AnaliseNCG[]; onAbrir: (a: AnaliseNCG) => void; onDuplicar: (a: AnaliseNCG) => void; onExcluir: (id: string) => void }
export function MinhasAnalisesNCG({ open, onOpenChange, analises, onAbrir, onDuplicar, onExcluir }: Props) {
  const [busca, setBusca] = useState(""); const [selecionadas, setSelecionadas] = useState<string[]>([]); const [excluir, setExcluir] = useState<AnaliseNCG | null>(null);
  const escolhidas = analises.filter(a => selecionadas.includes(a.id));
  const comparativo = compararAnalises(escolhidas);
  return <>
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="ncg-tool max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader><DialogTitle>Minhas análises</DialogTitle><DialogDescription>Análises salvas neste navegador, no projeto atual.</DialogDescription></DialogHeader>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"/><Input aria-label="Buscar por empresa" placeholder="Buscar por empresa" value={busca} onChange={e => setBusca(e.target.value)} className="pl-9"/></div>
      <div className="space-y-2">{buscarAnalises(analises, busca).map(a => {
        const incompatível = escolhidas.length > 0 && !mesmaEmpresa(escolhidas[0], a);
        return <article key={a.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border p-4">
          <Checkbox aria-label={`Comparar ${a.empresa} ${periodoNCG(a.premissas)}`} checked={selecionadas.includes(a.id)} disabled={incompatível} onCheckedChange={v => setSelecionadas(ids => v ? [...ids, a.id] : ids.filter(id => id !== a.id))}/>
          <div className="min-w-0 flex-1"><h3 className="break-words font-semibold">{a.empresa}</h3><p className="text-xs text-muted-foreground">{periodoNCG(a.premissas)}</p><p className="mt-1 text-sm">NCG: {formatarMoeda(resultadoDasPremissas(a.premissas).ncg.total)}</p><p className="mt-1 text-xs text-muted-foreground">Salva em {new Date(a.atualizadoEm).toLocaleString("pt-BR")}</p></div>
          <div className="flex items-center gap-1"><Button variant="outline" size="sm" onClick={() => onAbrir(a)}><FolderOpen/>Abrir</Button><Button variant="ghost" size="icon" title="Duplicar análise" aria-label={`Duplicar análise ${a.empresa}`} onClick={() => onDuplicar(a)}><Copy/></Button><Button variant="ghost" size="icon" title="Excluir análise" aria-label={`Excluir análise ${a.empresa}`} onClick={() => setExcluir(a)}><Trash2/></Button></div>
        </article>;
      })}{buscarAnalises(analises, busca).length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">{analises.length ? "Nenhuma análise encontrada." : "Nenhuma análise salva neste projeto."}</p>}</div>
      {analises.length > 0 && <p className="text-xs text-muted-foreground">Selecione duas ou mais análises da mesma empresa para comparar os períodos.</p>}
      {comparativo.length >= 2 && <section className="space-y-4 border-t pt-4"><h3 className="text-lg font-semibold">Evolução — {escolhidas[0]?.empresa}</h3>
        <div className="overflow-x-auto"><table className="ncg-table"><thead><tr><th>Período</th><th>PMR</th><th>PME</th><th>PMP</th><th>NCG</th></tr></thead><tbody>{comparativo.map(c => <tr key={c.id}><td>{c.periodo}</td><td>{diasTexto(c.pmr)}</td><td>{diasTexto(c.pme)}</td><td>{diasTexto(c.pmp)}</td><td>{formatarMoeda(c.ncg)}</td></tr>)}</tbody></table></div>
        <div className="grid min-w-0 gap-5 md:grid-cols-2"><div><h4 className="mb-2 text-sm font-medium">Prazos médios (dias)</h4><div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={comparativo} margin={{ right: 10, left: 0 }}><CartesianGrid stroke="var(--ncg-border)" vertical={false}/><XAxis dataKey="periodo" tickFormatter={s => s.split(". ")[0]} tick={{fontSize:12}}/><YAxis width={35}/><Tooltip formatter={(v: number, nome: string) => [diasTexto(v), nome]}/><Line dataKey="pmr" name="PMR" stroke="var(--ncg-positive)" strokeWidth={2} isAnimationActive={false}/><Line dataKey="pme" name="PME" stroke="var(--ncg-gold)" strokeWidth={2} isAnimationActive={false}/><Line dataKey="pmp" name="PMP" stroke="var(--ncg-muted)" strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div><p className="text-xs text-ncg-muted">PMR: azul · PME: dourado · PMP: cinza</p></div>
        <div><h4 className="mb-2 text-sm font-medium">NCG operacional (R$)</h4><div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={comparativo} margin={{ right: 10, left: 0 }}><CartesianGrid stroke="var(--ncg-border)" vertical={false}/><XAxis dataKey="periodo" tickFormatter={s => s.split(". ")[0]} tick={{fontSize:12}}/><YAxis width={55} tickFormatter={v => v.toLocaleString("pt-BR", { notation: "compact" })}/><Tooltip formatter={(v: number) => [formatarMoeda(v), "NCG"]}/><Line dataKey="ncg" stroke="var(--ncg-ink)" strokeWidth={2} isAnimationActive={false}/></LineChart></ResponsiveContainer></div></div></div>
      </section>}
    </DialogContent></Dialog>
    <AlertDialog open={excluir !== null} onOpenChange={v => { if (!v) setExcluir(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir análise?</AlertDialogTitle><AlertDialogDescription>A análise de {excluir?.empresa} será removida deste projeto. Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (excluir) { onExcluir(excluir.id); setSelecionadas(ids => ids.filter(id => id !== excluir.id)); } setExcluir(null); }}>Excluir</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}