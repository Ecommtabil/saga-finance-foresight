import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parametrosPadrao } from "@/lib/pob/parametros";
import { usePlanejamento } from "@/lib/pob/store";
import { uid } from "@/lib/pob/types";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { fmtMoney, fmtNum } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

type ItemMP = { id: string; item: string; qtd: number; un: string; custo: number };
type Produto = { id: string; nome: string; mp: ItemMP[]; horasMOD: number; horasCIF: number };

const novoItem = (): ItemMP => ({ id: uid(), item: "", qtd: 0, un: "kg", custo: 0 });
const novoProduto = (n: number): Produto => ({ id: uid(), nome: `Produto ${n}`, mp: [novoItem()], horasMOD: 0, horasCIF: 0 });

function custos(p: Produto, hMOD: number, hCIF: number) {
  const mp = p.mp.reduce((s, i) => s + i.qtd * i.custo, 0);
  const mod = p.horasMOD * hMOD;
  const cif = p.horasCIF * hCIF;
  return { mp, mod, cif, total: mp + mod + cif };
}

function Num({ value, onChange, className }: { value: number; onChange: (v: number) => void; className?: string }) {
  return (
    <Input
      type="number"
      step="any"
      min={0}
      className={cn("text-right tabular-nums", className)}
      value={Number.isFinite(value) ? value : 0}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
    />
  );
}

