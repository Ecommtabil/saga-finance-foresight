import { useEffect, useState } from "react";
import { Check, FolderKanban, Loader2, Plus } from "lucide-react";
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
import { criarProjeto, lerEstado, trocarProjeto, type Workspace } from "@/lib/workspaces";

/** Flag de sessão: enquanto não estiver "1", o app mostra a tela de seleção de projeto. */
export const CHAVE_SELECAO = "saga.selecao.ok";

export function marcarSelecao() {
  try {
    sessionStorage.setItem(CHAVE_SELECAO, "1");
  } catch {
    /* ignora */
  }
}

/** Tela inicial: escolha do projeto (trabalho) antes de entrar no menu principal. */
export function SelecaoProjeto() {
  const [projetos, setProjetos] = useState<Workspace[]>([]);
  const [ativoId, setAtivoId] = useState("");
  const [pronto, setPronto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [dialogo, setDialogo] = useState(false);
  const [nome, setNome] = useState("");

  useEffect(() => {
    const e = lerEstado();
    setProjetos(e.projetos);
    setAtivoId(e.ativoId);
    setPronto(true);
  }, []);

  const abrir = (id: string) => {
    if (ocupado) return;
    setOcupado(true);
    marcarSelecao();
    if (id === ativoId) {
      window.location.reload();
      return;
    }
    void trocarProjeto(id).catch(() => {
      setOcupado(false);
      toast.error("Falha ao abrir o projeto. Tente novamente.");
    });
  };

  const criar = () => {
    setDialogo(false);
    setOcupado(true);
    marcarSelecao();
    setTimeout(
      () =>
        void criarProjeto(nome.trim()).catch(() => {
          setOcupado(false);
          toast.error("Falha ao criar projeto.");
        }),
      0,
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">SAGA</h1>
          <p className="mt-2 text-sm text-muted-foreground">Análise e Avaliação de Empresas</p>
        </div>
        <div className="mt-8 rounded-xl border bg-card p-4 shadow-sm">
          <p className="px-1 text-sm font-medium text-foreground">
            Selecione o projeto que deseja trabalhar
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {!pronto && (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {pronto &&
              projetos.map((p) => (
                <button
                  key={p.id}
                  onClick={() => abrir(p.id)}
                  disabled={ocupado}
                  className="flex w-full items-center gap-3 rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-foreground">{p.nome}</div>
                    {p.salvoEm && (
                      <div className="text-[11px] text-muted-foreground">
                        Salvo {new Date(p.salvoEm).toLocaleString("pt-BR")}
                      </div>
                    )}
                  </div>
                  {p.id === ativoId && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      <Check className="h-3 w-3" /> Ativo
                    </span>
                  )}
                </button>
              ))}
            {pronto && (
              <Button
                variant="outline"
                className="justify-start"
                disabled={ocupado}
                onClick={() => {
                  setNome(`Projeto ${projetos.length + 1}`);
                  setDialogo(true);
                }}
              >
                <Plus className="h-4 w-4" /> Criar novo projeto
              </Button>
            )}
          </div>
        </div>
      </div>
      <Dialog open={dialogo} onOpenChange={setDialogo}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && criar()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogo(false)}>
              Cancelar
            </Button>
            <Button onClick={criar}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
