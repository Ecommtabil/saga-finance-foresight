import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { NumInput, PctInput } from "@/components/simpl/fields";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { useSimpl } from "@/lib/simpl/store";
import { uid } from "@/lib/simpl/defaults";
import type { OpexItem } from "@/lib/simpl/types";

export const Route = createFileRoute("/modelagem-simplificada/opex")({
  head: () => ({
    meta: [
      { title: "OPEX — Modelagem Simplificada" },
      {
        name: "description",
        content: "Custos e despesas fixas e variáveis com base por unidade ou % da receita.",
      },
      { property: "og:title", content: "OPEX — SAGA" },
      { property: "og:description", content: "Estrutura de custos dinâmica com crédito tributário." },
    ],
  }),
  component: OpexPage,
});

function OpexPage() {
  const { cenario, atualizarCenario } = useSimpl();
  if (!cenario) return null;

  const set = (id: string, patch: Partial<OpexItem>) =>
    atualizarCenario({ opex: cenario.opex.map((o) => (o.id === id ? { ...o, ...patch } : o)) });

  const add = () =>
    atualizarCenario({
      opex: [
        ...cenario.opex,
        {
          id: uid(),
          descricao: "Nova linha",
          classificacao: "despesa",
          tipo: "fixo",
          baseTipo: "receita",
          produtoId: "",
          valor: 1000,
          creditoTributario: 0,
          obs: "",
        },
      ],
    });

  return (
    <>
      <PageHeader
        titulo="OPEX — custos e despesas"
        subtitulo="Fixos são corrigidos por IPCA; variáveis acompanham unidades vendidas ou receita."
        action={
          <Button size="sm" onClick={add}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar linha
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Descrição</TableHead>
                <TableHead>Classificação</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Base (variável)</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Valor
                    <InfoTooltip text="Fixo: R$/mês. Variável por unidade: R$/unidade. Variável por receita: % da receita." />
                  </span>
                </TableHead>
                <TableHead className="text-right">Crédito trib. %</TableHead>
                <TableHead className="min-w-[150px]">Observação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cenario.opex.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="p-1">
                    <Input
                      className="h-8"
                      value={o.descricao}
                      onChange={(e) => set(o.id, { descricao: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={o.classificacao}
                      onValueChange={(v) => set(o.id, { classificacao: v as OpexItem["classificacao"] })}
                    >
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custo">Custo</SelectItem>
                        <SelectItem value="despesa">Despesa</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={o.tipo} onValueChange={(v) => set(o.id, { tipo: v as OpexItem["tipo"] })}>
                      <SelectTrigger className="h-8 w-[110px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixo">Fixo</SelectItem>
                        <SelectItem value="variavel">Variável</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={o.baseTipo}
                      onValueChange={(v) => set(o.id, { baseTipo: v as OpexItem["baseTipo"] })}
                    >
                      <SelectTrigger className="h-8 w-[130px]" disabled={o.tipo === "fixo"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unidade">R$ / unidade</SelectItem>
                        <SelectItem value="receita">% da receita</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={o.produtoId || "todos"}
                      onValueChange={(v) => set(o.id, { produtoId: v === "todos" ? "" : v })}
                    >
                      <SelectTrigger className="h-8 w-[150px]" disabled={o.tipo === "fixo"}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {cenario.produtos.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    {o.tipo === "variavel" && o.baseTipo === "receita" ? (
                      <PctInput value={o.valor} onChange={(v) => set(o.id, { valor: v })} />
                    ) : (
                      <NumInput value={o.valor} onChange={(v) => set(o.id, { valor: v })} />
                    )}
                  </TableCell>
                  <TableCell className="p-1">
                    <PctInput
                      value={o.creditoTributario}
                      onChange={(v) => set(o.id, { creditoTributario: v })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8"
                      placeholder="Fonte / justificativa"
                      value={o.obs}
                      onChange={(e) => set(o.id, { obs: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => atualizarCenario({ opex: cenario.opex.filter((x) => x.id !== o.id) })}
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
    </>
  );
}
