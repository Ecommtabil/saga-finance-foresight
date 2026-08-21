import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import type { CapexItem } from "@/lib/simpl/types";
import { fmtMoney } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/investimentos")({
  head: () => ({
    meta: [
      { title: "Investimentos (CAPEX) — Modelagem Simplificada" },
      {
        name: "description",
        content: "Imobilizado e intangível com depreciação linear mês a mês a partir do investimento.",
      },
      { property: "og:title", content: "CAPEX — SAGA" },
      { property: "og:description", content: "Plano de investimentos e depreciação projetada." },
    ],
  }),
  component: CapexPage,
});

function CapexPage() {
  const { cenario, empresa, projecao, atualizarCenario } = useSimpl();
  if (!cenario || !empresa) return null;
  const N = cenario.premissas.horizonteAnos * 12;

  const set = (id: string, patch: Partial<CapexItem>) =>
    atualizarCenario({ capex: cenario.capex.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const add = () =>
    atualizarCenario({
      capex: [
        ...cenario.capex,
        {
          id: uid(),
          descricao: "Novo investimento",
          categoria: "imobilizado",
          valor: 50000,
          mes: 0,
          taxaAA: 0.1,
          obs: "",
        },
      ],
    });

  const rotulo = (m: number) => projecao?.meses[m]?.rotulo ?? `M${m + 1}`;

  return (
    <>
      <PageHeader
        titulo="Investimentos (CAPEX)"
        subtitulo="Depreciação/amortização linear, iniciando no mês do investimento e limitada ao valor do ativo."
        action={
          <Button size="sm" onClick={add}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar investimento
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Mês do investimento</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Taxa % a.a. <InfoTooltip text="Taxa anual de depreciação (imobilizado) ou amortização (intangível)." />
                  </span>
                </TableHead>
                <TableHead className="min-w-[150px]">Observação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cenario.capex.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="p-1">
                    <Input
                      className="h-8"
                      value={c.descricao}
                      onChange={(e) => set(c.id, { descricao: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={c.categoria}
                      onValueChange={(v) => set(c.id, { categoria: v as CapexItem["categoria"] })}
                    >
                      <SelectTrigger className="h-8 w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="imobilizado">Imobilizado</SelectItem>
                        <SelectItem value="intangivel">Intangível</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <NumInput value={c.valor} onChange={(v) => set(c.id, { valor: v })} />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select value={String(c.mes)} onValueChange={(v) => set(c.id, { mes: Number(v) })}>
                      <SelectTrigger className="h-8 w-[120px]">
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
                    <PctInput value={c.taxaAA} onChange={(v) => set(c.id, { taxaAA: v })} />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8"
                      placeholder="Fonte / justificativa"
                      value={c.obs}
                      onChange={(e) => set(c.id, { obs: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => atualizarCenario({ capex: cenario.capex.filter((x) => x.id !== c.id) })}
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

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Depreciação e imobilizado por ano</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Linha</TableHead>
                {projecao?.anual.map((a) => (
                  <TableHead key={a.rotulo} className="text-right">
                    {a.rotulo}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>CAPEX do ano</TableCell>
                {projecao?.anual.map((a) => (
                  <TableCell key={a.rotulo} className="text-right tabular-nums">
                    {fmtMoney(a.capex, empresa.moeda)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow>
                <TableCell>Depreciação / amortização</TableCell>
                {projecao?.anual.map((a) => (
                  <TableCell key={a.rotulo} className="text-right tabular-nums">
                    {fmtMoney(a.depreciacao, empresa.moeda)}
                  </TableCell>
                ))}
              </TableRow>
              <TableRow className="font-medium">
                <TableCell>Imobilizado líquido (fim do ano)</TableCell>
                {projecao?.anual.map((a) => (
                  <TableCell key={a.rotulo} className="text-right tabular-nums">
                    {fmtMoney(a.imobilizadoLiquido, empresa.moeda)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
