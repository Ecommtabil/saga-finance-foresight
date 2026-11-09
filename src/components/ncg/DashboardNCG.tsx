import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cascataNCG, diasTexto, faixaCobertura, percentualTexto } from "@/lib/ncg/apresentacao";
import { formatarMoeda } from "@/lib/ncg/premissas";
import { SecaoNCG, StatusNCG, type NcgResultadoProps } from "./MemorialNCG";
import { diagnosticoNCG } from "@/lib/ncg/relatorio-dados";

const cores: Record<string, string> = {
  positivo: "var(--ncg-positive)", negativo: "var(--ncg-negative)",
  total: "var(--ncg-ink)", reserva: "var(--ncg-gold)",
  caixa: "var(--ncg-muted)", coberto: "var(--ncg-success)",
};
const marcas = { critica: "text-ncg-negative", atencao: "text-ncg-gold", coberta: "text-ncg-success" };
const compacto = (v: number) => v.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

export function DashboardNCG({ premissas: p, resultado: r }: NcgResultadoProps) {
  const faixa = faixaCobertura(r.coberturaCaixa);
  const gauge = [{ valor: 70, cor: cores.negativo }, { valor: 30, cor: cores.reserva }, { valor: 50, cor: cores.coberto }];
  const angulo = Math.PI * (1 - Math.max(0, Math.min(1.5, r.coberturaCaixa)) / 1.5);
  const ciclo = [
    { nome: "Operacional", espera: 0, pme: r.prazos.pme, pmr: r.prazos.pmr, pmp: 0, financeiro: 0 },
    { nome: "Fornecedores", espera: 0, pme: 0, pmr: 0, pmp: r.prazos.pmp, financeiro: 0 },
    { nome: "Financeiro", espera: Math.min(r.prazos.pmp, r.prazos.cicloOperacional), pme: 0, pmr: 0, pmp: 0, financeiro: Math.abs(r.prazos.cicloFinanceiro) },
  ];
  return <div className="min-w-0 space-y-8 text-ncg-ink">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Dashboard de capital de giro</h2><StatusNCG coberto={r.giroCoberto}/></div>
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {[
        { nome: "NCG operacional", valor: formatarMoeda(r.ncg.total), detalhe: "Sem reserva de segurança", classe: "text-ncg-ink" },
        { nome: "Capital de giro total necessário", valor: formatarMoeda(r.capitalGiroTotal), detalhe: "NCG + reserva de segurança", classe: "text-ncg-ink" },
        { nome: "Sobra/(falta)", valor: formatarMoeda(r.sobraFalta), detalhe: r.giroCoberto ? "Caixa suficiente" : "Capital de giro a recompor", classe: r.giroCoberto ? "text-ncg-success" : "text-ncg-negative" },
        { nome: "Cobertura do caixa", valor: percentualTexto(r.coberturaCaixa), detalhe: "Caixa / necessidade total", classe: marcas[faixa] },
      ].map(k => <article key={k.nome} className="min-w-0 rounded-lg border border-ncg-border bg-ncg-surface p-5 shadow-[var(--ncg-shadow)]"><h3 className="min-h-10 text-sm text-ncg-muted">{k.nome}</h3><p className={`mt-2 break-words text-2xl font-semibold tabular-nums ${k.classe}`}>{k.valor}</p><p className="mt-3 text-xs text-ncg-muted">{k.detalhe}</p></article>)}
    </div>
    <SecaoNCG titulo="Linha do tempo do ciclo">
      <div className="ncg-chart" role="img" aria-label={`Ciclo operacional ${diasTexto(r.prazos.cicloOperacional)}; ciclo financeiro ${diasTexto(r.prazos.cicloFinanceiro)}`}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={ciclo} layout="vertical" margin={{ left: 0, right: 25, top: 10, bottom: 15 }}>
          <CartesianGrid horizontal={false} stroke="var(--ncg-border)"/>
          <XAxis type="number" tick={{ fill: "var(--ncg-muted)", fontSize: 11 }} tickFormatter={v => `${Math.round(v)} d`}/>
          <YAxis type="category" dataKey="nome" width={95} tick={{ fill: "var(--ncg-ink)", fontSize: 12 }} axisLine={false} tickLine={false}/>
          <Tooltip formatter={(v: number, nome: string) => [diasTexto(v), nome]} contentStyle={{ background: "var(--ncg-surface)", borderColor: "var(--ncg-border)", color: "var(--ncg-ink)" }}/>
          <Bar dataKey="espera" stackId="ciclo" fill="transparent" tooltipType="none" isAnimationActive={false}/>
          <Bar dataKey="pme" name="PME" stackId="ciclo" fill="var(--ncg-positive)" barSize={26} isAnimationActive={false}/>
          <Bar dataKey="pmr" name="PMR" stackId="ciclo" fill="var(--chart-2)" isAnimationActive={false}/>
          <Bar dataKey="pmp" name="PMP" stackId="ciclo" fill="var(--ncg-muted)" isAnimationActive={false}/>
          <Bar dataKey="financeiro" name="Ciclo financeiro" stackId="ciclo" fill="var(--ncg-gold)" isAnimationActive={false}/>
        </BarChart></ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ncg-muted">{[{nome: "PME", cor: "bg-ncg-positive", v: r.prazos.pme}, {nome: "PMR", cor: "bg-chart-2", v: r.prazos.pmr}, {nome: "PMP", cor: "bg-ncg-muted", v: r.prazos.pmp}, {nome: "Ciclo financeiro", cor: "bg-ncg-gold", v: r.prazos.cicloFinanceiro}].map(x => <span key={x.nome} className="flex items-center gap-2"><i className={`h-2.5 w-2.5 rounded-sm ${x.cor}`}/>{x.nome}: {diasTexto(x.v)}</span>)}</div>
      {r.prazos.cicloFinanceiro < 0 && <p className="mt-3 text-sm text-ncg-muted">O prazo dos fornecedores supera o ciclo operacional em {diasTexto(-r.prazos.cicloFinanceiro)}; o trecho dourado representa essa folga.</p>}
    </SecaoNCG>
    <SecaoNCG titulo="Composição da NCG · cascata">
      <div className="overflow-x-auto"><div className="h-[360px] min-w-[850px]" role="img" aria-label="Cascata da NCG: componentes, reserva, total necessário, caixa e sobra ou falta">
        <ResponsiveContainer width="100%" height="100%"><BarChart data={cascataNCG(r, p)} margin={{ top: 15, right: 20, bottom: 80, left: 15 }}>
          <CartesianGrid vertical={false} stroke="var(--ncg-border)"/>
          <XAxis dataKey="nome" interval={0} angle={-35} textAnchor="end" height={55} tick={{ fill: "var(--ncg-muted)", fontSize: 11 }}/>
          <YAxis tickFormatter={compacto} width={55} tick={{ fill: "var(--ncg-muted)", fontSize: 11 }}/>
          <ReferenceLine y={0} stroke="var(--ncg-ink)"/>
          <Tooltip content={({ active, payload }) => {
            const item = payload?.[0]?.payload;
            return active && item ? <div className="rounded-lg border border-ncg-border bg-ncg-surface p-3 text-sm shadow-sm"><p>{item.nome}</p><strong>{formatarMoeda(item.valor)}</strong></div> : null;
          }}/>
          <Bar dataKey="intervalo" maxBarSize={46} isAnimationActive={false}>{cascataNCG(r, p).map(x => <Cell key={x.nome} fill={cores[x.tipo]}/>)}</Bar>
        </BarChart></ResponsiveContainer>
      </div></div>
      <p className="text-xs text-ncg-muted">Azul: ativos · Vermelho: passivos/falta · Dourado: reserva. NCG e total necessário são subtotais; caixa é apresentado separadamente. Sobra/(falta) = caixa − total necessário.</p>
    </SecaoNCG>
    <div className="grid min-w-0 gap-8 lg:grid-cols-2">
      <SecaoNCG titulo="Cobertura do caixa">
        <div className="relative mx-auto h-[230px] w-full max-w-[360px]" role="img" aria-label={`Cobertura do caixa ${percentualTexto(r.coberturaCaixa)}`}>
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={gauge} dataKey="valor" startAngle={180} endAngle={0} cx="50%" cy="74%" innerRadius={95} outerRadius={125} stroke="none" isAnimationActive={false}>{gauge.map(g => <Cell key={g.valor} fill={g.cor}/>)}</Pie></PieChart></ResponsiveContainer>
          <svg className="absolute inset-0 h-full w-full" viewBox="0 0 360 230" aria-hidden="true"><line x1="180" y1="170" x2={180 + 85 * Math.cos(angulo)} y2={170 - 85 * Math.sin(angulo)} stroke="var(--ncg-ink)" strokeWidth="4" strokeLinecap="round"/><circle cx="180" cy="170" r="7" fill="var(--ncg-ink)"/></svg>
          <p className={`absolute bottom-0 left-0 w-full text-center text-3xl font-semibold ${marcas[faixa]}`}>{percentualTexto(r.coberturaCaixa)}</p>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs"><span className="text-ncg-negative">&lt; 70% · Crítica</span><span className="text-ncg-gold">70–&lt;100% · Atenção</span><span className="text-ncg-success">≥ 100% · Coberta</span></div>
        <p className="mt-3 text-center text-xs text-ncg-muted">Escala visual: 0–150%; o percentual exibido não é limitado.</p>
      </SecaoNCG>
      <SecaoNCG titulo="Indicadores complementares">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <article className="rounded-lg border border-ncg-border bg-ncg-surface p-5"><h3 className="text-sm text-ncg-muted">NCG em dias de venda</h3><p className="mt-2 text-2xl font-semibold">{diasTexto(r.ncgDiasVenda)}</p></article>
          <article className="rounded-lg border border-ncg-border bg-ncg-surface p-5"><h3 className="text-sm text-ncg-muted">NCG sobre vendas anualizadas</h3><p className="mt-2 text-2xl font-semibold">{percentualTexto(r.ncgSobreVendasAnualizadas)}</p><p className="mt-2 text-xs text-ncg-muted">Base anualizada: vendas/dia × 360.</p></article>
        </div>
      </SecaoNCG>
    </div>
    <section className="border-l-4 border-ncg-gold bg-ncg-gold/10 p-5"><h2 className="mb-2 font-semibold">Diagnóstico para a empresa</h2><p className="text-base leading-relaxed">
      {diagnosticoNCG(r)}
    </p></section>
  </div>;
}