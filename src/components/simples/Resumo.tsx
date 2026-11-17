import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bloco } from "@/components/viabilidade/ui";
import { MES_CURTO, type ResultadoEmpresa } from "@/lib/simples/calculo";
import { ORDEM_TRIBUTOS, type AnexoId } from "@/lib/simples/tabelas";
import { COR_ANEXO, COR_TRIBUTO } from "@/lib/simples/cores";
import { brl, num2, pct2, pct4 } from "@/lib/simples/formato";
import { FaixaBadge, Th } from "./ui";
import { faixaPorRbt12 } from "@/lib/simples/calculo";
import type { ConferenciaRbt12 } from "@/lib/simples/store";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Tooltip as Dica, TooltipContent as DicaConteudo, TooltipTrigger as DicaGatilho } from "@/components/ui/tooltip";

/** Compara o DAS calculado com o DAS declarado no PGDAS-D importado (tolerância de R$ 0,05 por arredondamento). */
function ConferenciaDas({ conf, calculado }: { conf?: ConferenciaRbt12; calculado: number }) {
  if (!conf || conf.das === undefined) return null;
  const dif = calculado - conf.das;
  const ok = Math.abs(dif) <= 0.05;
  return (
    <Dica>
      <DicaGatilho asChild>
        <button type="button" aria-label={ok ? "DAS confere com o PGDAS-D" : "DAS diferente do PGDAS-D"} className={`mr-1 inline-flex align-[-2px] ${ok ? "text-via-good" : "text-[var(--sn-amarelo)]"}`}>
          {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
        </button>
      </DicaGatilho>
      <DicaConteudo className="max-w-xs text-xs">
        DAS declarado no PGDAS-D ({conf.arquivo}): {brl(conf.das)}.{ok ? " Confere com o cálculo." : ` Diferença de ${brl(dif)}.`}
      </DicaConteudo>
    </Dica>
  );
}

const eixoR = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi` : v >= 1e3 ? `${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(v));
const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--via-border)", fontSize: 12 }, labelStyle: { color: "var(--via-ink)", fontWeight: 600 } };

function Kpi({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-via-border bg-via-surface p-4 shadow-[var(--via-shadow)]">
      <span className="absolute inset-y-3 left-0 w-1 rounded-r bg-via-gold" />
      <p className="text-xs font-medium text-via-muted">{titulo}</p>
      <p className="mt-1 truncate text-xl font-bold tabular-nums text-via-ink md:text-2xl">{valor}</p>
      <p className="mt-1 text-[11px] text-via-muted">{sub}</p>
    </div>
  );
}

