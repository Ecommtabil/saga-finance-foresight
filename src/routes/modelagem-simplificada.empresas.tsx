import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Copy, Download, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, NumInput, PctInput } from "@/components/simpl/fields";
import { useSimpl } from "@/lib/simpl/store";
import type { AnexoSimples, Regime } from "@/lib/simpl/types";
import { fmtPct } from "@/lib/saga/formatters";
import { aliquotaEfetivaSimples, faixaSimples } from "@/lib/simpl/simples";

export const Route = createFileRoute("/modelagem-simplificada/empresas")({
  head: () => ({
    meta: [
      { title: "Empresas & Cenários — Modelagem Simplificada" },
      {
        name: "description",
        content: "Cadastre clientes PME, regime tributário e cenários de projeção isolados.",
      },
      { property: "og:title", content: "Empresas & Cenários — SAGA" },
      { property: "og:description", content: "Gestão multiempresa e múltiplos cenários." },
    ],
  }),
  component: EmpresasPage,
});

function EmpresasPage() {
  const {
    empresas,
    empresa,
    cenario,
    projecao,
    criarEmpresa,
    duplicarEmpresa,
    removerEmpresa,
    atualizarEmpresa,
    selecionarEmpresa,
    criarCenario,
    renomearCenario,
    removerCenario,
    selecionarCenario,
    atualizarCenario,
    importarEstado,
    exportarEstado,
  } = useSimpl();
  const [novoNome, setNovoNome] = useState("");
  const [novoCenario, setNovoCenario] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const rbt12 = projecao?.mensal[11]?.rbt12 ?? projecao?.mensal[projecao.mensal.length - 1]?.rbt12 ?? 0;
  const faixa = empresa ? faixaSimples(rbt12, empresa.anexoSimples) : null;
  const aliqEfetiva = empresa ? aliquotaEfetivaSimples(rbt12, empresa.anexoSimples) : 0;

  const baixarBackup = () => {
    const blob = new Blob([exportarEstado()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "SAGA_ModelagemSimplificada.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        titulo="Empresas & Cenários"
        subtitulo="Cada cliente tem dados, premissas e cenários isolados."
        action={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) importarEstado(await f.text());
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1.5 h-4 w-4" /> Importar
            </Button>
            <Button variant="outline" size="sm" onClick={baixarBackup}>
              <Download className="mr-1.5 h-4 w-4" /> Backup
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Carteira de clientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                className="h-9"
                placeholder="Nome do cliente"
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  criarEmpresa(novoNome);
                  setNovoNome("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {empresas.map((e) => (
                <div
                  key={e.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                    e.id === empresa?.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <button
                    className="flex-1 truncate text-left"
                    onClick={() => selecionarEmpresa(e.id)}
                  >
                    {e.nome}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {e.cenarios.length} cenário(s)
                    </span>
                  </button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicarEmpresa(e.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerEmpresa(e.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cadastro da empresa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo label="Razão social / nome">
              <Input
                className="h-8"
                value={empresa?.nome ?? ""}
                onChange={(e) => atualizarEmpresa({ nome: e.target.value })}
              />
            </Campo>
            <Campo label="Unidade monetária">
              <Input
                className="h-8"
                value={empresa?.moeda ?? "R$"}
                onChange={(e) => atualizarEmpresa({ moeda: e.target.value })}
              />
            </Campo>
            <Campo
              label="Regime tributário"
              ajuda="O regime é o motor do cálculo de tributos: Simples usa alíquota efetiva por RBT12, Presumido tributa base presumida da receita e Real tributa o lucro."
            >
              <Select
                value={empresa?.regime ?? "simples"}
                onValueChange={(v) => atualizarEmpresa({ regime: v as Regime })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Simples Nacional</SelectItem>
                  <SelectItem value="presumido">Lucro Presumido</SelectItem>
                  <SelectItem value="real">Lucro Real</SelectItem>
                </SelectContent>
              </Select>
            </Campo>

            {empresa?.regime === "simples" && (
              <>
                <Campo label="Anexo do Simples" ajuda="Anexos I a V da LC 123/2006.">
                  <Select
                    value={empresa.anexoSimples}
                    onValueChange={(v) => atualizarEmpresa({ anexoSimples: v as AnexoSimples })}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["I", "II", "III", "IV", "V"] as AnexoSimples[]).map((a) => (
                        <SelectItem key={a} value={a}>
                          Anexo {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <div className="sm:col-span-2 rounded-md border bg-muted/30 p-3 text-xs">
                  <div className="font-medium">Alíquota efetiva calculada automaticamente</div>
                  <div className="mt-1 text-muted-foreground">
                    RBT12 projetado: <strong>{rbt12.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</strong>{" "}
                    · Faixa {faixa?.indice} (nominal {fmtPct(faixa?.aliquota ?? 0)}, dedução{" "}
                    {(faixa?.deduzir ?? 0).toLocaleString("pt-BR")}) ·{" "}
                    <Badge variant="secondary">Efetiva {fmtPct(aliqEfetiva)}</Badge>
                  </div>
                </div>
              </>
            )}

            {empresa?.regime === "presumido" && (
              <>
                <Campo label="Presunção IRPJ (% da receita)" ajuda="8% comércio/indústria, 32% serviços.">
                  <PctInput
                    value={empresa.presumidoBaseIRPJ}
                    onChange={(v) => atualizarEmpresa({ presumidoBaseIRPJ: v })}
                  />
                </Campo>
                <Campo label="Presunção CSLL (% da receita)" ajuda="12% regra geral, 32% serviços.">
                  <PctInput
                    value={empresa.presumidoBaseCSLL}
                    onChange={(v) => atualizarEmpresa({ presumidoBaseCSLL: v })}
                  />
                </Campo>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Cenários de {empresa?.nome}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                className="h-9 max-w-xs"
                placeholder="Nome do cenário (ex.: Otimista)"
                value={novoCenario}
                onChange={(e) => setNovoCenario(e.target.value)}
              />
              <Button
                size="sm"
                onClick={() => {
                  criarCenario(novoCenario || "Novo cenário", true);
                  setNovoCenario("");
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Duplicar atual
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  criarCenario(novoCenario || "Cenário em branco", false);
                  setNovoCenario("");
                }}
              >
                Em branco
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(empresa?.cenarios ?? []).map((c) => (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 rounded-md border p-2 ${
                    c.id === cenario?.id ? "border-primary bg-primary/5" : ""
                  }`}
                >
                  <Input
                    className="h-8 border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
                    value={c.nome}
                    onChange={(e) => renomearCenario(c.id, e.target.value)}
                  />
                  <Button size="sm" variant="ghost" onClick={() => selecionarCenario(c.id)}>
                    Ativar
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => removerCenario(c.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Saldos de abertura</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Campo label="Caixa inicial">
              <NumInput
                value={cenario?.caixaInicial ?? 0}
                onChange={(v) => atualizarCenario({ caixaInicial: v })}
              />
            </Campo>
            <Campo label="Capital social inicial">
              <NumInput
                value={cenario?.capitalInicial ?? 0}
                onChange={(v) => atualizarCenario({ capitalInicial: v })}
              />
            </Campo>
          </CardContent>
        </Card>
      </div>
    </>
  );

}
