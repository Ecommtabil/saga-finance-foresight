import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/saga/PageHeader";
import { useSaga } from "@/lib/saga/context";

export const Route = createFileRoute("/empresa")({
  head: () => ({
    meta: [
      { title: "Cadastro da Empresa — SAGA" },
      { name: "description", content: "Cadastre a empresa que será analisada." },
      { property: "og:title", content: "Cadastro da Empresa — SAGA" },
      { property: "og:description", content: "Nome, setor, porte e moeda." },
    ],
  }),
  component: EmpresaPage,
});

function EmpresaPage() {
  const { empresa, setEmpresa } = useSaga();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nome: empresa?.nome ?? "",
    setor: empresa?.setor ?? "",
    porte: empresa?.porte ?? "Médio",
    moeda: empresa?.moeda ?? "R$",
  });

  const salvar = (e: React.FormEvent) => {
    e.preventDefault();
    setEmpresa(form);
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        titulo="Cadastro da Empresa"
        subtitulo="Informações básicas de identificação. Dados financeiros vêm pela planilha."
      />
      <Card>
        <CardHeader>
          <CardTitle>Identificação</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={salvar} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da empresa</Label>
              <Input
                id="nome"
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="setor">Setor</Label>
                <Input
                  id="setor"
                  value={form.setor}
                  onChange={(e) => setForm({ ...form, setor: e.target.value })}
                  placeholder="Ex.: Varejo, Serviços"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="porte">Porte</Label>
                <select
                  id="porte"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.porte}
                  onChange={(e) => setForm({ ...form, porte: e.target.value })}
                >
                  <option>Micro</option>
                  <option>Pequeno</option>
                  <option>Médio</option>
                  <option>Grande</option>
                </select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="moeda">Moeda</Label>
              <select
                id="moeda"
                className="h-9 w-40 rounded-md border bg-background px-3 text-sm"
                value={form.moeda}
                onChange={(e) => setForm({ ...form, moeda: e.target.value })}
              >
                <option>R$</option>
                <option>US$</option>
                <option>€</option>
              </select>
            </div>
            <Button type="submit" className="w-full">
              Salvar e escolher o modo de análise
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}