export function ResumoConsolidado({ anexos, r, ano, conferencias = {} }: { anexos: AnexoId[]; r: ResultadoEmpresa; ano?: number; conferencias?: Record<string, ConferenciaRbt12> }) {
  const k = r.consolidado;
  const barras = k.dasMensal.map((m) => ({ ...m, nome: MES_CURTO[m.mes] }));
  const linha = r.rbt12.map((x, mes) => {
    const p: Record<string, number | string | null> = { nome: MES_CURTO[mes], rbt12: x.valor };
    for (const a of anexos) { const m = r.anexos[a]?.meses[mes]; p[`ae${a}`] = m?.calculado ? m.ae * 100 : null; }
    return p;
  });
  const pizza = ORDEM_TRIBUTOS.map((t) => ({ nome: t, valor: k.porTributo[t] })).filter((x) => x.valor > 0.005);
  const totalPizza = pizza.reduce((s, x) => s + x.valor, 0);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo="Faturamento no ano" valor={brl(k.faturamento)} sub="Receita bruta de todos os anexos" />
        <Kpi titulo="DAS total no ano" valor={brl(k.das)} sub={`DAS ÷ faturamento: ${pct2(k.aliquotaPaga)}`} />
        <Kpi titulo="Alíquota efetiva média ponderada" valor={pct4(k.aeMediaPonderada)} sub="Média das alíquotas efetivas pesada pela receita" />
        <Kpi titulo="Economia com ST / monofásico / retenção" valor={brl(k.economia)} sub="Imposto sem segregação − imposto pago" />
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Bloco titulo="DAS mensal por anexo">
          <div className="sn-chart" data-sn-chart="DAS mensal por anexo">
            <ResponsiveContainer>
              <BarChart data={barras} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={eixoR} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [brl(v), n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {anexos.map((a, i) => <Bar key={a} dataKey={a} name={`Anexo ${a}`} stackId="das" fill={COR_ANEXO[a]} radius={i === anexos.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={34} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
        <Bloco titulo="Alíquota efetiva × RBT12">
          <div className="sn-chart" data-sn-chart="Alíquota efetiva x RBT12">
            <ResponsiveContainer>
              <ComposedChart data={linha} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#eef0f4" />
                <XAxis dataKey="nome" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="ae" tickFormatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={46} />
                <YAxis yAxisId="rbt" orientation="right" tickFormatter={eixoR} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [n === "RBT12" ? brl(v) : `${v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="rbt" dataKey="rbt12" name="RBT12" fill="#dfe5ee" radius={[4, 4, 0, 0]} maxBarSize={30} />
                {anexos.map((a) => <Line key={a} yAxisId="ae" type="monotone" dataKey={`ae${a}`} name={`Alíq. efetiva Anexo ${a}`} stroke={COR_ANEXO[a]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls={false} />)}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Bloco titulo="Composição do DAS anual por tributo">
          {totalPizza > 0 ? (
            <div className="flex flex-col items-center gap-4">
              <div className="h-[220px] w-[220px] shrink-0" data-sn-chart="Composição do DAS">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pizza} dataKey="valor" nameKey="nome" innerRadius="58%" outerRadius="92%" paddingAngle={1.5} stroke="none">
                      {pizza.map((p) => <Cell key={p.nome} fill={COR_TRIBUTO[p.nome as keyof typeof COR_TRIBUTO]} />)}
                    </Pie>
                    <Tooltip {...tip} formatter={(v: number, n: string) => [`${brl(v)} (${pct2(v / totalPizza)})`, n]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full space-y-1.5 text-sm">
                {pizza.map((p) => (
                  <li key={p.nome} className="flex items-center gap-2">
                    <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: COR_TRIBUTO[p.nome as keyof typeof COR_TRIBUTO] }} />
                    <span className="w-14 font-medium text-via-ink">{p.nome}</span>
                    <span className="ml-auto tabular-nums text-via-muted">{pct2(p.valor / totalPizza)}</span>
                    <span className="w-28 text-right tabular-nums text-via-ink">{brl(p.valor)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : <p className="text-sm text-via-muted">Lance as receitas para ver a composição do DAS.</p>}
        </Bloco>
        <Bloco titulo="DAS por mês (todos os anexos)">
          <div className="sn-scroll">
            <table className="sn-table">
              <thead>
                <tr>
                  <Th>Mês</Th><Th>Receita</Th><Th>RBT12</Th><Th>Faixa</Th>
                  {anexos.map((a) => <Th key={a}>DAS Anexo {a}</Th>)}
                  <Th>Total do DAS</Th>
                </tr>
              </thead>
              <tbody>
                {k.dasMensal.map((m) => (
                  <tr key={m.mes}>
                    <td>{MES_CURTO[m.mes]}</td>
                    <td>{num2(k.receitaMensal[m.mes])}</td>
                    <td>{num2(r.rbt12[m.mes].valor)}</td>
                    <td className="!text-center"><FaixaBadge faixa={faixaPorRbt12(r.rbt12[m.mes].valor)} /></td>
                    {anexos.map((a) => <td key={a}>{num2(m[a] ?? 0)}</td>)}
                    <td className="sn-das"><ConferenciaDas conf={ano ? conferencias[`${ano}-${String(m.mes + 1).padStart(2, "0")}`] : undefined} calculado={m.total} />{num2(m.total)}</td>
                  </tr>
                ))}
                <tr className="sn-total">
                  <td>TOTAIS</td><td>{num2(k.faturamento)}</td><td /><td />
                  {anexos.map((a) => <td key={a}>{num2(r.anexos[a]?.totais.totalDas ?? 0)}</td>)}
                  <td className="sn-das">{num2(k.das)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Bloco>
      </div>
    </div>
  );
}
