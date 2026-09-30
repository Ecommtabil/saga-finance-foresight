import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Copy, Plus, Trash2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanejamento } from "@/lib/pob/store";
import { cn } from "@/lib/utils";

const ABAS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/planejamento", label: "Dashboard", exact: true },
  { to: "/planejamento/premissas", label: "Premissas" },
  { to: "/planejamento/projecao", label: "Projeção Orçamentária" },
  { to: "/planejamento/variacao", label: "Variação" },
  { to: "/planejamento/custos", label: "Custos" },
];

export function PlanejamentoHeader() {
  const { cenarios, cenario, selecionar, criar, duplicar, remover, atualizar } = usePlanejamento();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const [novoNome, setNovoNome] = useState("");

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Cenário
          </span>
          <Select value={cenario?.id ?? ""} onValueChange={selecionar}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {cenarios.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} · {c.ano}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Ano</span>
          <Input
            className="h-9"
            type="number"
            value={cenario?.ano ?? ""}
            onChange={(e) => atualizar({ ano: Number(e.target.value) || new Date().getFullYear() })}
          />
        </div>
        <div className="min-w-[180px] flex-1 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Novo cenário</span>
          <div className="flex gap-2">
            <Input
              className="h-9"
              placeholder="Ex.: Revisão Q2"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                criar(novoNome || `Cenário ${cenarios.length + 1}`, new Date().getFullYear());
                setNovoNome("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => cenario && duplicar(cenario.id)}>
            <Copy className="mr-1.5 h-4 w-4" /> Duplicar
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => cenario && remover(cenario.id)}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {ABAS.map((a) => {
          const ativo = a.exact ? pathname === a.to : pathname.startsWith(a.to);
          return (
            <Link
              key={a.to}
              to={a.to}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                ativo ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {a.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
