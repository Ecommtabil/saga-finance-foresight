import { useEffect, useState } from "react";
import { Check, ChevronDown, FolderKanban, Loader2, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  criarProjeto,
  excluirProjeto,
  lerEstado,
  renomearProjeto,
  salvarAtual,
  trocarProjeto,
  type Workspace,
} from "@/lib/workspaces";

/** Seletor de projetos (trabalhos): cada projeto guarda todos os dados de forma independente. */
export function ProjectActions() {
  const [projetos, setProjetos] = useState<Workspace[]>([]);
  const [ativoId, setAtivoId] = useState("");

  const atualizar = () => {
    const e = lerEstado();
    setProjetos(e.projetos);
    setAtivoId(e.ativoId);
  };
  useEffect(atualizar, []);

  const ativo = projetos.find((p) => p.id === ativoId);
  const [modo, setModo] = useState<null | "novo" | "renomear">(null);
  const [nome, setNome] = useState("");

  const [ocupado, setOcupado] = useState(false);

  const salvar = async () => {
    setOcupado(true);
    try {
      await salvarAtual();
      atualizar();
      toast.success(`"${ativo?.nome ?? "Projeto"}" salvo.`);
    } catch {
      toast.error("Não foi possível salvar o projeto neste navegador.");
    } finally {
      setOcupado(false);
    }
  };

  const trocar = async (id: string) => {
    if (id === ativoId) return;
    setOcupado(true);
    try {
      await trocarProjeto(id);
    } catch {
      setOcupado(false);
      toast.error("Falha ao trocar de projeto. Tente novamente.");
    }
  };

  const confirmar = () => {
    const n = nome.trim();
    if (modo === "novo") {
      setModo(null);
      setOcupado(true);
      setTimeout(() => void criarProjeto(n).catch(() => { setOcupado(false); toast.error("Falha ao criar projeto."); }), 0);
    } else if (modo === "renomear" && ativo && n) {
      renomearProjeto(ativo.id, n);
      atualizar();
      setModo(null);
    }
  };

  return (
    <>
    <Dialog open={modo !== null} onOpenChange={(o) => !o && setModo(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{modo === "novo" ? "Novo projeto" : "Renomear projeto"}</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && confirmar()}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setModo(null)}>Cancelar</Button>
          <Button onClick={confirmar}>{modo === "novo" ? "Criar" : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div className="flex items-center gap-1">
    <Button size="sm" onClick={salvar} disabled={ocupado} title="Salvar os dados do projeto atual">
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      <span className="hidden sm:inline">Salvar</span>
    </Button>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="max-w-[220px]" disabled={ocupado}>
          <FolderKanban className="h-4 w-4" />
          <span className="truncate">{ativo?.nome ?? "Projeto"}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Meus trabalhos</DropdownMenuLabel>
        {projetos.map((p) => (
          <DropdownMenuItem key={p.id} onSelect={() => void trocar(p.id)}>
            <Check className={`h-4 w-4 ${p.id === ativoId ? "opacity-100" : "opacity-0"}`} />
            <div className="min-w-0">
              <div className="truncate">{p.nome}</div>
              {p.salvoEm && (
                <div className="text-[10px] text-muted-foreground">
                  Salvo {new Date(p.salvoEm).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            setNome(`Projeto ${projetos.length + 1}`);
            setModo("novo");
          }}
        >
          <Plus className="h-4 w-4" /> Novo projeto
        </DropdownMenuItem>
        {ativo && (
          <DropdownMenuItem
            onSelect={() => {
              setNome(ativo.nome);
              setModo("renomear");
            }}
          >
            <Pencil className="h-4 w-4" /> Renomear atual
          </DropdownMenuItem>
        )}
        {ativo && projetos.length > 1 && (
          <DropdownMenuItem
            className="text-destructive"
            onSelect={() => {
              if (confirm(`Excluir "${ativo.nome}" e todos os seus dados?`)) void excluirProjeto(ativo.id);
            }}
          >
            <Trash2 className="h-4 w-4" /> Excluir atual
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
    </>
  );
}
