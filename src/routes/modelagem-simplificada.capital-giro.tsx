import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, NumInput } from "@/components/simpl/fields";
import { useSimpl } from "@/lib/simpl/store";
import { fmtMoney } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/capital-giro")({
  head: () => ({
    meta: [
      { title: "Capital de Giro — Modelagem Simplificada" },
      {
        name: "description",
        content: "Prazos médios de recebimento, pagamento e estocagem que definem a NCG projetada.",
      },
      { property: "og:title", content: "Capital de Giro — SAGA" },
      { property: "og:description", content: "NCG e ciclo financeiro projetados." },
    ],
  }),
  component: CapitalGiroPage,
});

function CapitalGiroPage() {
  const { cenario, empresa, projecao, atualizarCenario } = useSimpl();
  if (!cenario || !empresa) return null;
  const cg = cenario.capitalGiro;
  const moeda = empresa.moeda;
  const set = (patch: Partial<typeof cg>) => atualizarCenario({ capitalGiro: { ...cg, ...patch } });
  const cicloFinanceiro = cg.pmr + cg.pme - cg.pmp;

  return (
    <>
      <PageHeader
        titulo="Capital de Giro"
        subtitulo="Tributos a recolher e obrigações trabalhistas são calculados com defasagem automática."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Prazos médios (dias)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo label="Recebimento de clientes" ajuda="PMR — gera contas a receber.">
              <NumInput value={cg.pmr} onChange={(v) => set({ pmr: v })} />
            </Campo>
            <Campo label="Pagamento a fornecedores" ajuda="PMP — gera saldo em fornecedores.">
              <NumInput value={cg.pmp} onChange={(v) => set({ pmp: v })} />
            </Campo>
            <Campo label="Estocagem" ajuda="PME — gera estoques sobre os custos.">
              <NumInput value={cg.pme} onChange={(v) => set({ pme: v })} />
            </Campo>
            <Campo label="Adiantamento a fornecedores">
              <NumInput value={cg.adiantFornecedores} onChange={(v) => set({ adiantFornecedores: v })} />
            </Campo>
            <Campo label="Adiantamento de clientes">
              <NumInput value={cg.adiantClientes} onChange={(v) => set({ adiantClientes: v })} />
            </Campo>
            <div className="rounded-md border bg-muted/30 p-3 text-xs sm:col-span-2">
              Ciclo financeiro: <strong>{cicloFinanceiro.toFixed(0)} dias</strong> (PMR + PME − PMP)
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Necessidade de Capital de Giro por ano</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  {projecao?.anual.map((a) => (
                    <TableHead key={a.rotulo} className="text-right">
                      {a.rotulo}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Contas a receber", "contasReceber"],
                  ["Estoques", "estoques"],
                  ["Adiant. a fornecedores", "adiantFornecedores"],
                  ["(-) Fornecedores", "fornecedores"],
                  ["(-) Adiant. de clientes", "adiantClientes"],
                  ["(-) Tributos a recolher", "tributosRecolher"],
                  ["(-) Obrigações trabalhistas", "obrigacoesTrabalhistas"],
                ].map(([label, key]) => (
                  <TableRow key={key}>
                    <TableCell>{label}</TableCell>
                    {projecao?.anual.map((a) => (
                      <TableCell key={a.rotulo} className="text-right tabular-nums">
                        {fmtMoney(
                          (label as string).startsWith("(-)")
                            ? -((a as never as Record<string, number>)[key] ?? 0)
                            : ((a as never as Record<string, number>)[key] ?? 0),
                          moeda,
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold">
                  <TableCell>NCG</TableCell>
                  {projecao?.anual.map((a) => (
                    <TableCell key={a.rotulo} className="text-right tabular-nums">
                      {fmtMoney(a.ncg, moeda)}
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="text-muted-foreground">Variação da NCG (efeito no caixa)</TableCell>
                  {projecao?.anual.map((a) => (
                    <TableCell key={a.rotulo} className="text-right tabular-nums">
                      {fmtMoney(-a.variacaoNcg, moeda)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
