import { useMemo } from "react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatBRL, formatBRLContabil } from "@/lib/finance";
import { calcularNovaLinha, tornadoNovaLinha, type PremissasNovaLinha } from "@/lib/viabilidade/nova-linha";
import { calcularComprarAlugar, curvaRevenda, revendaEmpate, type PremissasComprarAlugar } from "@/lib/viabilidade/comprar-alugar";
import { calcularMaquina, curvaMensalidade, mensalidadeEquilibrio, type PremissasMaquina } from "@/lib/viabilidade/maquina-leasing";
import { calcularEquipe, curvaMensalidadeTerc, pontoInflexao, type PremissasEquipe } from "@/lib/viabilidade/equipe-terceirizar";
import { GraficoCard } from "./ui";

const C = { ink: "var(--via-ink)", gold: "var(--via-gold)", bad: "var(--via-bad)", blue: "var(--via-blue)", muted: "var(--via-muted)", grid: "var(--via-border)" };

export function brlCompacto(v: number): string {
  const a = Math.abs(v);
  const s = v < 0 ? "−" : "";
  if (a >= 1e6) return `${s}R$ ${(a / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (a >= 1e3) return `${s}R$ ${(a / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `${s}R$ ${a.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

const eixo = { fontSize: 11, fill: "var(--via-muted)" };
const tooltip = {
  contentStyle: { borderRadius: 8, border: "1px solid var(--via-border)", fontSize: 12, boxShadow: "var(--via-shadow)" },
  formatter: (v: number) => formatBRLContabil(v),
};
const grade = <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />;

// ---------- Nova Linha ----------
export function GraficosNovaLinha({ p }: { p: PremissasNovaLinha }) {
  const r = useMemo(() => calcularNovaLinha(p), [p]);
  const t = useMemo(() => tornadoNovaLinha(p), [p]);
  const dados = r.fcl.map((f, i) => ({ ano: `Ano ${i}`, fcl: f, acumulado: r.acumulado[i] }));
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GraficoCard titulo="Fluxo de Caixa Livre por ano" subtitulo="Barras: FCL do ano · Linha dourada: acumulado">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="ano" tick={eixo} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} />
            <Tooltip {...tooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke={C.muted} />
            <Bar dataKey="fcl" name="FCL" radius={[4, 4, 0, 0]} maxBarSize={44} isAnimationActive={false}>
              {dados.map((d) => <Cell key={d.ano} fill={d.fcl < 0 ? C.bad : C.ink} />)}
            </Bar>
            <Line dataKey="acumulado" name="Acumulado" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3, fill: C.gold }} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </GraficoCard>
      <GraficoCard titulo="Sensibilidade do VPL (±10%)" subtitulo={`Impacto sobre o VPL base de ${formatBRL(t.base)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={t.itens} layout="vertical" stackOffset="sign" margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={C.grid} strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="nome" tick={eixo} tickLine={false} axisLine={false} width={96} />
            <Tooltip {...tooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine x={0} stroke={C.muted} />
            <Bar dataKey="menos" name="−10%" stackId="t" fill={C.blue} isAnimationActive={false} />
            <Bar dataKey="mais" name="+10%" stackId="t" fill={C.ink} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </GraficoCard>
    </div>
  );
}

// ---------- Comprar ou Alugar ----------
export function GraficosComprarAlugar({ p }: { p: PremissasComprarAlugar }) {
  const r = useMemo(() => calcularComprarAlugar(p), [p]);
  const curva = useMemo(() => curvaRevenda(p), [p]);
  const empate = useMemo(() => revendaEmpate(p), [p]);
  const dados = r.fluxoComprar.map((c, i) => ({ ano: `Ano ${i}`, comprar: c, alugar: r.fluxoAlugar[i] }));
  const min = curva[0].revenda, max = curva[curva.length - 1].revenda;
  const empateVisivel = empate !== null && empate >= min && empate <= max;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GraficoCard titulo="Fluxo anual: Comprar x Alugar">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={dados} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="ano" tick={eixo} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} />
            <Tooltip {...tooltip} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke={C.muted} />
            <Bar dataKey="comprar" name="Comprar" fill={C.ink} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="alugar" name="Alugar" fill={C.gold} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </GraficoCard>
      <GraficoCard titulo="VPL incremental x valor de revenda" subtitulo={empate === null ? "Sem ponto de empate" : `Empate com revenda de ${formatBRL(empate)}${empateVisivel ? "" : " (fora da faixa de ±30%)"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curva} margin={{ top: 16, right: 16, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="revenda" type="number" domain={[min, max]} tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} />
            <Tooltip {...tooltip} labelFormatter={(v) => `Revenda: ${formatBRL(Number(v))}`} />
            <ReferenceLine y={0} stroke={C.muted} />
            {empateVisivel && <ReferenceLine x={empate} stroke={C.gold} strokeDasharray="4 4" label={{ value: "Empate", position: "top", fill: C.gold, fontSize: 11 }} />}
            <ReferenceLine x={p.revenda} stroke={C.blue} strokeDasharray="2 4" label={{ value: "Premissa", position: "insideTopLeft", fill: C.blue, fontSize: 10 }} />
            <Line dataKey="vpl" name="VPL incremental" stroke={C.ink} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </GraficoCard>
    </div>
  );
}

// ---------- Máquina ----------
export function GraficosMaquina({ p }: { p: PremissasMaquina }) {
  const r = useMemo(() => calcularMaquina(p), [p]);
  const curva = useMemo(() => curvaMensalidade(p), [p]);
  const eq = useMemo(() => mensalidadeEquilibrio(p), [p]);
  const caue = [
    { nome: "Compra", custo: -r.caueCompra },
    { nome: "Leasing", custo: -r.caueLeasing },
  ];
  const min = curva[0].mensalidade, max = curva[curva.length - 1].mensalidade;
  const eqVisivel = eq !== null && eq >= min && eq <= max;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GraficoCard titulo="Custo anual equivalente (CAUE)" subtitulo="Quanto menor, melhor">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={caue} margin={{ top: 24, right: 8, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="nome" tick={eixo} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} />
            <Tooltip {...tooltip} formatter={(v: number) => formatBRL(v)} />
            <Bar dataKey="custo" name="Custo anual" radius={[4, 4, 0, 0]} maxBarSize={90} isAnimationActive={false}>
              {caue.map((d, i) => <Cell key={d.nome} fill={i === 0 ? C.ink : C.gold} />)}
              <LabelList dataKey="custo" position="top" formatter={(v: number) => formatBRL(v)} style={{ fontSize: 11, fill: "var(--via-ink)", fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </GraficoCard>
      <GraficoCard titulo="Diferença de VPL (Compra − Leasing) x mensalidade" subtitulo={eq === null ? "Sem ponto de equilíbrio" : `Equilíbrio em ${formatBRL(eq)}/mês${eqVisivel ? "" : " (fora da faixa de ±30%)"} · acima de zero, comprar é melhor`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curva} margin={{ top: 16, right: 16, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="mensalidade" type="number" domain={[min, max]} tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} />
            <Tooltip {...tooltip} labelFormatter={(v) => `Mensalidade: ${formatBRL(Number(v))}`} />
            <ReferenceLine y={0} stroke={C.muted} />
            {eqVisivel && <ReferenceLine x={eq} stroke={C.gold} strokeDasharray="4 4" label={{ value: "Equilíbrio", position: "top", fill: C.gold, fontSize: 11 }} />}
            <Line dataKey="diferenca" name="Diferença de VPL" stroke={C.ink} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </GraficoCard>
    </div>
  );
}

// ---------- Equipe ----------
export function GraficosEquipe({ p }: { p: PremissasEquipe }) {
  const r = useMemo(() => calcularEquipe(p), [p]);
  const curva = useMemo(() => curvaMensalidadeTerc(p), [p]);
  const infl = useMemo(() => pontoInflexao(p), [p]);
  const dados = r.fluxoInterno.map((x, i) => ({ ano: `Ano ${i}`, interno: -x, terc: -r.fluxoTerc[i] }));
  const min = curva[0].mensalidade, max = curva[curva.length - 1].mensalidade;
  const inflVisivel = infl !== null && infl >= min && infl <= max;
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <GraficoCard titulo="Custo líquido anual" subtitulo="Após benefício fiscal">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dados} margin={{ top: 8, right: 16, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="ano" tick={eixo} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} />
            <Tooltip {...tooltip} formatter={(v: number) => formatBRL(v)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line dataKey="interno" name="Equipe interna" stroke={C.ink} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
            <Line dataKey="terc" name="Terceirizado" stroke={C.gold} strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </GraficoCard>
      <GraficoCard titulo="VPL x mensalidade da terceirizada" subtitulo={infl === null ? "Sem ponto de inflexão" : `Ponto de inflexão em ${formatBRL(infl)}/mês${inflVisivel ? "" : " (fora da faixa de ±30%)"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={curva} margin={{ top: 16, right: 16, left: 4, bottom: 0 }}>
            {grade}
            <XAxis dataKey="mensalidade" type="number" domain={[min, max]} tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} />
            <YAxis tick={eixo} tickFormatter={brlCompacto} tickLine={false} axisLine={false} width={86} domain={["auto", "auto"]} />
            <Tooltip {...tooltip} labelFormatter={(v) => `Mensalidade: ${formatBRL(Number(v))}`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {inflVisivel && <ReferenceLine x={infl} stroke={C.bad} strokeDasharray="4 4" label={{ value: "Inflexão", position: "top", fill: C.bad, fontSize: 11 }} />}
            <Line dataKey="vplInterno" name="VPL interno" stroke={C.ink} strokeWidth={2.5} dot={false} isAnimationActive={false} />
            <Line dataKey="vplTerc" name="VPL terceirizado" stroke={C.gold} strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </GraficoCard>
    </div>
  );
}
