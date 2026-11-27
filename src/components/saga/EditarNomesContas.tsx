import { useState } from "react";
import { Pencil, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useSaga } from "@/lib/saga/context";
import { CAMPOS_BP, CAMPOS_DRE } from "@/lib/saga/parser";

type Grupo = "dre" | "bp";

export function EditarNomesContas({ grupos = ["dre", "bp"] }: { grupos?: Grupo[] }) {
  const { dados, setDados } = useSaga();
  const [open, setOpen] = useState(false);
  const [rascunho, setRascunho] = useState<Record<string, string>>({});
  if (!dados) return null;

  const secoes = grupos
    .filter((g) => g === "dre" || dados.balanco)
    .map((g) => ({
      titulo: g === "dre" ? "DRE" : "Balanço Patrimonial",
      campos: (g === "dre" ? CAMPOS_DRE : CAMPOS_BP).map((c) => ({ chave: `${g}.${c.key}`, padrao: c.label })),
    }));

  const salvar = () => {
    const limpo: Record<string, string> = {};
    for (const [k, v] of Object.entries(rascunho)) if (v.trim()) limpo[k] = v.trim();
    setDados({ ...dados, rotulos: limpo });
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setRascunho({ ...(dados.rotulos ?? {}) });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" /> Ajustar nomes das contas
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ajustar nomes das contas</DialogTitle>
          <DialogDescription>
            A estrutura segue sempre a planilha modelo. Aqui você só muda o nome exibido de cada linha;
            os cálculos não mudam.
          </DialogDescription>
        </DialogHeader>
        {secoes.map((s) => (
          <div key={s.titulo} className="space-y-2">
            <h3 className="text-sm font-semibold">{s.titulo}</h3>
            {s.campos.map((c) => (
              <div key={c.chave} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3">
                <span className="text-xs text-muted-foreground">{c.padrao}</span>
                <Input
                  value={rascunho[c.chave] ?? ""}
                  placeholder={c.padrao}
                  onChange={(e) => setRascunho((r) => ({ ...r, [c.chave]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ))}
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setRascunho({})}>
            <RotateCcw className="mr-2 h-4 w-4" /> Restaurar nomes padrão
          </Button>
          <Button onClick={salvar}>Salvar nomes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
