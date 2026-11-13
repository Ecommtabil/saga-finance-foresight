import { useState } from "react";
import { Copy, FolderOpen, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { mesTexto, ordenarLinhas, type Estudo } from "@/lib/volatilidade/dados";

interface Props { aberto: boolean; onFechar: () => void; estudos: Estudo[]; ativoId: string; onAbrir: (id: string) => void; onDuplicar: (id: string) => void; onExcluir: (id: string) => void }

export function EstudosSalvos({ aberto, onFechar, estudos, ativoId, onAbrir, onDuplicar, onExcluir }: Props) {
  const [busca, setBusca] = useState("");
  const [excluir, setExcluir] = useState<Estudo | null>(null);
  const filtrados = estudos.filter(e => e.cliente.toLowerCase().includes(busca.trim().toLowerCase()));
  const grupos = new Map<string, Estudo[]>();
  for (const e of filtrados) { const k = e.cliente.trim() || "Sem cliente"; grupos.set(k, [...(grupos.get(k) ?? []), e]); }
  const periodo = (e: Estudo) => { const l = ordenarLinhas(e.linhas); return l.length ? `${mesTexto(l[0].mes)} a ${mesTexto(l[l.length - 1].mes)}` : "Sem dados"; };
  return (
    <>
      <Dialog open={aberto} onOpenChange={o => { if (!o) onFechar(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Estudos salvos</DialogTitle><DialogDescription>Estudos guardados neste projeto, agrupados por cliente.</DialogDescription></DialogHeader>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar por cliente" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar por cliente" /></div>
          <div className="max-h-[55vh] space-y-4 overflow-y-auto">
            {grupos.size === 0 && <p className="py-6 text-center text-sm text-muted-foreground">{estudos.length ? "Nenhum estudo encontrado." : "Nenhum estudo salvo ainda. Use “Salvar estudo” para guardar o estudo atual."}</p>}
            {[...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, "pt-BR")).map(([cliente, lista]) => (
              <div key={cliente}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cliente}</p>
                <ul className="space-y-2">
                  {lista.map(e => (
                    <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{periodo(e)} · {e.series.map(s => s.nome).join(", ")}{e.id === ativoId && <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">aberto</span>}</p>
                        <p className="text-xs text-muted-foreground">Atualizado em {e.atualizadoEm ? new Date(e.atualizadoEm).toLocaleString("pt-BR") : "—"}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => onAbrir(e.id)}><FolderOpen />Abrir</Button>
                        <Button size="icon" variant="ghost" aria-label={`Duplicar estudo de ${cliente}`} onClick={() => onDuplicar(e.id)}><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" aria-label={`Excluir estudo de ${cliente}`} onClick={() => setExcluir(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!excluir} onOpenChange={o => { if (!o) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir estudo?</AlertDialogTitle><AlertDialogDescription>O estudo de {excluir?.cliente || "sem cliente"} ({excluir && periodo(excluir)}) será removido da lista. Isso não pode ser desfeito.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (excluir) onExcluir(excluir.id); setExcluir(null); }}>Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
