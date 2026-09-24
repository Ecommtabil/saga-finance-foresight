import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { calcular, PREMISSAS_PADRAO, type PremissasSS, type Serie4 } from "@/lib/ss/engine";

export const Route = createFileRoute("/modelagem-simplificada-3")({
  head: () => ({
    meta: [
      { title: "Super Simulador — Modelagem Simplificada 3 | SAGA" },
      { name: "description", content: "Modelo financeiro de 5 anos totalmente conectado: DRE, Balanço, Fluxo de Caixa, Valuation, Viabilidade e Indicadores." },
      { property: "og:title", content: "Super Simulador — SAGA" },
      { property: "og:description", content: "Altere premissas e veja tudo recalcular em cascata." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperSimulador,
});

const ANOS = ["Ano 1", "Ano 2", "Ano 3", "Ano 4", "Ano 5"];
const brl = (v: number) => {
  const s = Math.abs(v).toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  return v < 0 ? `(${s})` : s;
};
const pct = (v: number) => {
  const s = `${(Math.abs(v) * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  return v < 0 ? `(${s})` : s;
};
const num = (v: number, d = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d });

type Fmt = "brl" | "pct" | "x" | "dias";
type Linha = { label: string; v: number[]; fmt?: Fmt; total?: boolean; sub?: boolean };
const fmtV = (v: number, f: Fmt = "brl") =>
  f === "pct" ? pct(v) : f === "x" ? num(v) : f === "dias" ? num(v, 0) : brl(v);

function Tabela({ linhas, colunas = ANOS }: { linhas: (Linha | string)[]; colunas?: string[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Conta</th>
            {colunas.map((c) => <th key={c} className="px-3 py-2 text-right">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {linhas.map((l, i) =>
            typeof l === "string" ? (
              <tr key={i} className="bg-muted/60"><td colSpan={colunas.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase text-muted-foreground">{l}</td></tr>
            ) : (
              <tr key={i} className={`border-t ${l.total ? "bg-muted/40 font-semibold" : ""} ${l.sub ? "italic text-muted-foreground" : ""}`}>
                <td className="px-3 py-1.5">{l.label}</td>
                {l.v.map((v, j) => (
                  <td key={j} className={`px-3 py-1.5 text-right tabular-nums ${v < 0 ? "text-destructive" : ""}`}>{fmtV(v, l.fmt)}</td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}

function Campo({ label, value, onChange, tipo = "pct" }: { label: string; value: number; onChange: (v: number) => void; tipo?: "pct" | "brl" | "num" }) {
  const shown = tipo === "pct" ? +(value * 100).toFixed(4) : value;
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}{tipo === "pct" ? " (%)" : tipo === "brl" ? " (R$)" : ""}</span>
      <Input
        type="number"
        step="any"
        className="h-8 border-primary/40 bg-accent/40 text-right tabular-nums"
        value={Number.isFinite(shown) ? shown : 0}
        onChange={(e) => {
          const n = parseFloat(e.target.value) || 0;
          onChange(tipo === "pct" ? n / 100 : n);
        }}
      />
    </label>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className={`mt-1 text-xl font-semibold tabular-nums ${tone === "pos" ? "text-primary" : tone === "neg" ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function SuperSimulador() {
  const [p, setP] = useState<PremissasSS>(PREMISSAS_PADRAO);
  const r = useMemo(() => calcular(p), [p]);
  const set = <K extends keyof PremissasSS>(k: K) => (v: PremissasSS[K]) => setP((s) => ({ ...s, [k]: v }));
  const setSerie = (k: "cagr" | "ipca" | "crescSga", i: number) => (v: number) =>
    setP((s) => { const n = [...s[k]] as Serie4; n[i] = v; return { ...s, [k]: n }; });

  const { dre, bp, fc, val, via, ind } = r;
  const balanceado = bp.ativo.every((a, i) => Math.abs(a - bp.passivoPl[i]) < 1);
  const tone = (v: number) => (v >= 0 ? "pos" : "neg") as "pos" | "neg";
  const chart = ANOS.map((a, i) => ({ ano: a, "Receita Bruta": dre.rb[i], EBITDA: dre.ebitda[i], "Lucro Líquido": dre.ll[i], "Liquidez Corrente": ind.liqCorrente[i] }));

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Super Simulador</h1>
          <p className="text-sm text-muted-foreground">Modelagem Simplificada 3 — altere qualquer premissa e tudo recalcula em cascata.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={balanceado ? "default" : "destructive"}>{balanceado ? "Balanço fechado" : "Balanço não fecha"}</Badge>
          <Button variant="outline" size="sm" onClick={() => setP(PREMISSAS_PADRAO)}>
            <RotateCcw className="h-4 w-4" /> Restaurar Premissas Padrão
          </Button>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="flex h-auto flex-wrap">
          {["dashboard", "premissas", "dre", "balanco", "fluxo", "valuation", "viabilidade", "indicadores"].map((t, i) => (
            <TabsTrigger key={t} value={t}>{["Dashboard", "Premissas", "DRE", "Balanço", "Fluxo de Caixa", "Valuation", "Viabilidade", "Indicadores"][i]}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Liquidez Geral (Ano 5)" value={num(ind.liqGeral[4])} />
            <Kpi label="Liquidez Corrente (Ano 5)" value={num(ind.liqCorrente[4])} />
            <Kpi label="Liquidez Seca (Ano 5)" value={num(ind.liqSeca[4])} />
            <Kpi label="Ciclo Financeiro" value={`${ind.ciclo} dias`} />
            <Kpi label="Payback" value={via.payback === null ? "Não recupera" : `${num(via.payback)} anos`} tone={via.payback === null ? "neg" : "pos"} />
            <Kpi label="VPL" value={`R$ ${brl(via.vpl)}`} tone={tone(via.vpl)} />
            <Kpi label="TIR" value={via.tir === null ? "n/d" : pct(via.tir)} tone={via.tir !== null && via.tir > p.tma ? "pos" : "neg"} />
            <Kpi label="Índice de Lucratividade" value={num(via.il)} tone={via.il >= 1 ? "pos" : "neg"} />
            <Kpi label="Firm Value" value={`R$ ${brl(val.firmValue)}`} />
            <Kpi label="Equity Value" value={`R$ ${brl(val.equityValue)}`} tone={tone(val.equityValue)} />
            <Kpi label="WACC" value={pct(val.wacc)} />
            <Kpi label="Lucro Líquido (Ano 5)" value={`R$ ${brl(dre.ll[4])}`} tone={tone(dre.ll[4])} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">Receita Bruta × EBITDA × Lucro Líquido</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ano" /><YAxis tickFormatter={(v) => `${(v / 1e6).toFixed(1)}M`} />
                    <Tooltip formatter={(v: number) => `R$ ${brl(v)}`} /><Legend />
                    <Bar dataKey="Receita Bruta" fill="var(--color-chart-1)" />
                    <Bar dataKey="EBITDA" fill="var(--color-chart-2)" />
                    <Bar dataKey="Lucro Líquido" fill="var(--color-chart-3)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Evolução da Liquidez Corrente</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer>
                  <LineChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="ano" /><YAxis />
                    <Tooltip formatter={(v: number) => num(v)} />
                    <Line type="monotone" dataKey="Liquidez Corrente" stroke="var(--color-chart-1)" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="premissas" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Crescimento e Inflação (Ano 2 a Ano 5)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {([["cagr", "CAGR Receita"], ["ipca", "IPCA / Reajuste de Custos"], ["crescSga", "Crescimento de SG&A"]] as const).map(([k, l]) => (
                <div key={k} className="grid grid-cols-2 gap-2 md:grid-cols-5 md:items-end">
                  <div className="col-span-2 text-sm font-medium md:col-span-1">{l}</div>
                  {p[k].map((v, i) => <Campo key={i} label={ANOS[i + 1]} value={v} onChange={setSerie(k, i)} />)}
                </div>
              ))}
            </CardContent>
          </Card>
          {[
            { t: "Operacionais", c: [["receitaBruta", "Receita Bruta Ano 1", "brl"], ["impostos", "Impostos sobre Vendas"], ["cmv", "CMV sobre Receita Líquida"], ["sgaFixa", "Despesa Fixa SG&A Ano 1", "brl"], ["despVar", "Despesas Variáveis s/ RL"], ["inadimplencia", "Inadimplência s/ RB"], ["pme", "Prazo Médio Estocagem (dias)", "num"], ["pmr", "Prazo Médio Recebimento (dias)", "num"], ["pmp", "Prazo Médio Pagamento (dias)", "num"], ["taxaAplicacao", "Taxa de Aplicação Financeira"]] },
            { t: "Investimento", c: [["capex", "Capex Ano 1", "brl"], ["crescCapex", "Crescimento do Capex a.a."], ["depreciacao", "Taxa de Depreciação Anual"]] },
            { t: "Financiamento", c: [["aporte", "Aporte de Capital Próprio Ano 1", "brl"], ["emprestimo", "Empréstimo Captado Ano 1", "brl"], ["jurosEmp", "Juros do Empréstimo a.a."], ["prazoAmort", "Prazo de Amortização (anos)", "num"], ["dividendos", "Distribuição de Dividendos s/ LL"], ["ir", "IR/CSLL sobre o Lucro"]] },
            { t: "Valuation (WACC)", c: [["rf", "Taxa Livre de Risco Rf"], ["beta", "Beta", "num"], ["erp", "Prêmio de Risco de Mercado"], ["pesoE", "Capital Próprio E/(D+E)"], ["pesoD", "Capital de Terceiros D/(D+E)"], ["g", "Crescimento na Perpetuidade g"]] },
            { t: "Viabilidade", c: [["investimentoInicial", "Investimento Inicial do Projeto", "brl"], ["tma", "TMA (Taxa Mínima de Atratividade)"]] },
          ].map((sec) => (
            <Card key={sec.t}>
              <CardHeader><CardTitle className="text-base">{sec.t}</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {sec.c.map(([k, l, tp]) => (
                  <Campo key={k} label={l} tipo={(tp as "brl" | "num") ?? "pct"} value={p[k as keyof PremissasSS] as number} onChange={set(k as keyof PremissasSS) as (v: number) => void} />
                ))}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="dre">
          <Tabela linhas={[
            { label: "Receita Bruta", v: dre.rb, total: true },
            { label: "(-) Impostos sobre Vendas", v: dre.imp.map((x) => -x) },
            { label: "Receita Líquida", v: dre.rl, total: true },
            { label: "(-) CMV", v: dre.cmv.map((x) => -x) },
            { label: "Lucro Bruto", v: dre.lb, total: true },
            { label: "Margem Bruta", v: dre.lb.map((x, i) => x / dre.rl[i]), fmt: "pct", sub: true },
            { label: "(-) Despesas Fixas SG&A", v: dre.sga.map((x) => -x) },
            { label: "(-) Despesas Variáveis", v: dre.dv.map((x) => -x) },
            { label: "(-) Inadimplência", v: dre.inad.map((x) => -x) },
            { label: "EBITDA", v: dre.ebitda, total: true },
            { label: "Margem EBITDA", v: ind.margemEbitda, fmt: "pct", sub: true },
            { label: "(-) Depreciação", v: dre.dep.map((x) => -x) },
            { label: "EBIT", v: dre.ebit, total: true },
            { label: "(+) Receita Financeira", v: dre.recFin },
            { label: "(-) Juros do Empréstimo", v: dre.juros.map((x) => -x) },
            { label: "LAIR", v: dre.lair, total: true },
            { label: "(-) IR/CSLL", v: dre.ir.map((x) => -x) },
            { label: "Lucro Líquido", v: dre.ll, total: true },
            { label: "Margem Líquida", v: ind.margemLiq, fmt: "pct", sub: true },
            { label: "Dividendos distribuídos", v: dre.divid },
          ]} />
        </TabsContent>

        <TabsContent value="balanco">
          <Tabela linhas={[
            "Ativo",
            { label: "Caixa", v: bp.caixa },
            { label: "Contas a Receber", v: bp.ar },
            { label: "Estoques", v: bp.est },
            { label: "Imobilizado Líquido", v: bp.imob },
            { label: "Total do Ativo", v: bp.ativo, total: true },
            "Passivo + PL",
            { label: "Contas a Pagar (Fornecedores)", v: bp.ap },
            { label: "Empréstimos", v: bp.empSaldo },
            { label: "Patrimônio Líquido", v: bp.pl },
            { label: "Total Passivo + PL", v: bp.passivoPl, total: true },
            { label: "Diferença (conferência)", v: bp.ativo.map((a, i) => a - bp.passivoPl[i]), sub: true },
          ]} />
        </TabsContent>

        <TabsContent value="fluxo">
          <Tabela linhas={[
            "Operacional",
            { label: "Lucro Líquido", v: fc.ll },
            { label: "(+) Depreciação", v: fc.dep },
            { label: "(-) Variação Contas a Receber", v: fc.dAr.map((x) => -x) },
            { label: "(-) Variação Estoques", v: fc.dEst.map((x) => -x) },
            { label: "(+) Variação Contas a Pagar", v: fc.dAp },
            { label: "Fluxo de Caixa Operacional", v: fc.fco, total: true },
            "Investimento",
            { label: "(-) Capex", v: fc.fci },
            { label: "Fluxo de Caixa de Investimento", v: fc.fci, total: true },
            "Financiamento",
            { label: "(+) Aporte de Capital", v: fc.aporte },
            { label: "(+) Captação de Empréstimo", v: fc.captacao },
            { label: "(-) Amortização", v: fc.amort.map((x) => -x) },
            { label: "(-) Dividendos", v: fc.divid.map((x) => -x) },
            { label: "Fluxo de Caixa de Financiamento", v: fc.fcf, total: true },
            { label: "Variação de Caixa", v: fc.varCaixa, total: true },
            { label: "Saldo Final de Caixa", v: fc.caixa, total: true },
          ]} />
        </TabsContent>

        <TabsContent value="valuation" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Ke (CAPM)" value={pct(val.ke)} />
            <Kpi label="Kd líquido" value={pct(val.kd)} />
            <Kpi label="WACC" value={pct(val.wacc)} />
            <Kpi label="Firm Value" value={`R$ ${brl(val.firmValue)}`} />
            <Kpi label="Equity Value" value={`R$ ${brl(val.equityValue)}`} tone={tone(val.equityValue)} />
          </div>
          <Tabela linhas={[
            { label: "NOPAT (EBIT × (1-IR))", v: val.nopat },
            { label: "(+) Depreciação", v: val.dep },
            { label: "(-) Capex", v: val.capex.map((x) => -x) },
            { label: "(-) Variação NCG", v: val.dNcg.map((x) => -x) },
            { label: "FCFF", v: val.fcff, total: true },
            { label: "Fator de desconto", v: val.fator, fmt: "x", sub: true },
            { label: "VP do FCFF", v: val.vpFcff, total: true },
          ]} />
          <Card><CardContent className="grid gap-2 p-4 text-sm md:grid-cols-2">
            <div>Valor Terminal (Gordon): <b>R$ {brl(val.tv)}</b></div>
            <div>VP do Valor Terminal: <b>R$ {brl(val.vpTv)}</b></div>
            <div>Dívida Líquida (Ano 1): <b>R$ {brl(val.dividaLiquida)}</b></div>
            <div>Equity = Firm Value − Dívida Líquida: <b>R$ {brl(val.equityValue)}</b></div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="viabilidade" className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="VPL" value={`R$ ${brl(via.vpl)}`} tone={tone(via.vpl)} />
            <Kpi label="TIR" value={via.tir === null ? "n/d" : pct(via.tir)} />
            <Kpi label="Índice de Lucratividade" value={num(via.il)} tone={via.il >= 1 ? "pos" : "neg"} />
            <Kpi label="Payback Simples" value={via.payback === null ? "Não recupera" : `${num(via.payback)} anos`} />
          </div>
          <Tabela colunas={["Ano 0", ...ANOS]} linhas={[
            { label: "Fluxo do Projeto", v: via.fluxo, total: true },
            { label: "Fluxo Acumulado", v: via.acumulado },
          ]} />
          <p className="text-sm text-muted-foreground">
            {via.vpl >= 0 ? "Projeto viável: o VPL é positivo à TMA informada." : "Projeto inviável à TMA informada: o VPL é negativo."}
          </p>
        </TabsContent>

        <TabsContent value="indicadores">
          <Tabela linhas={[
            "Lucratividade",
            { label: "Receita Bruta", v: ind.rb }, { label: "Receita Líquida", v: ind.rl },
            { label: "% CMV", v: ind.cmvPct, fmt: "pct" }, { label: "Lucro Bruto", v: ind.lb },
            { label: "% Margem de Contribuição", v: ind.mcPct, fmt: "pct" }, { label: "EBITDA", v: ind.ebitda },
            { label: "% Margem EBITDA", v: ind.margemEbitda, fmt: "pct" }, { label: "Lucro Líquido", v: ind.ll },
            { label: "% Margem Líquida", v: ind.margemLiq, fmt: "pct" },
            "Liquidez",
            { label: "Ativo Circulante", v: ind.ac }, { label: "Passivo Circulante", v: ind.pc },
            { label: "Passivo Não Circulante", v: ind.pnc },
            { label: "Liquidez Geral", v: ind.liqGeral, fmt: "x" }, { label: "Liquidez Corrente", v: ind.liqCorrente, fmt: "x" },
            { label: "Liquidez Seca", v: ind.liqSeca, fmt: "x" },
            "Estrutura de Capital",
            { label: "Patrimônio Líquido", v: ind.pl }, { label: "% Participação de Terceiros", v: ind.partTerceiros, fmt: "pct" },
            { label: "% Endividamento Geral", v: ind.endividamento, fmt: "pct" }, { label: "% Composição do Endividamento", v: ind.composicao, fmt: "pct" },
            { label: "% Imobilização do PL", v: ind.imobPl, fmt: "pct" },
            "Ponto de Equilíbrio",
            { label: "Despesas Fixas", v: ind.despFixas }, { label: "Ponto de Equilíbrio Financeiro", v: ind.pe },
            "Rentabilidade",
            { label: "ROE", v: ind.roe, fmt: "pct" }, { label: "ROA", v: ind.roa, fmt: "pct" }, { label: "ROIC", v: ind.roic, fmt: "pct" },
            { label: "Geração de Caixa", v: ind.geracaoCaixa }, { label: "% Geração de Caixa", v: ind.geracaoCaixaPct, fmt: "pct" },
            { label: "Saldo de Caixa Acumulado", v: ind.caixa },
            "Ciclo Financeiro",
            { label: "Ciclo Financeiro (dias)", v: ANOS.map(() => ind.ciclo), fmt: "dias" },
            { label: "Giro de Caixa", v: ANOS.map(() => ind.giroCaixa), fmt: "x" },
            { label: "NCG", v: ind.ncg }, { label: "% NCG sobre Receita", v: ind.ncgPct, fmt: "pct" },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
