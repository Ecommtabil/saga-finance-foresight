import { RotateCcw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { diasTexto, percentualTexto } from "@/lib/ncg/apresentacao";
import { formatarMoeda, type PremissasNCG } from "@/lib/ncg/premissas";
import { simularNCG, SIMULACAO_NEUTRA, type AlavancasNCG } from "@/lib/ncg/simulacao";
import { SecaoNCG, StatusNCG } from "./MemorialNCG";

interface Props { premissas: PremissasNCG; alavancas: AlavancasNCG; onChange: (v: AlavancasNCG) => void }

export function SimulacoesNCG({ premissas, alavancas, onChange }: Props) {
  const { atual, simulada, prazos, impactoDia, variacao } = simularNCG(premissas, alavancas);
  const controles: { chave: keyof AlavancasNCG; titulo: string; limite: number }[] = [
    { chave: "pmr", titulo: "PMR — Recebimento", limite: 30 },
    { chave: "pme", titulo: "PME — Estoques", limite: 30 },
    { chave: "pmp", titulo: "PMP — Fornecedores", limite: 30 },
    { chave: "vendas", titulo: "Variação das vendas", limite: 50 },
  ];
  const dados = [{ nome: "NCG atual", valor: atual.ncg.total }, { nome: "NCG simulada", valor: simulada.ncg.total }];
  return <div className="min-w-0 space-y-8 text-ncg-ink">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Simulações de capital de giro</h2><Button variant="outline" onClick={() => onChange({ ...SIMULACAO_NEUTRA })}><RotateCcw/>Resetar simulação</Button></div>
    <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
      {controles.map(({ chave, titulo, limite }) => {
        const vendas = chave === "vendas";
        const valor = alavancas[chave];
        return <section key={chave} className="min-w-0 space-y-4">
          <div className="flex items-start justify-between gap-3"><label id={`rotulo-${chave}`} className="text-sm font-semibold">{titulo}</label><output className="shrink-0 text-sm font-semibold tabular-nums text-ncg-ink">{valor > 0 ? "+" : ""}{valor}{vendas ? "%" : " dias"}</output></div>
          <Slider aria-labelledby={`rotulo-${chave}`} min={-limite} max={limite} step={1} value={[valor]} onValueChange={([v]) => { if (v !== undefined) onChange({ ...alavancas, [chave]: v }); }} className="[&_[data-slot]]:text-ncg-ink"/>
          <div className="flex justify-between text-xs text-ncg-muted"><span>−{limite}{vendas ? "%" : " dias"}</span><span>0</span><span>+{limite}{vendas ? "%" : " dias"}</span></div>
          {vendas ? <p className="text-sm text-ncg-muted">Vendas do período: {formatarMoeda(premissas.vendasBrutas)} → {formatarMoeda(premissas.vendasBrutas * (1 + valor / 100))}</p> : <><p className="text-sm text-ncg-muted">Prazo atual: {diasTexto(atual.prazos[chave])} → simulado: <strong className="text-ncg-ink">{diasTexto(prazos[chave])}</strong></p><p className="text-sm text-ncg-positive">Cada dia {chave === "pmp" ? "a mais" : "a menos"} de {chave.toUpperCase()} libera {formatarMoeda(impactoDia[chave])}.</p>{atual.prazos[chave] + valor < 0 && <p className="text-xs text-ncg-muted">Prazo limitado a zero dias.</p>}</>}
        </section>;
      })}
    </div>
    <p className="border-l-4 border-ncg-gold bg-ncg-gold/10 p-4 text-sm leading-relaxed">Premissa da simulação de vendas: CMV/CPV e compras variam proporcionalmente às vendas, mantendo os prazos. Despesas fixas, reserva, outros ativos/passivos e caixa permanecem iguais. As simulações não alteram as Premissas originais.</p>
    <SecaoNCG titulo="Resultado atual x simulado">
      <div className="grid gap-4 md:grid-cols-2">{[{ nome: "Atual", r: atual }, { nome: "Simulado", r: simulada }].map(({ nome, r }) => <article key={nome} className="min-w-0 rounded-lg border border-ncg-border bg-ncg-surface p-5 shadow-[var(--ncg-shadow)]"><div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{nome}</h3><StatusNCG coberto={r.giroCoberto}/></div><dl className="space-y-5">{[
        { nome: "NCG operacional", valor: formatarMoeda(r.ncg.total), cor: "text-ncg-ink" },
        { nome: "Capital de giro total necessário", valor: formatarMoeda(r.capitalGiroTotal), cor: "text-ncg-ink" },
        { nome: "Sobra/(falta)", valor: formatarMoeda(r.sobraFalta), cor: r.giroCoberto ? "text-ncg-success" : "text-ncg-negative" },
        { nome: "Cobertura do caixa", valor: percentualTexto(r.coberturaCaixa), cor: "text-ncg-ink" },
      ].map(x => <div key={x.nome}><dt className="text-sm text-ncg-muted">{x.nome}</dt><dd className={`mt-1 break-words text-xl font-semibold tabular-nums ${x.cor}`}>{x.valor}</dd></div>)}</dl></article>)}</div>
      <div aria-live="polite" className="mt-4 border-l-4 border-ncg-gold bg-ncg-gold/10 p-5"><p className="text-sm text-ncg-muted">Variação da NCG (simulada − atual)</p><p className={`mt-1 text-2xl font-semibold ${variacao <= 0 ? "text-ncg-success" : "text-ncg-negative"}`}>{formatarMoeda(variacao)}</p><p className="mt-2 text-sm">{variacao < 0 ? `Liberação de ${formatarMoeda(-variacao)} de capital de giro.` : variacao > 0 ? `Necessidade adicional de ${formatarMoeda(variacao)} de capital de giro.` : "Sem alteração na necessidade de capital de giro."}</p></div>
    </SecaoNCG>
    <SecaoNCG titulo="Comparativo de NCG">
      <div className="ncg-chart" role="img" aria-label={`NCG atual ${formatarMoeda(atual.ncg.total)} e simulada ${formatarMoeda(simulada.ncg.total)}`}><ResponsiveContainer width="100%" height="100%"><BarChart data={dados} margin={{ top: 15, right: 15, left: 10, bottom: 10 }}><CartesianGrid vertical={false} stroke="var(--ncg-border)"/><XAxis dataKey="nome" tick={{ fill: "var(--ncg-ink)", fontSize: 12 }}/><YAxis width={65} tickFormatter={v => v.toLocaleString("pt-BR", { notation: "compact" })} tick={{ fill: "var(--ncg-muted)", fontSize: 11 }}/><ReferenceLine y={0} stroke="var(--ncg-ink)"/><Tooltip formatter={(v: number) => [formatarMoeda(v), "NCG operacional"]} contentStyle={{ background: "var(--ncg-surface)", color: "var(--ncg-ink)", borderColor: "var(--ncg-border)" }}/><Bar dataKey="valor" maxBarSize={100} isAnimationActive={false}><Cell fill="var(--ncg-ink)"/><Cell fill="var(--ncg-gold)"/></Bar></BarChart></ResponsiveContainer></div>
    </SecaoNCG>
  </div>;
}