export function PlanejamentoCustos() {
  const { cenario } = usePlanejamento();
  const moeda = cenario?.moeda ?? "R$";
  const par = useMemo(() => cenario?.parametros ?? parametrosPadrao(), [cenario]);
  const custoHoraMOD = par.mod.salarioHora * (1 + par.mod.encargosPct / 100);
  const horasMes = par.producao.capacidadeMensal * par.mod.horasPorUnidade;
  const fixosFabris = par.cif.moiFixa + par.cif.outrosFixos + par.cif.depreciacaoFabril;
  const custoHoraCIF = par.cif.materiaisIndiretosHora + (horasMes > 0 ? fixosFabris / horasMes : 0);

  const [produtos, setProdutos] = usePersistedState<Produto[]>(
    `saga.planejamento.custos.${cenario?.id ?? "x"}`,
    () => [{ ...novoProduto(1), horasMOD: par.mod.horasPorUnidade, horasCIF: par.mod.horasPorUnidade, mp: [{ ...novoItem(), item: "Matéria-prima principal", qtd: par.producao.mpPorUnidade, custo: par.compras.custoUnitarioMP }] }],
  );
  const [ativo, setAtivo] = useState(0);
  const idx = Math.min(ativo, produtos.length - 1);
  const prod = produtos[idx];

  const upd = (patch: Partial<Produto>) => setProdutos((ps) => ps.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const updItem = (id: string, patch: Partial<ItemMP>) => upd({ mp: prod.mp.map((m) => (m.id === id ? { ...m, ...patch } : m)) });

  const ranking = produtos
    .map((p) => ({ p, c: custos(p, custoHoraMOD, custoHoraCIF) }))
    .sort((a, b) => b.c.total - a.c.total);

  if (!prod) return null;
  const c = custos(prod, custoHoraMOD, custoHoraCIF);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {produtos.map((p, i) => (
          <Button key={p.id} size="sm" variant={i === idx ? "default" : "outline"} onClick={() => setAtivo(i)}>
            {p.nome || "Sem nome"}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => { setProdutos((ps) => [...ps, novoProduto(ps.length + 1)]); setAtivo(produtos.length); }}>
          <Plus className="mr-1 h-4 w-4" /> Novo produto
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-end gap-3 space-y-0">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="nome-prod">Nome do produto</Label>
                <Input id="nome-prod" value={prod.nome} maxLength={80} onChange={(e) => upd({ nome: e.target.value })} />
              </div>
              {produtos.length > 1 && (
                <Button variant="outline" size="icon" aria-label="Excluir produto" onClick={() => { setProdutos((ps) => ps.filter((_, i) => i !== idx)); setAtivo(0); }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matéria-prima</CardTitle>
              <CardDescription>Itens consumidos para produzir uma unidade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 overflow-x-auto">
              <div className="grid min-w-[620px] grid-cols-[2fr_1fr_80px_1fr_1fr_40px] gap-2 text-xs text-muted-foreground">
                <span>Item</span><span className="text-right">Qtd./unidade</span><span>Unidade</span><span className="text-right">Custo por unidade de MP</span><span className="text-right">Custo total</span><span />
              </div>
              {prod.mp.map((m) => (
                <div key={m.id} className="grid min-w-[620px] grid-cols-[2fr_1fr_80px_1fr_1fr_40px] items-center gap-2">
                  <Input value={m.item} maxLength={80} placeholder="Ex.: Aço" onChange={(e) => updItem(m.id, { item: e.target.value })} />
                  <Num value={m.qtd} onChange={(v) => updItem(m.id, { qtd: v })} />
                  <Input value={m.un} maxLength={10} onChange={(e) => updItem(m.id, { un: e.target.value })} />
                  <Num value={m.custo} onChange={(v) => updItem(m.id, { custo: v })} />
                  <span className="text-right text-sm tabular-nums">{fmtMoney(m.qtd * m.custo, moeda)}</span>
                  <Button variant="ghost" size="icon" aria-label="Remover item" onClick={() => upd({ mp: prod.mp.filter((x) => x.id !== m.id) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2">
                <Button size="sm" variant="outline" onClick={() => upd({ mp: [...prod.mp, novoItem()] })}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar item
                </Button>
                <span className="text-sm font-semibold tabular-nums">Total MP: {fmtMoney(c.mp, moeda)}</span>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Mão de obra direta</CardTitle>
                <CardDescription>Custo por hora das Premissas: salário × (1 + encargos).</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5"><Label>Horas por unidade</Label><Num value={prod.horasMOD} onChange={(v) => upd({ horasMOD: v })} /></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo por hora</span><span className="tabular-nums">{fmtMoney(custoHoraMOD, moeda)}</span></div>
                <div className="flex justify-between text-sm font-semibold"><span>Total MOD</span><span className="tabular-nums">{fmtMoney(c.mod, moeda)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custos indiretos</CardTitle>
                <CardDescription>Custo por hora: materiais indiretos + custos fixos da fábrica ÷ horas na capacidade mensal.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5"><Label>Horas de CIF por unidade</Label><Num value={prod.horasCIF} onChange={(v) => upd({ horasCIF: v })} /></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Custo por hora (rateio)</span><span className="tabular-nums">{fmtMoney(custoHoraCIF, moeda)}</span></div>
                <div className="flex justify-between text-sm font-semibold"><span>Total CIF</span><span className="tabular-nums">{fmtMoney(c.cif, moeda)}</span></div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="h-fit border-primary bg-primary text-primary-foreground lg:sticky lg:top-4">
          <CardHeader><CardDescription className="text-primary-foreground/80">Custo unitário total</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{fmtMoney(c.total, moeda)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {([["Matéria-prima", c.mp], ["Mão de obra", c.mod], ["Custos indiretos", c.cif]] as const).map(([l, v]) => (
              <div key={l} className="flex justify-between"><span>{l}</span><span className="tabular-nums">{fmtMoney(v, moeda)} · {fmtNum(c.total ? (v / c.total) * 100 : 0, 1)}%</span></div>
            ))}
          </CardContent>
        </Card>
      </div>

      {produtos.length > 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Comparativo de produtos</CardTitle><CardDescription>Do maior para o menor custo unitário.</CardDescription></CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead className="text-muted-foreground"><tr className="border-b">
                <th className="py-2 text-left font-medium">Produto</th><th className="text-right font-medium">Matéria-prima</th><th className="text-right font-medium">Mão de obra</th><th className="text-right font-medium">Custos indiretos</th><th className="text-right font-medium">Custo unitário</th>
              </tr></thead>
              <tbody>
                {ranking.map(({ p, c: k }) => (
                  <tr key={p.id} className="border-b">
                    <td className="py-2">{p.nome}</td><td className="text-right">{fmtMoney(k.mp, moeda)}</td><td className="text-right">{fmtMoney(k.mod, moeda)}</td><td className="text-right">{fmtMoney(k.cif, moeda)}</td><td className="text-right font-semibold">{fmtMoney(k.total, moeda)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
