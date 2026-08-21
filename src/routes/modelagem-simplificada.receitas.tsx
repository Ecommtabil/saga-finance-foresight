import { createFileRoute } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, NumInput, PctInput } from "@/components/simpl/fields";
import { useSimpl } from "@/lib/simpl/store";
import { MESES, uid } from "@/lib/simpl/defaults";
import type { Produto } from "@/lib/simpl/types";
import { fmtMoney } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Modelagem Simplificada" },
      {
        name: "description",
        content: "Produtos e serviços dinâmicos com volume, preço, sazonalidade e impostos sobre venda.",
      },
      { property: "og:title", content: "Receitas — SAGA" },
      { property: "og:description", content: "Projeção de receita auditável, imposto a imposto." },
    ],
  }),
  component: ReceitasPage,
});

function ReceitasPage() {
  const { cenario, empresa, projecao, atualizarCenario } = useSimpl();
  if (!cenario || !empresa) return null;
  const moeda = empresa.moeda;
  const reforma = cenario.premissas.reformaTributaria;

  const setProduto = (id: string, patch: Partial<Produto>) =>
    atualizarCenario({
      produtos: cenario.produtos.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });

  const addProduto = () =>
    atualizarCenario({
      produtos: [
        ...cenario.produtos,
        {
          id: uid(),
          nome: `Produto ${cenario.produtos.length + 1}`,
          volumeMes: 10,
          preco: 100,
          crescVolume: 0.05,
          crescPreco: 0.04,
          sazonalidade: Array.from({ length: 12 }, () => 1),
          iss: 0,
          icms: 0,
          pisCofins: 0.0925,
          ipi: 0,
          ibs: 0.177,
          cbs: 0.088,
          obs: "",
        },
      ],
    });

  const ano1 = projecao?.anual[0];

  return (
    <>
      <PageHeader
        titulo="Receitas"
        subtitulo="Lista dinâmica de produtos/serviços. Crescimento sempre contra o mesmo mês do ano anterior."
        action={
          <Button size="sm" onClick={addProduto}>
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar item
          </Button>
        }
      />

      <div className="space-y-6">
        {cenario.produtos.map((p) => {
          const receitaAno1 = (projecao?.receitaPorProduto[p.id] ?? [])
            .slice(0, 12)
            .reduce((s, v) => s + v, 0);
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <Input
                  className="h-9 max-w-sm font-medium"
                  value={p.nome}
                  onChange={(e) => setProduto(p.id, { nome: e.target.value })}
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    Receita bruta ano 1: <strong>{fmtMoney(receitaAno1, moeda)}</strong>
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() =>
                      atualizarCenario({ produtos: cenario.produtos.filter((x) => x.id !== p.id) })
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Campo label="Volume mensal base">
                    <NumInput value={p.volumeMes} onChange={(v) => setProduto(p.id, { volumeMes: v })} />
                  </Campo>
                  <Campo label="Preço unitário">
                    <NumInput value={p.preco} onChange={(v) => setProduto(p.id, { preco: v })} />
                  </Campo>
                  <Campo label="Crescimento de volume (% a.a.)">
                    <PctInput value={p.crescVolume} onChange={(v) => setProduto(p.id, { crescVolume: v })} />
                  </Campo>
                  <Campo label="Crescimento de preço (% a.a.)">
                    <PctInput value={p.crescPreco} onChange={(v) => setProduto(p.id, { crescPreco: v })} />
                  </Campo>
                </div>

                <div>
                  <div className="mb-1 text-xs font-medium text-muted-foreground">
                    Sazonalidade mensal (multiplicadores — soma ideal ≈ 12)
                  </div>
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
                    {p.sazonalidade.map((s, i) => (
                      <div key={i} className="space-y-1">
                        <div className="text-center text-[10px] text-muted-foreground">{MESES[i]}</div>
                        <NumInput
                          value={s}
                          onChange={(v) => {
                            const arr = [...p.sazonalidade];
                            arr[i] = v;
                            setProduto(p.id, { sazonalidade: arr });
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {empresa.regime === "simples" ? (
                  <p className="rounded-md border bg-muted/30 p-2 text-xs text-muted-foreground">
                    No Simples Nacional a dedução da receita é o DAS, calculado pela alíquota efetiva
                    do RBT12 — não há alíquotas por produto.
                  </p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {reforma ? (
                      <>
                        <Campo label="IBS (%)">
                          <PctInput value={p.ibs} onChange={(v) => setProduto(p.id, { ibs: v })} />
                        </Campo>
                        <Campo label="CBS (%)">
                          <PctInput value={p.cbs} onChange={(v) => setProduto(p.id, { cbs: v })} />
                        </Campo>
                      </>
                    ) : (
                      <>
                        <Campo label="ISS (%)">
                          <PctInput value={p.iss} onChange={(v) => setProduto(p.id, { iss: v })} />
                        </Campo>
                        <Campo label="ICMS (%)">
                          <PctInput value={p.icms} onChange={(v) => setProduto(p.id, { icms: v })} />
                        </Campo>
                        <Campo label="PIS/COFINS (%)">
                          <PctInput
                            value={p.pisCofins}
                            onChange={(v) => setProduto(p.id, { pisCofins: v })}
                          />
                        </Campo>
                      </>
                    )}
                    <Campo label="IPI (%)">
                      <PctInput value={p.ipi} onChange={(v) => setProduto(p.id, { ipi: v })} />
                    </Campo>
                  </div>
                )}

                <Campo label="Observação / fonte da premissa" ajuda="Registre a justificativa do input para auditoria.">
                  <Textarea
                    className="min-h-[60px] text-sm"
                    value={p.obs}
                    onChange={(e) => setProduto(p.id, { obs: e.target.value })}
                  />
                </Campo>
              </CardContent>
            </Card>
          );
        })}

        {ano1 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Da receita bruta à receita líquida (ano 1)</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">% da receita bruta</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Receita bruta</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(ano1.receitaBruta, moeda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">100,0%</TableCell>
                  </TableRow>
                  {Object.entries(ano1.detalheImpostos).map(([nome, valor]) => (
                    <TableRow key={nome}>
                      <TableCell className="pl-6 text-muted-foreground">(-) {nome}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(-valor, moeda)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {((valor / (ano1.receitaBruta || 1)) * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-semibold">
                    <TableCell>Receita líquida</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(ano1.receitaLiquida, moeda)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {((ano1.receitaLiquida / (ano1.receitaBruta || 1)) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
