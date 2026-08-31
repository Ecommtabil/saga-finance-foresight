import { useRef, useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Copy, Download, Plus, Trash2, Upload, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrcamento } from "@/lib/orcamento/store";
import { baixarBlob } from "@/lib/orcamento/template";
import { cn } from "@/lib/utils";

const ABAS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/orcamento", label: "Dashboard", exact: true },
  { to: "/orcamento/dados", label: "Dados & Importação" },
  { to: "/orcamento/budget", label: "Budget" },
];

export function OrcamentoHeader() {
  const { orcamentos, orcamento, selecionar, criar, duplicar, remover, atualizar, exportarEstado, importarEstado } =
    useOrcamento();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const fileRef = useRef<HTMLInputElement>(null);
  const [novoNome, setNovoNome] = useState("");

  const abrirArquivo = async (file: File) => {
    try {
      importarEstado(await file.text());
      toast.success("Orçamento carregado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Arquivo inválido.");
    }
  };

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" /> Orçamento
          </span>
          <Select value={orcamento?.id ?? ""} onValueChange={selecionar}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {orcamentos.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.nome} · {o.ano}
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
            value={orcamento?.ano ?? ""}
            onChange={(e) => atualizar({ ano: Number(e.target.value) || new Date().getFullYear() })}
          />
        </div>
        <div className="min-w-[180px] flex-1 space-y-1">
          <span className="text-xs font-medium text-muted-foreground">Novo orçamento</span>
          <div className="flex gap-2">
            <Input
              className="h-9"
              placeholder="Nome"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
            />
            <Button
              size="sm"
              className="h-9"
              onClick={() => {
                criar(novoNome || `Orçamento ${orcamentos.length + 1}`, new Date().getFullYear());
                setNovoNome("");
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => orcamento && duplicar(orcamento.id)}>
            <Copy className="mr-1.5 h-4 w-4" /> Duplicar
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => orcamento && remover(orcamento.id)}>
            <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1.5 h-4 w-4" /> Abrir
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              baixarBlob(
                new Blob([exportarEstado()], { type: "application/json" }),
                `${orcamento?.nome ?? "orcamento"}.orc.json`,
              );
              toast.success("Orçamento salvo.");
            }}
          >
            <Download className="mr-1.5 h-4 w-4" /> Salvar
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void abrirArquivo(f);
              e.target.value = "";
            }}
          />
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
