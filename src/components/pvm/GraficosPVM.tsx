import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, LabelList, Legend, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ResultadoPVM, TransicaoPVM } from "@/lib/pvm";
import { brl, brlCompacto, mesCurtoPVM, pct2, pctSinal } from "@/lib/analise-pvm/importacao";
import { eixoTick, estiloTooltip } from "@/components/volatilidade/ui";

const COR = { navy: "var(--vol-ink)", verde: "var(--vol-good)", vermelho: "var(--vol-bad)", ouro: "var(--vol-gold)" };
const SERIES = { volume: "oklch(0.42 0.09 258)", preco: "oklch(0.727 0.139 89)", mix: "oklch(0.62 0.09 200)" };
const compacto = (v: number) => brlCompacto(v).replace("R$ ", "");

type PropsRotulo = { x?: number | string; y?: number | string; width?: number | string; height?: number | string; value?: number | string };
const num = (v: number | string | undefined) => Number(v ?? 0);
/** Rótulo sem quebra de linha acima da barra (vertical). */
const RotuloTopo = (p: PropsRotulo) => (
  <text x={num(p.x) + num(p.width) / 2} y={num(p.y) - 6} textAnchor="middle" fill="var(--vol-text)" fontSize={12} fontWeight={600}>{brlCompacto(num(p.value))}</text>
);
/** Rótulo sem quebra na ponta da barra horizontal (à direita se positivo, à esquerda se negativo). */
const RotuloPonta = (p: PropsRotulo) => {
  const v = num(p.value), x = num(p.x), w = num(p.width), y = num(p.y) + num(p.height) / 2;
  const fim = v >= 0 ? Math.max(x, x + w) + 4 : Math.min(x, x + w) - 4;
  return <text x={fim} y={y} dy={4} textAnchor={v >= 0 ? "start" : "end"} fill="var(--vol-text)" fontSize={11}>{brlCompacto(v)}</text>;
};

