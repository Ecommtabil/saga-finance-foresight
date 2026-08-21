import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Download, FileText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { useSimpl } from "@/lib/simpl/store";
import { DEMONSTRATIVOS, exportarExcel, exportarPdf } from "@/lib/simpl/export";
import type { ResultadoMes } from "@/lib/simpl/engine";
import { fmtNum } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/demonstrativos")({
  head: () => ({
    meta: [
      { title: "Demonstrativos — Modelagem Simplificada" },
      {
        name: "description",
        content: "DRE, balanço patrimonial e fluxo de caixa projetados em visão anual e mensal.",
      },
      { property: "og:title", content: "Demonstrativos projetados — SAGA" },
      { property: "og:description", content: "Modelo integrado com balance check automático." },
    ],
  }),
  component: DemonstrativosPage,
});

const DESTAQUES = new Set([
  "Receita líquida",
  "Lucro bruto",
  "EBITDA",
  "EBIT",
  "Lucro líquido",
  "Ativo total",
  "Passivo total",
  "Patrimônio líquido",
  "Caixa final",
]);

function Demonstrativo({
  linhas,
  dados,
}: {
  linhas: [string, keyof ResultadoMes][];
  dados: ResultadoMes[];
}) {
  const negativas = new Set(["(-) Impostos sobre venda", "(-) Custos", "(-) Despesas operacionais", "(-) Depreciação e amortização", "(-) IRPJ/CSLL"]);
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[220px] bg-background">Linha</TableHead>
            {dados.map((d) => (
              <TableHead key={d.rotulo} className="text-right">
                {d.rotulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map(([label, k]) => (
            <TableRow key={label} className={DESTAQUES.has(label) ? "bg-muted/40 font-semibold" : ""}>
              <TableCell className="sticky left-0 z-10 bg-inherit">{label}</TableCell>
              {dados.map((d) => {
                const v = Number(d[k] ?? 0);
                return (
                  <TableCell key={d.rotulo} className="text-right tabular-nums">
                    {fmtNum(negativas.has(label) ? -Math.abs(v) : v)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function DemonstrativosPage() {
  const { empresa, cenario, projecao, dcf } = useSimpl();
  const [visao, setVisao] = useState<"anual" | "mensal">("anual");
  if (!empresa || !cenario || !projecao || !dcf) return null;

  const dados = visao === "anual" ? projecao.anual : projecao.mensal;
  const maxCheck = Math.max(...projecao.mensal.map((m) => Math.abs(m.balanceCheck)));
  const fecha = maxCheck < 1;

  return (
    <>
      <PageHeader
        titulo="Demonstrativos financeiros"
        subtitulo="DRE, balanço e fluxo de caixa gerados pelo motor de projeção."
        action={
          <div className="flex flex-wrap gap-2">
            <Badge variant={fecha ? "secondary" : "destructive"} className="h-9 gap-1.5 px-3">
              {fecha ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              Balance check: {fecha ? "OK" : `divergência ${fmtNum(maxCheck)}`}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportarExcel(empresa, cenario, projecao, dcf)}
            >
              <Download className="mr-1.5 h-4 w-4" /> Excel
            </Button>
            <Button size="sm" onClick={() => exportarPdf(empresa, cenario, projecao, dcf)}>
              <FileText className="mr-1.5 h-4 w-4" /> PDF executivo
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex gap-1 rounded-md border p-1 w-fit">
        {(["anual", "mensal"] as const).map((v) => (
          <Button
            key={v}
            size="sm"
            variant={visao === v ? "default" : "ghost"}
            onClick={() => setVisao(v)}
          >
            Visão {v}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <Tabs defaultValue="dre">
            <TabsList>
              <TabsTrigger value="dre">DRE</TabsTrigger>
              <TabsTrigger value="bp">Balanço Patrimonial</TabsTrigger>
              <TabsTrigger value="fc">Fluxo de Caixa</TabsTrigger>
            </TabsList>
            <TabsContent value="dre" className="mt-4">
              <Demonstrativo linhas={DEMONSTRATIVOS.LINHAS_DRE} dados={dados} />
            </TabsContent>
            <TabsContent value="bp" className="mt-4">
              <Demonstrativo linhas={DEMONSTRATIVOS.LINHAS_BP} dados={dados} />
            </TabsContent>
            <TabsContent value="fc" className="mt-4">
              <Demonstrativo linhas={DEMONSTRATIVOS.LINHAS_FC} dados={dados} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </>
  );
}
