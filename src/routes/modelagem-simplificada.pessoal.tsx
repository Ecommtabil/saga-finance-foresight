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
import type { Alocacao, Cargo } from "@/lib/simpl/types";
import { fmtMoney } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/pessoal")({
  head: () => ({
    meta: [
      { title: "Pessoal — Modelagem Simplificada" },
      {
        name: "description",
        content: "Quadro de cargos com encargos, benefícios, 13º e férias com 1/3 provisionados.",
      },
      { property: "og:title", content: "Pessoal — SAGA" },
      { property: "og:description", content: "Folha projetada mês a mês por alocação." },
    ],
  }),
  component: PessoalPage,
});

function PessoalPage() {
  const { cenario, empresa, projecao, atualizarCenario } = useSimpl();
  if (!cenario || !empresa) return null;
  const moeda = empresa.moeda;

  const setCargo = (id: string, patch: Partial<Cargo>) =>
    atualizarCenario({ cargos: cenario.cargos.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const add = () =>
    atualizarCenario({
      cargos: [
        ...cenario.cargos,
        {
          id: uid(),
          nome: "Novo cargo",
          alocacao: "despesa",
          qtd: 1,
          salario: 3000,
          encargos: 0.35,
          beneficios: 500,
          crescHeadcount: 0,
          obs: "",
        },
      ],
    });

  const a1 = projecao?.anual[0];

  return (
    <>
      <PageHeader
        titulo="Pessoal"
        subtitulo="13º salário e férias + 1/3 são provisionados automaticamente todo mês."
        action={
          <Button size="sm" onClick={add}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar cargo
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Cargo</TableHead>
                <TableHead>Alocação</TableHead>
                <TableHead className="text-right">Qtd</TableHead>
                <TableHead className="text-right">Salário</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Encargos % <InfoTooltip text="INSS, FGTS, RAT e demais encargos sobre a folha." />
                  </span>
                </TableHead>
                <TableHead className="text-right">Benefícios R$</TableHead>
                <TableHead className="text-right">
                  <span className="inline-flex items-center gap-1">
                    Headcount % a.a.
                    <InfoTooltip text="Aumento anual do quadro: cada mês é comparado ao mesmo mês do ano anterior." />
                  </span>
                </TableHead>
                <TableHead className="min-w-[160px]">Observação</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cenario.cargos.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="p-1">
                    <Input
                      className="h-8"
                      value={c.nome}
                      onChange={(e) => setCargo(c.id, { nome: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Select
                      value={c.alocacao}
                      onValueChange={(v) => setCargo(c.id, { alocacao: v as Alocacao })}
                    >
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="custo">Custo direto</SelectItem>
                        <SelectItem value="despesa">Despesa operacional</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="p-1">
                    <NumInput value={c.qtd} onChange={(v) => setCargo(c.id, { qtd: v })} />
                  </TableCell>
                  <TableCell className="p-1">
                    <NumInput value={c.salario} onChange={(v) => setCargo(c.id, { salario: v })} />
                  </TableCell>
                  <TableCell className="p-1">
                    <PctInput value={c.encargos} onChange={(v) => setCargo(c.id, { encargos: v })} />
                  </TableCell>
                  <TableCell className="p-1">
                    <NumInput value={c.beneficios} onChange={(v) => setCargo(c.id, { beneficios: v })} />
                  </TableCell>
                  <TableCell className="p-1">
                    <PctInput
                      value={c.crescHeadcount}
                      onChange={(v) => setCargo(c.id, { crescHeadcount: v })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Input
                      className="h-8"
                      value={c.obs}
                      placeholder="Fonte / justificativa"
                      onChange={(e) => setCargo(c.id, { obs: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() =>
                        atualizarCenario({ cargos: cenario.cargos.filter((x) => x.id !== c.id) })
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

      {a1 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Folha projetada — ano 1</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Kpi titulo="Pessoal em custo" valor={fmtMoney(a1.custoPessoal, moeda)} />
            <Kpi titulo="Pessoal em despesa" valor={fmtMoney(a1.despPessoal, moeda)} />
            <Kpi titulo="Total folha" valor={fmtMoney(a1.custoPessoal + a1.despPessoal, moeda)} />
          </CardContent>
        </Card>
      )}
    </>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{valor}</div>
    </div>
  );
}