/** Cascata da receita: barra empilhada com série invisível de base. */
export function Cascata({ r }: { r: ResultadoPVM }) {
  const t = r.total;
  let acum = t.r0;
  const etapas: Array<{ nome: string; base: number; valor: number; real: number; tipo: "total" | "efeito" }> = [{ nome: "Receita anterior", base: 0, valor: t.r0, real: t.r0, tipo: "total" }];
  for (const [nome, v] of [["Ef. Volume", t.volume], ["Ef. Preço", t.preco], ["Ef. Mix", t.mix]] as const) {
    etapas.push({ nome, base: v >= 0 ? acum : acum + v, valor: Math.abs(v), real: v, tipo: "efeito" });
    acum += v;
  }
  etapas.push({ nome: "Receita atual", base: 0, valor: t.r1, real: t.r1, tipo: "total" });
  const niveis = [t.r0, t.r1, ...etapas.filter(e => e.tipo === "efeito").flatMap(e => [e.base, e.base + e.valor])];
  const min = Math.min(...niveis), max = Math.max(...niveis);
  const folga = Math.max((max - min) * 0.35, max * 0.02);
  const piso = Math.max(0, min - folga);
  const cor = (e: (typeof etapas)[number]) => (e.tipo === "total" ? COR.navy : e.real >= 0 ? COR.verde : COR.vermelho);
  return (
    <div className="vol-chart" style={{ height: 340 }} role="img" data-pvm-chart="cascata" aria-label="Cascata da receita: anterior, efeitos volume, preço e mix, receita atual">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={etapas} margin={{ top: 28, right: 12, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis dataKey="nome" tick={{ ...eixoTick, fontSize: 12, fill: "var(--vol-text)" }} />
          <YAxis domain={[piso, max + folga * 0.3]} allowDataOverflow tick={eixoTick} tickFormatter={compacto} width={72} />
          <Tooltip cursor={{ fill: "var(--vol-paper)" }} content={({ active, payload }) => {
            const e = payload?.[0]?.payload as (typeof etapas)[number] | undefined;
            return active && e ? (
              <div style={estiloTooltip} className="border p-3 shadow-md">
                <p className="font-semibold">{e.nome}</p>
                <p>{brl(e.real)}</p>
                <p className="text-vol-muted">{e.tipo === "efeito" ? `${pctSinal(t.r0 ? e.real / t.r0 : 0)} sobre a receita base` : `${pct2(t.r0 ? e.real / t.r0 : 0)} da receita base`}</p>
              </div>) : null;
          }} />
          <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="valor" stackId="w" isAnimationActive={false} radius={[4, 4, 0, 0]}>
            {etapas.map((e, i) => <Cell key={i} fill={cor(e)} />)}
            <LabelList dataKey="real" content={RotuloTopo} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ComparativoNiveis({ dados }: { dados: Array<{ nivel: string; volume: number; preco: number; mix: number }> }) {
  return (
    <div className="vol-chart" style={{ height: 260 }} role="img" aria-label="Efeitos volume, preço e mix por nível de análise">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis dataKey="nivel" tick={{ ...eixoTick, fill: "var(--vol-text)" }} />
          <YAxis tick={eixoTick} tickFormatter={compacto} width={72} />
          <ReferenceLine y={0} stroke="var(--vol-muted)" />
          <Tooltip formatter={(v: number, n: string) => [brl(v), n]} contentStyle={estiloTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="volume" name="Ef. Volume" fill={SERIES.volume} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="preco" name="Ef. Preço" fill={SERIES.preco} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="mix" name="Ef. Mix" fill={SERIES.mix} radius={[3, 3, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Ranking({ r, limite = 25 }: { r: ResultadoPVM; limite?: number }) {
  const dados = [...r.itens].sort((a, b) => Math.abs(b.total) - Math.abs(a.total)).slice(0, limite).sort((a, b) => a.total - b.total)
    .map(i => ({ item: i.item, total: i.total }));
  return (
    <div className="vol-chart" style={{ height: Math.max(220, dados.length * 30 + 40) }} role="img" aria-label="Ranking dos itens pelo efeito total">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid horizontal={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis type="number" tick={eixoTick} tickFormatter={compacto} domain={[(min: number) => Math.min(0, min * 1.45), (max: number) => Math.max(0, max * 1.45)]} />
          <YAxis type="category" dataKey="item" width={150} tick={{ ...eixoTick, fill: "var(--vol-text)" }} interval={0} />
          <ReferenceLine x={0} stroke="var(--vol-muted)" />
          <Tooltip formatter={(v: number) => [brl(v), "Efeito total"]} contentStyle={estiloTooltip} />
          <Bar dataKey="total" isAnimationActive={false} radius={3}>
            {dados.map((d, i) => <Cell key={i} fill={d.total >= 0 ? COR.verde : COR.vermelho} />)}
            <LabelList dataKey="total" content={RotuloPonta} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EvolucaoMensal({ transicoes }: { transicoes: TransicaoPVM[] }) {
  const dados = transicoes.filter(t => t.resultado).map(t => ({
    nome: `${mesCurtoPVM(t.base)}→${mesCurtoPVM(t.atual)}`,
    volume: t.resultado!.total.volume, preco: t.resultado!.total.preco, mix: t.resultado!.total.mix, variacao: t.resultado!.total.dR,
  }));
  return (
    <div className="vol-chart" style={{ height: 320 }} role="img" aria-label="Efeitos por mês e variação da receita">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} stackOffset="sign" margin={{ top: 10, right: 10, left: 4, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--vol-border)" strokeDasharray="3 3" />
          <XAxis dataKey="nome" tick={{ ...eixoTick, fill: "var(--vol-text)" }} />
          <YAxis tick={eixoTick} tickFormatter={compacto} width={72} />
          <ReferenceLine y={0} stroke="var(--vol-muted)" />
          <Tooltip formatter={(v: number, n: string) => [brl(v), n]} contentStyle={estiloTooltip} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="volume" name="Ef. Volume" stackId="e" fill={SERIES.volume} isAnimationActive={false} />
          <Bar dataKey="preco" name="Ef. Preço" stackId="e" fill={SERIES.preco} isAnimationActive={false} />
          <Bar dataKey="mix" name="Ef. Mix" stackId="e" fill={SERIES.mix} isAnimationActive={false} />
          <Line dataKey="variacao" name="Variação da receita" stroke="var(--vol-text)" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
