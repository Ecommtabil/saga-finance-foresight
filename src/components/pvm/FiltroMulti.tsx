import { useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function FiltroMulti({ rotulo, opcoes, selecionados, onChange, formatar = v => v }: { rotulo: string; opcoes: string[]; selecionados: string[]; onChange: (v: string[]) => void; formatar?: (v: string) => string }) {
  const [busca, setBusca] = useState("");
  const visiveis = opcoes.filter(o => formatar(o).toLowerCase().includes(busca.trim().toLowerCase()));
  const resumo = selecionados.length === 0 ? "Todos" : selecionados.length === 1 ? formatar(selecionados[0]) : `${selecionados.length} selecionados`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label={`Filtro ${rotulo}`} className="h-9 max-w-[220px] justify-between gap-2 border-vol-border bg-vol-surface text-vol-text">
          <span className="truncate"><span className="text-vol-muted">{rotulo}:</span> {resumo}</span><ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <div className="relative mb-2"><Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="h-8 pl-8" placeholder={`Buscar ${rotulo.toLowerCase()}`} value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <div className="mb-2 flex justify-between text-xs">
          <button type="button" className="text-primary hover:underline" onClick={() => onChange([])}>Todos</button>
          <span className="text-muted-foreground">{opcoes.length} opções</span>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {visiveis.map(o => (
            <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
              <Checkbox checked={selecionados.includes(o)} onCheckedChange={v => onChange(v ? [...selecionados, o] : selecionados.filter(x => x !== o))} />
              <span className="truncate">{formatar(o)}</span>
            </label>
          ))}
          {!visiveis.length && <p className="py-2 text-center text-xs text-muted-foreground">Nada encontrado.</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
