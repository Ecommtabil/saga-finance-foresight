import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Cloud, FolderOpen, RefreshCw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSaga } from "@/lib/saga/context";
import { capturarSnapshot, restaurarSnapshot, type SnapshotCompleto } from "@/lib/projetos-nuvem";
import { useUsuario } from "@/components/saga/ContaMenu";

export const Route = createFileRoute("/projetos")({
  head: () => ({
    meta: [
      { title: "Meus projetos — SAGA" },
      { name: "description", content: "Salve e abra projetos completos do SAGA na nuvem." },
      { property: "og:title", content: "Meus projetos — SAGA" },
      { property: "og:description", content: "Projetos SAGA salvos na nuvem, com todos os módulos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjetosPage,
});

interface Linha {
  id: string;
  nome: string;
  updated_at: string;
}

function ProjetosPage() {
  const { user, pronto } = useUsuario();
  const { empresa, exportarProjeto } = useSaga();
  const [lista, setLista] = useState<Linha[]>([]);
  const [nome, setNome] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from("projetos")
      .select("id, nome, updated_at")
      .order("updated_at", { ascending: false });
    if (error) setErro(error.message);
    else setLista(data ?? []);
  }, []);

  useEffect(() => {
    if (user) carregar();
  }, [user, carregar]);

  useEffect(() => {
    if (!nome && empresa?.nome) setNome(empresa.nome);
  }, [empresa, nome]);

  const snapshot = () => capturarSnapshot(exportarProjeto());

  const salvarNovo = async () => {
    if (!nome.trim()) return setErro("Dê um nome ao projeto.");
    setOcupado(true);
    setErro(null);
    const { error } = await supabase
      .from("projetos")
      .insert({ nome: nome.trim(), dados: snapshot() as never, user_id: user!.id });
    setOcupado(false);
    if (error) setErro(error.message);
    else carregar();
  };

  const sobrescrever = async (p: Linha) => {
    if (!confirm(`Substituir "${p.nome}" pelos dados atuais?`)) return;
    setOcupado(true);
    const { error } = await supabase.from("projetos").update({ dados: snapshot() as never }).eq("id", p.id);
    setOcupado(false);
    if (error) setErro(error.message);
    else carregar();
  };

  const abrir = async (p: Linha) => {
    if (!confirm(`Abrir "${p.nome}"? Os dados atuais não salvos serão substituídos.`)) return;
    setOcupado(true);
    const { data, error } = await supabase.from("projetos").select("dados").eq("id", p.id).single();
    setOcupado(false);
    if (error || !data) return setErro(error?.message ?? "Projeto não encontrado.");
    restaurarSnapshot(data.dados as unknown as SnapshotCompleto);
  };

  const excluir = async (p: Linha) => {
    if (!confirm(`Excluir "${p.nome}" definitivamente?`)) return;
    const { error } = await supabase.from("projetos").delete().eq("id", p.id);
    if (error) setErro(error.message);
    else carregar();
  };

  if (!pronto) return null;

  if (!user)
    return (
      <div className="mx-auto mt-10 max-w-md text-center">
        <Cloud className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">Projetos na nuvem</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Entre na sua conta para salvar e abrir projetos de qualquer computador.
        </p>
        <Button asChild className="mt-4">
          <Link to="/auth">Entrar</Link>
        </Button>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Meus projetos</h1>
        <p className="text-sm text-muted-foreground">
          Cada projeto guarda tudo: dados importados, modelagens, orçamento e planejamento.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salvar situação atual</CardTitle>
          <CardDescription>Cria um novo projeto com todos os dados abertos agora.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nome do projeto" value={nome} onChange={(e) => setNome(e.target.value)} />
          <Button onClick={salvarNovo} disabled={ocupado}>
            <Save className="h-4 w-4" /> Salvar
          </Button>
        </CardContent>
      </Card>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Projetos salvos ({lista.length})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0">
          {lista.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Nenhum projeto salvo ainda.</p>
          )}
          {lista.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 px-6 py-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{p.nome}</div>
                <div className="text-xs text-muted-foreground">
                  Atualizado em {new Date(p.updated_at).toLocaleString("pt-BR")}
                </div>
              </div>
              <Button size="sm" onClick={() => abrir(p)} disabled={ocupado}>
                <FolderOpen className="h-4 w-4" /> Abrir
              </Button>
              <Button size="sm" variant="outline" onClick={() => sobrescrever(p)} disabled={ocupado}>
                <RefreshCw className="h-4 w-4" /> Atualizar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => excluir(p)} aria-label="Excluir">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
