import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { calcularProjecaoPOB, rotulosMeses, vendasBase } from "@/lib/pob/projecao";
import { parametrosPadrao } from "@/lib/pob/parametros";
import { usePlanejamento } from "@/lib/pob/store";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { fmtMoney, fmtNum, fmtPctTable } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

type Realizado = { volume: string; preco: string; cv: string; cf: string };
const VAZIO: Realizado = { volume: "", preco: "", cv: "", cf: "" };

/** Orçado do mês em base de contribuição: Lucro = Receita − Custos variáveis − Custos fixos. */
function orcadoDoMes(p: ReturnType<typeof parametrosPadrao>, i: number) {
  const proj = calcularProjecaoPOB(p);
  const r = proj.raw;
  const volume = r.qtd[i];
  const preco = proj.preco;
  const receita = volume * preco;
  const aliq = (p.impostos.pis + p.impostos.cofins + p.impostos.icms) / 100;
  const unit =
    p.producao.mpPorUnidade * p.compras.custoUnitarioMP +
    p.mod.horasPorUnidade * p.mod.salarioHora * (1 + p.mod.encargosPct / 100) +
    p.mod.horasPorUnidade * p.cif.materiaisIndiretosHora;
  const cv = volume * unit + receita * aliq + r.fatLiq[i] * ((p.despesas.propagandaPct + p.despesas.comissaoPct) / 100);
  const cf = p.cif.moiFixa + p.cif.outrosFixos + r.despFixas[i] + r.deprec[i] + r.juros[i];
  return { volume, preco, receita, cv, cf, lucro: receita - cv - cf };
}

