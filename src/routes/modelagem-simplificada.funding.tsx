import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, NumInput, PctInput } from "@/components/simpl/fields";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { useSimpl } from "@/lib/simpl/store";
import { uid } from "@/lib/simpl/defaults";
import type { Aporte, Divida } from "@/lib/simpl/types";

export const Route = createFileRoute("/modelagem-simplificada/funding")({
  head: () => ({
    meta: [
      { title: "Funding — Modelagem Simplificada" },
      {
        name: "description",
        content: "Dívidas em Price ou SAC, crédito rotativo automático e aportes de capital próprio.",
      },
      { property: "og:title", content: "Funding — SAGA" },
      { property: "og:description", content: "Estrutura de dívida e capital da projeção." },
    ],
  }),
  component: FundingPage,
});

function FundingPage() {
  const { cenario, projecao, atualizarCenario } = useSimpl();
  if (!cenario) return null;
  const N = cenario.premissas.horizonteAnos * 12;
  const rotulo = (m: number) => projecao?.meses[m]?.rotulo ?? `M${m + 1}`;

  const setDivida = (id: string, patch: Partial<Divida>) =>
    atualizarCenario({ dividas: cenario.dividas.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  const setAporte = (id: string, patch: Partial<Aporte>) =>
    atualizarCenario({ aportes: cenario.aportes.map((a) => (a.id === id ? { ...a, ...patch } : a)) });

  return (
    <>
      <PageHeader
        titulo="Funding"
        subtitulo="Captações, sistema de amortização, linha rotativa e aportes de sócios."
      />
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Dívidas</CardTitle>
            <Button
              size="sm"
              onClick={() =>
                atualizarCenario({
                  dividas: [
                    ...cenario.dividas,
                    {
                      id: uid(),
                      descricao: "Nova captação",
                      valor: 100000,
                      mes: 0,
                      prazoMeses: 24,
                      jurosAA: 0.18,
                      sistema: "price",
                      obs: "",
                    },
                  ],
                })
              }
            >
              <Plus className="mr-1.5 h-4 w-4" /> Adicionar
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[170px]">Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Mês</TableHead>
                  <TableHead className="text-right">Prazo (meses)</TableHead>
                  <TableHead className="text-right">Juros % a.a.</TableHead>
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      Sistema
                      <InfoTooltip text="Price: parcela fixa (PMT). SAC: amortização constante e parcelas decrescentes." />
                    </span>
                  </TableHead>
                  <TableHead className="min-w-[140px]">Observação</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cenario.dividas.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="p-1">
                      <Input
                        className="h-8"
                        value={d.descricao}
                        onChange={(e) => setDivida(d.id, { descricao: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <NumInput value={d.valor} onChange={(v) => setDivida(d.id, { valor: v })} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select value={String(d.mes)} onValueChange={(v) => setDivida(d.id, { mes: Number(v) })}>
                        <SelectTrigger className="h-8 w-[110px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {Array.from({ length: N }, (_, m) => (
                            <SelectItem key={m} value={String(m)}>
                              {rotulo(m)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <NumInput value={d.prazoMeses} onChange={(v) => setDivida(d.id, { prazoMeses: v })} />
                    </TableCell>
                    <TableCell className="p-1">
                      <PctInput value={d.jurosAA} onChange={(v) => setDivida(d.id, { jurosAA: v })} />
                    </TableCell>
                    <TableCell className="p-1">
                      <Select
                        value={d.sistema}
                        onValueChange={(v) => setDivida(d.id, { sistema: v as Divida["sistema"] })}
                      >
                        <SelectTrigger className="h-8 w-[100px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="price">Price</SelectItem>
                          <SelectItem value="sac">SAC</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="p-1">
                      <Input
                        className="h-8"
                        value={d.obs}
                        placeholder="Fonte / justificativa"
                        onChange={(e) => setDivida(d.id, { obs: e.target.value })}
                      />
                    </TableCell>
                    <TableCell className="p-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() =>
                          atualizarCenario({ dividas: cenario.dividas.filter((x) => x.id !== d.id) })
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Crédito rotativo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-md border p-2 sm:col-span-2">
                <div className="text-xs">
                  <div className="font-medium">Acionar automaticamente</div>
                  <div className="text-muted-foreground">
                    Usa a linha quando o caixa projetado cai abaixo do mínimo.
                  </div>
                </div>
                <Switch
                  checked={cenario.rotativo.ativo}
                  onCheckedChange={(v) =>
                    atualizarCenario({ rotativo: { ...cenario.rotativo, ativo: v } })
                  }
                />
              </div>
              <Campo label="Limite">
                <NumInput
                  value={cenario.rotativo.limite}
                  onChange={(v) => atualizarCenario({ rotativo: { ...cenario.rotativo, limite: v } })}
                />
              </Campo>
              <Campo label="Juros % a.a.">
                <PctInput
                  value={cenario.rotativo.jurosAA}
                  onChange={(v) => atualizarCenario({ rotativo: { ...cenario.rotativo, jurosAA: v } })}
                />
              </Campo>
              <Campo label="Caixa mínimo desejado">
                <NumInput
                  value={cenario.rotativo.caixaMinimo}
                  onChange={(v) =>
                    atualizarCenario({ rotativo: { ...cenario.rotativo, caixaMinimo: v } })
                  }
                />
              </Campo>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Aportes de capital próprio</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  atualizarCenario({
                    aportes: [
                      ...cenario.aportes,
                      { id: uid(), descricao: "Aporte dos sócios", valor: 100000, mes: 0, obs: "" },
                    ],
                  })
                }
              >
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {cenario.aportes.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum aporte previsto.</p>
              )}
              {cenario.aportes.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-2">
                  <Input
                    className="h-8 min-w-[140px] flex-1"
                    value={a.descricao}
                    onChange={(e) => setAporte(a.id, { descricao: e.target.value })}
                  />
                  <NumInput
                    className="w-32"
                    value={a.valor}
                    onChange={(v) => setAporte(a.id, { valor: v })}
                  />
                  <Select value={String(a.mes)} onValueChange={(v) => setAporte(a.id, { mes: Number(v) })}>
                    <SelectTrigger className="h-8 w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: N }, (_, m) => (
                        <SelectItem key={m} value={String(m)}>
                          {rotulo(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      atualizarCenario({ aportes: cenario.aportes.filter((x) => x.id !== a.id) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
