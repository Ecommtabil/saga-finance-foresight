import { useMemo } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceDot, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { cdfNormal, foraDeBanda, histograma, pontosCurva } from "@/lib/volatilidade/stats";
import { mesCurto, mesTexto, moeda, moedaCompacta, numero, pct, type SerieCalculada } from "@/lib/volatilidade/dados";
import { Bolinha, eixoTick, estiloTooltip } from "./ui";

const compacto = (v: number) => moedaCompacta(v).replace("R$ ", "");

export interface Destaque { serieId: string; de: number | null; ate: number | null }

interface CurvasProps {
  series: SerieCalculada[];
  pontos: number;
  normalizar: boolean;
  ocultas?: string[];
  onAlternar?: (id: string) => void;
  destaque?: Destaque | null;
  altura?: number;
  captura?: string;
}

/** Curvas normais sobrepostas, com faixas ±1/2/3DP, média tracejada e valores reais sobre o eixo. */
export function CurvasNormais({ series, pontos, normalizar, ocultas = [], onAlternar, destaque, altura = 340, captura }: CurvasProps) {
  const visiveis = series.filter(s => !ocultas.includes(s.serie.id));
  const dados = useMemo(() => {
    const base = pontosCurva(series.map(s => ({ id: s.serie.id, media: s.stats.media, desvio: s.stats.desvio })), pontos, normalizar);
    return base.map(p => {
      const o: Record<string, number | null> = { ...p };
      for (const s of series) {
        const z = Math.abs(p.x - s.stats.media) / s.stats.desvio;
        for (const k of [1, 2, 3]) o[`${s.serie.id}__b${k}`] = z <= k ? p[s.serie.id] : null;
      }
      if (destaque) {
        const s = series.find(x => x.serie.id === destaque.serieId);
        const dentro = (destaque.de === null || p.x >= destaque.de) && (destaque.ate === null || p.x <= destaque.ate);
        o.__destaque = s && dentro ? p[s.serie.id] : null;
      }
      return o;
    });
  }, [series, pontos, normalizar, destaque]);
  if (!dados.length) return <p className="text-sm text-vol-muted">Sem dados suficientes para desenhar as curvas.</p>;
  const corDestaque = series.find(s => s.serie.id === destaque?.serieId)?.serie.cor ?? "var(--vol-gold)";

  return (
    <div className="space-y-3">
      {onAlternar && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Séries exibidas">
          {series.map(s => {
            const ativa = !ocultas.includes(s.serie.id);
            return (
              <button key={s.serie.id} type="button" aria-pressed={ativa} onClick={() => onAlternar(s.serie.id)}
                className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${ativa ? "border-vol-border bg-vol-paper text-vol-text" : "border-dashed border-vol-border text-vol-muted line-through opacity-60"}`}>
                <Bolinha cor={s.serie.cor} />{s.serie.nome}
              </button>
            );
          })}
        </div>
      )}
      <div className="vol-chart" style={{ height: altura }} role="img" data-vol-chart={captura} aria-label="Curvas normais sobrepostas das séries">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dados} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
            <XAxis dataKey="x" type="number" domain={["dataMin", "dataMax"]} tick={eixoTick} tickFormatter={compacto} tickCount={8} />
            <YAxis tick={eixoTick} width={normalizar ? 36 : 8} tickFormatter={v => (normalizar ? numero(v, 1) : "")} axisLine={false} tickLine={false} />
            <Tooltip content={({ label, active }) => active && typeof label === "number" ? (
              <div style={estiloTooltip} className="border p-3 shadow-md">
                <p className="mb-1 font-semibold">{moeda(label)}</p>
                {visiveis.map(s => (
                  <p key={s.serie.id} className="flex items-center gap-2"><Bolinha cor={s.serie.cor} />{s.serie.nome}: {pct(cdfNormal(label, s.stats.media, s.stats.desvio))} de chance de ficar abaixo</p>
                ))}
              </div>) : null} />
            {visiveis.flatMap(s => [3, 2, 1].map(k => (
              <Area key={`${s.serie.id}-${k}`} dataKey={`${s.serie.id}__b${k}`} type="monotone" stroke="none" fill={s.serie.cor} fillOpacity={k === 1 ? 0.22 : k === 2 ? 0.12 : 0.06} isAnimationActive={false} connectNulls={false} />
            )))}
            {destaque && <Area dataKey="__destaque" type="monotone" stroke={corDestaque} strokeWidth={0} fill="var(--vol-gold)" fillOpacity={0.55} isAnimationActive={false} />}
            {visiveis.map(s => <Line key={s.serie.id} dataKey={s.serie.id} type="monotone" stroke={s.serie.cor} strokeWidth={2.5} dot={false} isAnimationActive={false} />)}
            {visiveis.map(s => <ReferenceLine key={`m-${s.serie.id}`} x={s.stats.media} stroke={s.serie.cor} strokeDasharray="5 4" strokeWidth={1.5} />)}
            {destaque?.de != null && <ReferenceLine x={destaque.de} stroke="var(--vol-gold)" strokeWidth={2} />}
            {destaque?.ate != null && <ReferenceLine x={destaque.ate} stroke="var(--vol-gold)" strokeWidth={2} />}
            {visiveis.flatMap(s => s.valores.map((v, i) => (
              <ReferenceDot key={`${s.serie.id}-${i}`} x={v} y={0} r={4} fill={s.serie.cor} stroke="var(--vol-surface)" strokeWidth={1.5} ifOverflow="extendDomain" />
            )))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Série mês a mês com média e bandas ±1DP/±2DP; meses fora de ±2DP em vermelho. */
export function SerieTemporal({ s, captura }: { s: SerieCalculada; captura?: string }) {
  const { media: mu, desvio: sd } = s.stats;
  const fora = new Set(foraDeBanda(s.valores, mu, sd, 2));
  const dados = s.meses.map((m, i) => ({ mes: mesCurto(m), mesLongo: mesTexto(m), valor: s.valores[i], b1: [mu - sd, mu + sd], b2: [mu - 2 * sd, mu + 2 * sd], fora: fora.has(i) }));
  return (
    <div className="vol-chart" style={{ height: 260 }} role="img" data-vol-chart={captura} aria-label={`Série temporal de ${s.serie.nome}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={eixoTick} />
          <YAxis tick={eixoTick} tickFormatter={compacto} width={70} domain={["auto", "auto"]} />
          <Tooltip content={({ active, payload }) => {
            const d = payload?.[0]?.payload as (typeof dados)[number] | undefined;
            return active && d ? (
              <div style={estiloTooltip} className="border p-3 shadow-md">
                <p className="font-semibold">{d.mesLongo}</p>
                <p>{s.serie.nome}: {moeda(d.valor)}</p>
                <p className="text-vol-muted">Média: {moeda(mu)}</p>
                {d.fora && <p className="font-medium text-vol-bad">Fora de ±2DP (atípico)</p>}
              </div>) : null;
          }} />
          <Area dataKey="b2" stroke="none" fill={s.serie.cor} fillOpacity={0.08} isAnimationActive={false} />
          <Area dataKey="b1" stroke="none" fill={s.serie.cor} fillOpacity={0.16} isAnimationActive={false} />
          <ReferenceLine y={mu} stroke={s.serie.cor} strokeDasharray="5 4" />
          <Line dataKey="valor" stroke={s.serie.cor} strokeWidth={2.5} isAnimationActive={false}
            dot={(p: { cx?: number; cy?: number; index?: number }) => (
              <circle key={p.index} cx={p.cx} cy={p.cy} r={dados[p.index ?? 0]?.fora ? 6 : 3.5}
                fill={dados[p.index ?? 0]?.fora ? "var(--vol-bad)" : s.serie.cor} stroke="var(--vol-surface)" strokeWidth={1.5} />
            )} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Histograma dos valores reais com a contagem esperada pela normal teórica. */
export function Histograma({ s, captura }: { s: SerieCalculada; captura?: string }) {
  const dados = histograma(s.valores, s.stats.media, s.stats.desvio).map(c => ({
    faixa: `${compacto(c.inicio)}–${compacto(c.fim)}`, inicio: c.inicio, fim: c.fim, contagem: c.contagem, esperado: c.esperado,
  }));
  return (
    <div className="vol-chart" style={{ height: 260 }} role="img" data-vol-chart={captura} aria-label={`Histograma de ${s.serie.nome}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis dataKey="faixa" tick={{ ...eixoTick, fontSize: 10 }} interval={0} />
          <YAxis tick={eixoTick} allowDecimals={false} width={28} />
          <Tooltip content={({ active, payload }) => {
            const d = payload?.[0]?.payload as (typeof dados)[number] | undefined;
            return active && d ? (
              <div style={estiloTooltip} className="border p-3 shadow-md">
                <p className="font-semibold">{moeda(d.inicio)} a {moeda(d.fim)}</p>
                <p>Meses observados: {d.contagem}</p>
                <p className="text-vol-muted">Esperado pela normal: {numero(d.esperado, 1)}</p>
              </div>) : null;
          }} />
          <Bar dataKey="contagem" fill={s.serie.cor} fillOpacity={0.75} radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Line dataKey="esperado" type="monotone" stroke="var(--vol-gold)" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Diferença mensal recebimento − faturamento e acumulado. */
export function GapFatRec({ fat, rec, captura }: { fat: SerieCalculada; rec: SerieCalculada; captura?: string }) {
  let acum = 0;
  const dados = fat.meses.flatMap((m, i) => {
    const j = rec.meses.indexOf(m);
    if (j < 0) return [];
    const gap = rec.valores[j] - fat.valores[i];
    acum += gap;
    return [{ mes: mesCurto(m), mesLongo: mesTexto(m), gap, acum }];
  });
  if (!dados.length) return <p className="text-sm text-vol-muted">Não há meses com as duas séries preenchidas.</p>;
  return (
    <div className="vol-chart" style={{ height: 280 }} role="img" data-vol-chart={captura} aria-label="Gap entre recebimento e faturamento">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 10, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis dataKey="mes" tick={eixoTick} />
          <YAxis tick={eixoTick} tickFormatter={compacto} width={70} />
          <ReferenceLine y={0} stroke="var(--vol-muted)" />
          <Tooltip content={({ active, payload }) => {
            const d = payload?.[0]?.payload as (typeof dados)[number] | undefined;
            return active && d ? (
              <div style={estiloTooltip} className="border p-3 shadow-md">
                <p className="font-semibold">{d.mesLongo}</p>
                <p>Recebimento − faturamento: {moeda(d.gap)}</p>
                <p className="text-vol-muted">Acumulado: {moeda(d.acum)}</p>
              </div>) : null;
          }} />
          <Bar dataKey="gap" radius={[5, 5, 0, 0]} isAnimationActive={false}>
            {dados.map((d, i) => <Cell key={i} fill={d.gap >= 0 ? "var(--vol-good)" : "var(--vol-bad)"} />)}
          </Bar>
          <Line dataKey="acum" type="monotone" stroke="var(--vol-text)" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