const num = (s: string) => {
  const v = Number(String(s).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(v) ? v : 0;
};

export function PlanejamentoVariacao() {
  const { cenario } = usePlanejamento();
  const p = useMemo(() => cenario?.parametros ?? parametrosPadrao(), [cenario]);
  const moeda = cenario?.moeda ?? "R$";
  const meses = rotulosMeses(vendasBase(p).mesBase, cenario?.ano ?? new Date().getFullYear());
  const [mes, setMes] = usePersistedState<number>(`saga.planejamento.variacao.mes.${cenario?.id ?? "x"}`, 0);
  const [reais, setReais] = usePersistedState<Record<number, Realizado>>(
    `saga.planejamento.variacao.realizado.${cenario?.id ?? "x"}`,
    {},
  );
  const real = reais[mes] ?? VAZIO;
  const set = (k: keyof Realizado, v: string) => setReais((prev) => ({ ...prev, [mes]: { ...(prev[mes] ?? VAZIO), [k]: v } }));

  const o = useMemo(() => orcadoDoMes(p, mes), [p, mes]);
  const preenchido = Object.values(real).some((v) => v !== "");
  const rv = num(real.volume), rp = num(real.preco), rcv = num(real.cv), rcf = num(real.cf);
  const rReceita = rv * rp;
  const rLucro = rReceita - rcv - rcf;

  const efVol = (rv - o.volume) * o.preco;
  const efPreco = (rp - o.preco) * rv;
  const efCv = -(rcv - o.cv);
  const efCf = -(rcf - o.cf);
  const total = efVol + efPreco + efCv + efCf;
  const confere = Math.abs(total - (rLucro - o.lucro)) < 0.01;

  const linhas = [
    { rotulo: "Volume (un.)", orc: o.volume, real: rv, un: true },
    { rotulo: "Preço médio", orc: o.preco, real: rp },
    { rotulo: "Receita", orc: o.receita, real: rReceita },
    { rotulo: "Custos variáveis", orc: o.cv, real: rcv, custo: true },
    { rotulo: "Custos fixos", orc: o.cf, real: rcf, custo: true },
    { rotulo: "Lucro líquido", orc: o.lucro, real: rLucro, total: true },
  ];
  const efeitos = [
    { rotulo: "Efeito volume", valor: efVol, formula: "(Vol. real − Vol. orçado) × Preço orçado" },
    { rotulo: "Efeito preço", valor: efPreco, formula: "(Preço real − Preço orçado) × Vol. real" },
    { rotulo: "Efeito custos variáveis", valor: efCv, formula: "−(CV real − CV orçado)" },
    { rotulo: "Efeito custos fixos", valor: efCf, formula: "−(CF real − CF orçado)" },
  ];

  // Waterfall: base invisível + barra visível
  const ponte = (() => {
    const out: { nome: string; base: number; valor: number; tipo: "total" | "pos" | "neg"; real: number }[] = [];
    out.push({ nome: "Lucro orçado", base: Math.min(0, o.lucro), valor: Math.abs(o.lucro), tipo: "total", real: o.lucro });
    let acc = o.lucro;
    for (const e of efeitos) {
      const ini = acc;
      acc += e.valor;
      out.push({ nome: e.rotulo.replace("Efeito ", ""), base: Math.min(ini, acc), valor: Math.abs(e.valor), tipo: e.valor >= 0 ? "pos" : "neg", real: e.valor });
    }
    out.push({ nome: "Lucro realizado", base: Math.min(0, acc), valor: Math.abs(acc), tipo: "total", real: acc });
    return out;
  })();
  const cor = { total: "var(--primary)", pos: "var(--success)", neg: "var(--destructive)" };
  const fmt = (v: number, un?: boolean) => (un ? fmtNum(v) : fmtMoney(v, moeda));
  const varCls = (v: number) => (v > 0.004 ? "text-success" : v < -0.004 ? "text-destructive" : "text-muted-foreground");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Realizado do mês</CardTitle>
          <CardDescription>Escolha o mês e informe os valores realizados. Eles ficam salvos neste cenário.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label>Mês</Label>
            <Select value={String(mes)} onValueChange={(v) => setMes(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {meses.map((m, i) => <SelectItem key={m} value={String(i)}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {([
            ["volume", "Volume vendido (un.)", fmtNum(o.volume)],
            ["preco", `Preço médio (${moeda})`, fmtNum(o.preco, 2)],
            ["cv", `Custos variáveis totais (${moeda})`, fmtNum(o.cv)],
            ["cf", `Custos fixos totais (${moeda})`, fmtNum(o.cf)],
          ] as const).map(([k, l, ph]) => (
            <div key={k} className="space-y-1.5">
              <Label htmlFor={`r-${k}`}>{l}</Label>
              <Input id={`r-${k}`} inputMode="decimal" placeholder={`Orçado: ${ph}`} value={real[k]} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {!preenchido ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Informe os valores realizados de {meses[mes]} para ver a análise de variação.</CardContent></Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Orçado x Realizado — {meses[mes]}</CardTitle>
              <CardDescription>Custos variáveis orçados incluem matéria-prima, mão de obra, custo indireto variável, impostos sobre vendas, propaganda e comissões; fixos incluem custos indiretos fixos, despesas fixas, depreciação e juros.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-muted-foreground">
                  <tr className="border-b"><th className="py-2 text-left font-medium">Linha</th><th className="text-right font-medium">Orçado</th><th className="text-right font-medium">Realizado</th><th className="text-right font-medium">Variação %</th><th className="text-right font-medium">Variação {moeda}</th></tr>
                </thead>
                <tbody>
                  {linhas.map((l) => {
                    const d = l.real - l.orc;
                    const fav = l.custo ? -d : d;
                    const pct = Math.abs(l.orc) > 0.004 ? d / Math.abs(l.orc) : null;
                    return (
                      <tr key={l.rotulo} className={cn("border-b", l.total && "font-semibold bg-muted/40")}>
                        <td className="py-2">{l.rotulo}</td>
                        <td className="text-right">{fmt(l.orc, l.un)}</td>
                        <td className="text-right">{fmt(l.real, l.un)}</td>
                        <td className={cn("text-right", varCls(fav))}>{fmtPctTable(pct)}</td>
                        <td className={cn("text-right", varCls(fav))}>{fmt(d, l.un)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <h3 className="mt-8 mb-2 text-sm font-semibold">Decomposição da variação do lucro</h3>
              <table className="w-full text-sm tabular-nums">
                <tbody>
                  {efeitos.map((e) => (
                    <tr key={e.rotulo} className="border-b">
                      <td className="py-2">{e.rotulo}<div className="text-xs text-muted-foreground">{e.formula}</div></td>
                      <td className={cn("text-right", varCls(e.valor))}>{fmtMoney(e.valor, moeda)}</td>
                    </tr>
                  ))}
                  <tr className="font-semibold bg-muted/40">
                    <td className="py-2">Variação total do lucro</td>
                    <td className={cn("text-right", varCls(total))}>{fmtMoney(total, moeda)}</td>
                  </tr>
                </tbody>
              </table>
              <p className={cn("mt-2 text-xs", confere ? "text-success" : "text-destructive")}>
                {confere ? "✓" : "✗"} Conferência: Lucro realizado − Lucro orçado = {fmtMoney(rLucro - o.lucro, moeda)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ponte do lucro</CardTitle>
              <CardDescription>Do lucro orçado ao realizado, efeito a efeito.</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ponte}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => fmtNum(v / 1000) + "k"} />
                  <Tooltip
                    cursor={{ fill: "var(--muted)" }}
                    formatter={(_v, name, item) => (name === "valor" ? [fmtMoney(item.payload.real, moeda), "Valor"] : [null, null])}
                  />
                  <Bar dataKey="base" stackId="w" fill="transparent" />
                  <Bar dataKey="valor" stackId="w" radius={[4, 4, 0, 0]}>
                    {ponte.map((d) => <Cell key={d.nome} fill={cor[d.tipo]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
