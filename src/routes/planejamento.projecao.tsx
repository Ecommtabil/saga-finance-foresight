import { Fragment, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanejamento } from "@/lib/pob/store";
import { MESES_POB } from "@/lib/pob/types";
import { parametrosPadrao, type ParametrosPOB } from "@/lib/pob/parametros";
import { calcularProjecaoPOB, rotulosMeses, sazonalidadeDe, vendasBase } from "@/lib/pob/projecao";
import { fmtMoney, fmtNum } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/planejamento/projecao")({
  head: () => ({
    meta: [
      { title: "Projeção Orçamentária (12 meses) | SAGA" },
      { name: "description", content: "Projeção mensal de vendas, produção, matéria-prima, mão de obra, custos, despesas, investimentos e empréstimos." },
      { property: "og:title", content: "Projeção Orçamentária (12 meses) | SAGA" },
      { property: "og:description", content: "Orçamento mensal calculado em cadeia a partir das premissas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjecaoPage,
});

const COR_BLOCO: Record<string, string> = {
  Vendas: "bg-chart-1/10",
  Produção: "bg-chart-2/10",
  "Matéria-Prima": "bg-chart-3/10",
  "Mão de Obra": "bg-chart-4/10",
  "Custos Indiretos": "bg-chart-5/10",
  Despesas: "bg-primary/5",
  Investimentos: "bg-secondary/60",
  Empréstimos: "bg-muted/60",
};

function ProjecaoPage() {
  const { cenario, atualizar } = usePlanejamento();
  const p: ParametrosPOB | null = cenario ? (cenario.parametros ?? parametrosPadrao(cenario.ano)) : null;
  const proj = useMemo(() => (p ? calcularProjecaoPOB(p) : null), [p]);
  if (!cenario || !p || !proj) return null;

  const moeda = cenario.moeda ?? "R$";
  const base = vendasBase(p);
  const saz = sazonalidadeDe(p);
  const somaSaz = saz.reduce((a, b) => a + b, 0);
  const meses = rotulosMeses(base.mesBase, cenario.ano);
  const setVendas = (patch: Partial<ParametrosPOB["vendas"]>) =>
    atualizar({ parametros: { ...p, vendas: { ...p.vendas, ...patch } } });
  const num = (v: string) => Math.max(0, Number(v) || 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Base de vendas e sazonalidade</CardTitle>
          <CardDescription>
            Quantidade e preço do ano anterior; o sistema aplica o crescimento de volume ({fmtNum(p.vendas.crescVolume, 1)}%) e de preço ({fmtNum(p.vendas.crescPreco, 1)}%) definidos em Premissas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Quantidade anual base (un.)</Label>
              <Input type="number" min={0} value={base.quantidadeAnualBase} onChange={(e) => setVendas({ quantidadeAnualBase: num(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Orçado: {fmtNum(proj.qtdAno)} un.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Preço unitário base (R$)</Label>
              <Input type="number" min={0} step="any" value={base.precoBase} onChange={(e) => setVendas({ precoBase: num(e.target.value) })} />
              <p className="text-xs text-muted-foreground">Orçado: {fmtMoney(proj.preco, moeda)}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mês-base (início da projeção)</Label>
              <Select value={String(base.mesBase)} onValueChange={(v) => setVendas({ mesBase: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES_POB.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs">% de sazonalidade por mês</Label>
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium", Math.abs(somaSaz - 100) > 0.05 ? "text-destructive" : "text-muted-foreground")}>
                  Soma: {fmtNum(somaSaz, 2)}%{Math.abs(somaSaz - 100) > 0.05 && " (precisa fechar 100%)"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setVendas({ sazonalidade: Array.from({ length: 12 }, () => 100 / 12) })}>
                  Distribuir igual
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
              {meses.map((m, i) => (
                <div key={m} className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">{m}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="any"
                    className="h-8 px-1 text-right text-xs"
                    value={Number(saz[i].toFixed(2))}
                    onChange={(e) => {
                      const s = [...saz];
                      s[i] = Math.min(100, num(e.target.value));
                      setVendas({ sazonalidade: s });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projeção Orçamentária</CardTitle>
          <CardDescription>12 meses calculados em cadeia a partir das Premissas do modelo.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-h-[70vh] overflow-auto rounded-md border">
            <table className="w-full text-xs tabular-nums">
              <thead className="sticky top-0 z-20 bg-card shadow-sm">
                <tr>
                  <th className="sticky left-0 z-30 min-w-[240px] bg-card p-2 text-left">Conta</th>
                  {meses.map((m) => <th key={m} className="min-w-[96px] p-2 text-right">{m}</th>)}
                  <th className="min-w-[110px] p-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {proj.blocos.map((b) => (
                  <Fragment key={b.bloco}>
                    <tr className={COR_BLOCO[b.bloco]}>
                      <td colSpan={14} className="sticky left-0 p-2 text-[11px] font-semibold uppercase tracking-wide">
                        {b.bloco}
                      </td>
                    </tr>
                    {b.linhas.map((l) => {
                      const somavel = !/estoque|capacidade|saldo|preço|necessidade/i.test(l.rotulo);
                      const total = l.valores.reduce((a, v) => a + v, 0);
                      const fmt = (v: number) => (l.un ? fmtNum(v) : fmtMoney(v, moeda));
                      return (
                        <tr key={l.rotulo} className={cn("border-t", COR_BLOCO[b.bloco], l.destaque && "font-semibold")}>
                          <td className={cn("sticky left-0 z-10 bg-card p-2", COR_BLOCO[b.bloco])}>{l.rotulo}</td>
                          {l.valores.map((v, i) => (
                            <td key={i} className={cn("p-2 text-right", l.alerta && v < 0 && "font-semibold text-destructive")}>
                              {fmt(v)}
                            </td>
                          ))}
                          <td className="p-2 text-right font-medium">{somavel ? fmt(total) : "—"}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Mês 1 não considera recebimentos/pagamentos pendentes do ano anterior. No último mês, o estoque final de produto usa o valor de fim de ano definido em Premissas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
