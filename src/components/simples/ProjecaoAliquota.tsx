import { useMemo, type ReactNode } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CalendarClock, Minus } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bloco } from "@/components/viabilidade/ui";
import { Button } from "@/components/ui/button";
import { CaixaAlerta, CampoMoeda, FaixaBadge } from "./ui";
import { receitaAnexoMes, type ResultadoMes } from "@/lib/simples/calculo";
import { diasNoMes, extrapolarMes, mesCorrentePadrao, projetarAliquota, rotuloMes } from "@/lib/simples/projecao";
import { COR_ANEXO } from "@/lib/simples/cores";
import { brl, pct4 } from "@/lib/simples/formato";
import { tabelaParaAno, type AnexoId, type TabelasSimples } from "@/lib/simples/tabelas";
import type { EmpresaSimples, PreviaProjecao } from "@/lib/simples/store";

const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--via-border)", fontSize: 12 }, labelStyle: { color: "var(--via-ink)", fontWeight: 600 } };

/** Diferença de alíquota em pontos percentuais; subir é ruim (vermelho), cair é bom (verde). */
function Delta({ de, para, rotulo }: { de: number | null | undefined; para: number; rotulo: string }) {
  if (de === null || de === undefined) return null;
  const dif = (para - de) * 100;
  const igual = Math.abs(dif) < 0.00005;
  const I = igual ? Minus : dif > 0 ? ArrowUpRight : ArrowDownRight;
  const cor = igual ? "text-via-muted bg-via-sub" : dif > 0 ? "text-[var(--sn-vermelho)] bg-[var(--sn-vermelho-bg)]" : "text-[var(--sn-verde)] bg-[var(--sn-verde-bg)]";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${cor}`}>
      <I className="h-3 w-3" />
      {igual ? "sem variação" : `${dif > 0 ? "+" : "−"}${Math.abs(dif).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })} p.p.`} {rotulo}
    </span>
  );
}

function CartaoMes({ etiqueta, mes, r, destaque, linhas, rodape }: {
  etiqueta: string; mes: string; r: ResultadoMes | null; destaque?: boolean; linhas: Array<[string, string]>; rodape?: ReactNode;
}) {
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-xl border p-4 shadow-[var(--via-shadow)] ${destaque ? "border-via-gold bg-via-ink text-via-on-ink" : "border-via-border bg-via-surface"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${destaque ? "text-via-gold" : "text-via-muted"}`}>{etiqueta}</p>
          <p className={`text-sm font-medium ${destaque ? "text-via-on-ink" : "text-via-ink"}`}>{mes}</p>
        </div>
        {r && <FaixaBadge faixa={r.faixa} />}
      </div>
      <p className={`mt-3 text-[11px] ${destaque ? "text-via-on-ink/70" : "text-via-muted"}`}>Alíquota efetiva</p>
      <p className={`text-2xl font-bold tabular-nums md:text-3xl ${destaque ? "text-via-on-ink" : "text-via-ink"}`}>{r?.calculado ? pct4(r.ae) : "—"}</p>
      <dl className="mt-3 space-y-1 text-xs">
        {linhas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <dt className={destaque ? "text-via-on-ink/70" : "text-via-muted"}>{k}</dt>
            <dd className="tabular-nums font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {rodape && <div className="mt-3 flex flex-wrap gap-1.5">{rodape}</div>}
    </div>
  );
}

export function ProjecaoAliquota({ empresa, tabelasPorAno, atualizar }: {
  empresa: EmpresaSimples;
  tabelasPorAno: Record<string, TabelasSimples>;
  atualizar: (f: (e: EmpresaSimples) => EmpresaSimples) => void;
}) {
  const padrao = mesCorrentePadrao(empresa);
  const previa: PreviaProjecao = empresa.projecao ?? { mesCorrente: padrao, valores: {}, parcial: false, dia: diasNoMes(padrao) };
  const minimo = empresa.ano * 12;
  const mesCorrente = Math.min(Math.max(previa.mesCorrente, minimo), minimo + 12);
  const dias = diasNoMes(mesCorrente);
  const dia = Math.min(Math.max(1, previa.dia || dias), dias);
  const salvar = (p: Partial<PreviaProjecao>) => atualizar((e) => ({ ...e, projecao: { ...previa, mesCorrente, ...p } }));

  const faturamento = useMemo(() => {
    const f: Partial<Record<AnexoId, number>> = {};
    for (const a of empresa.anexos) {
      const v = Number(previa.valores[a]) || 0;
      f[a] = previa.parcial ? extrapolarMes(v, dia, dias) : v;
    }
    return f;
  }, [empresa.anexos, previa.valores, previa.parcial, dia, dias]);

  const p = useMemo(
    () => projetarAliquota(empresa, (ano) => tabelaParaAno(tabelasPorAno, ano).tabelas, { mesCorrente, faturamento }),
    [empresa, tabelasPorAno, mesCorrente, faturamento],
  );

  const nomeC = rotuloMes(p.mesCorrente);
  const nomeP = rotuloMes(p.mesProximo);
  const nomeU = p.mesUltimo !== null ? rotuloMes(p.mesUltimo) : null;
  const semHistorico = p.mesUltimo === null && empresa.anoAnterior.every((v) => !v);
  const idxC = p.mesCorrente - empresa.ano * 12;
  const lancado = idxC >= 0 && idxC < 12 ? empresa.anexos.map((a) => [a, receitaAnexoMes(empresa, a, idxC)] as const).filter(([, v]) => v > 0) : [];

  const opcoesMes = Array.from({ length: 13 }, (_, i) => minimo + i);
  const dadosGrafico = p.serie.map((s) => {
    const ponto: Record<string, string | number | null> = { nome: rotuloMes(s.abs) + (s.tipo === "projetado" ? " (proj.)" : s.tipo === "corrente" ? " (atual)" : "") };
    for (const a of empresa.anexos) {
      const v = s.ae[a];
      const pct = v === null || v === undefined ? null : v * 100;
      ponto[`r${a}`] = s.tipo === "projetado" ? null : pct;
      ponto[`p${a}`] = s.tipo === "fechado" ? null : pct;
    }
    return ponto;
  });

  return (
    <div className="space-y-6">
      <Bloco numero={1} titulo="Prévia do faturamento do mês corrente">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
          <label className="block text-sm">
            <span className="mb-1 block text-xs font-medium text-via-muted">Mês corrente</span>
            <select
              value={mesCorrente}
              onChange={(e) => { const m = Number(e.target.value); salvar({ mesCorrente: m, dia: Math.min(dia, diasNoMes(m)) }); }}
              className="h-9 w-full rounded-md border border-via-border bg-via-input px-2 text-sm text-via-ink outline-none focus:border-via-gold focus:ring-2 focus:ring-via-gold/30"
            >
              {opcoesMes.map((m) => <option key={m} value={m}>{rotuloMes(m)}{m === padrao ? " · sugerido" : ""}</option>)}
            </select>
            <span className="mt-1 block text-[11px] text-via-muted">Sugerido: o mês seguinte ao último mês fechado{nomeU ? ` (${nomeU})` : ""}.</span>
          </label>
          <div className="space-y-3">
            <div className={`grid gap-3 ${empresa.anexos.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {empresa.anexos.map((a) => (
                <label key={a} className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-via-muted">
                    Faturamento de {nomeC}{empresa.anexos.length > 1 ? ` — Anexo ${a}` : ""}{previa.parcial ? ` (até o dia ${dia})` : ""}
                  </span>
                  <CampoMoeda compacto={false} rotulo={`Faturamento de ${nomeC} Anexo ${a}`} valor={Number(previa.valores[a]) || 0}
                    onChange={(v) => salvar({ valores: { ...previa.valores, [a]: Math.max(0, v) } })} />
                </label>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <label className="inline-flex items-center gap-2 text-via-ink">
                <input type="checkbox" checked={previa.parcial} className="h-4 w-4 accent-[var(--via-gold)]"
                  onChange={(e) => {
                    const hoje = new Date();
                    const diaHoje = hoje.getFullYear() * 12 + hoje.getMonth() === mesCorrente ? hoje.getDate() : dias;
                    salvar({ parcial: e.target.checked, dia: e.target.checked ? diaHoje : dia });
                  }} />
                É um valor parcial do mês
              </label>
              {previa.parcial && (
                <label className="inline-flex items-center gap-2 text-via-muted">
                  apurado até o dia
                  <input type="number" min={1} max={dias} value={dia} aria-label="Dia da apuração"
                    onChange={(e) => salvar({ dia: Math.min(Math.max(1, Number(e.target.value) || 1), dias) })}
                    className="h-8 w-16 rounded-md border border-via-border bg-via-input px-2 text-right text-sm tabular-nums text-via-ink outline-none focus:border-via-gold" />
                  de {dias}
                </label>
              )}
            </div>
            {previa.parcial && p.faturamentoCorrente > 0 && (
              <p className="text-xs text-via-muted">Estimativa para o mês inteiro pela média diária: <strong className="tabular-nums text-via-ink">{brl(p.faturamentoCorrente)}</strong></p>
            )}
            {lancado.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-via-muted">
                <span>Já existe faturamento lançado para {nomeC}: <strong className="tabular-nums text-via-ink">{brl(lancado.reduce((s, [, v]) => s + v, 0))}</strong>. A projeção usa a prévia digitada.</span>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => salvar({ parcial: false, valores: Object.fromEntries(lancado) })}>Usar valor lançado</Button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-4 flex items-start gap-2 rounded-lg bg-via-paper px-3 py-2 text-xs text-via-muted">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-via-gold" />
          <span>A alíquota de {nomeP} usa o faturamento dos 12 meses anteriores ({rotuloMes(p.mesProximo - 12)} a {nomeC}). Por isso a prévia de {nomeC} já permite projetar a alíquota de {nomeP}. A alíquota de {nomeC} já está definida pelos meses fechados.</span>
        </p>
      </Bloco>

      {semHistorico && <CaixaAlerta nivel="info">Lance ou importe os meses fechados (e o faturamento do ano anterior) para a projeção ficar correta.</CaixaAlerta>}
      {p.rbt12Proximo.origem === "manual" && <CaixaAlerta nivel="info">O RBT12 de {nomeP} foi digitado manualmente na grade de receitas; a prévia não altera essa projeção.</CaixaAlerta>}

      <Bloco numero={2} titulo="Evolução da alíquota">
        <div className="space-y-6">
          {p.anexos.map((x) => (
            <div key={x.anexo} className="space-y-2">
              {empresa.anexos.length > 1 && <p className="text-sm font-semibold text-via-ink">Anexo {x.anexo}</p>}
              <div className="grid items-stretch gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
                <CartaoMes etiqueta="Último mês calculado" mes={nomeU ?? "Nenhum mês fechado"} r={x.ultimo}
                  linhas={x.ultimo ? [["Faturamento", brl(x.ultimo.receitaTotal)], ["RBT12", brl(x.ultimo.rbt12)], ["DAS", brl(x.ultimo.totalDas)]] : [["", "Lance os meses fechados"]]} />
                <ArrowRight className="hidden h-5 w-5 self-center text-via-muted md:block" />
                <CartaoMes etiqueta="Mês corrente" mes={nomeC} r={x.corrente}
                  linhas={[["Prévia do faturamento", brl(x.corrente.receitaTotal)], ["RBT12", brl(x.corrente.rbt12)], ["DAS estimado", brl(x.corrente.totalDas)]]}
                  rodape={x.corrente.calculado && <Delta de={x.ultimo?.calculado ? x.ultimo.ae : null} para={x.corrente.ae} rotulo={nomeU ? `vs ${nomeU}` : ""} />} />
                <ArrowRight className="hidden h-5 w-5 self-center text-via-gold md:block" />
                <CartaoMes etiqueta="Próximo mês · projeção" mes={nomeP} r={x.proximo} destaque
                  linhas={[["RBT12 projetado", brl(x.proximo.rbt12)], ["Alíquota nominal", x.proximo.calculado ? pct4(x.proximo.aliqNominal) : "—"], ["Dedução da faixa", x.proximo.calculado ? brl(x.proximo.deducao) : "—"]]}
                  rodape={x.proximo.calculado && <>
                    <Delta de={x.corrente.calculado ? x.corrente.ae : null} para={x.proximo.ae} rotulo={`vs ${nomeC}`} />
                    <Delta de={x.ultimo?.calculado ? x.ultimo.ae : null} para={x.proximo.ae} rotulo={nomeU ? `vs ${nomeU}` : ""} />
                  </>} />
              </div>
              {[...x.corrente.alertas, ...x.proximo.alertas].filter((a, i, l) => l.findIndex((b) => b.texto === a.texto) === i).map((a) => <CaixaAlerta key={a.texto} nivel={a.nivel}>{a.texto}</CaixaAlerta>)}
            </div>
          ))}
        </div>
      </Bloco>

      <div className="grid gap-6 xl:grid-cols-2">
        <Bloco numero={3} titulo={`Como se chega ao RBT12 de ${nomeP}`}>
          {p.ponte ? (
            <table className="w-full text-sm">
              <tbody className="[&_td]:py-1.5">
                <tr><td className="text-via-muted">RBT12 de {nomeC}</td><td className="whitespace-nowrap pl-3 text-right tabular-nums text-via-ink">{brl(p.rbt12Corrente.valor)}</td></tr>
                <tr><td className="text-via-muted">+ Faturamento de {nomeC} (prévia)</td><td className="whitespace-nowrap pl-3 text-right tabular-nums text-via-ink">{brl(p.ponte.entra)}</td></tr>
                <tr><td className="text-via-muted">− Faturamento de {rotuloMes(p.ponte.mesSai)} (sai da conta)</td><td className="whitespace-nowrap pl-3 text-right tabular-nums text-via-ink">({brl(p.ponte.sai)})</td></tr>
                <tr className="border-t border-via-border font-semibold"><td className="pt-2 text-via-ink">= RBT12 de {nomeP}</td><td className="pt-2 whitespace-nowrap pl-3 text-right tabular-nums text-via-ink">{brl(p.rbt12Proximo.valor)}</td></tr>
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-via-muted">RBT12 de {nomeP}: <strong className="tabular-nums text-via-ink">{brl(p.rbt12Proximo.valor)}</strong> ({p.rbt12Proximo.origem === "manual" ? "valor digitado" : p.rbt12Proximo.origem === "proporcional" ? "proporcional ao início de atividade" : p.rbt12Proximo.origem === "primeiro-mes" ? "primeiro mês de atividade" : "sem atividade"}).</p>
          )}
          <div className="mt-4 space-y-2 text-xs text-via-muted">
            {p.folgaFaixa !== null && <p>Faltam <strong className="tabular-nums text-via-ink">{brl(p.folgaFaixa)}</strong> de RBT12 para {nomeP} passar para a faixa {p.faixaProximo + 1}.</p>}
            {p.limiteParaManterFaixa !== null && (
              <p>Para {nomeP} ficar na faixa {p.faixaCorrente} (a mesma de {nomeC}), o faturamento de {nomeC} pode ir até <strong className="tabular-nums text-via-ink">{brl(p.limiteParaManterFaixa)}</strong>.</p>
            )}
          </div>
        </Bloco>
        <Bloco numero={4} titulo="Alíquota efetiva mês a mês">
          <div className="sn-chart" data-sn-chart="Projeção da alíquota">
            <ResponsiveContainer>
              <LineChart data={dadosGrafico} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--via-border)" />
                <XAxis dataKey="nome" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis domain={["auto", "auto"]} tickFormatter={(v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={52} />
                <Tooltip {...tip} formatter={(v: number, n: string) => [`${v.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`, n]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {empresa.anexos.map((a) => <Line key={`r${a}`} type="monotone" dataKey={`r${a}`} name={`Anexo ${a}`} stroke={COR_ANEXO[a]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}
                {empresa.anexos.map((a) => <Line key={`p${a}`} type="monotone" dataKey={`p${a}`} name={`Anexo ${a} · projeção`} stroke={COR_ANEXO[a]} strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 4, fill: "var(--via-gold)", stroke: COR_ANEXO[a] }} connectNulls legendType="plainline" />)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Bloco>
      </div>
    </div>
  );
}
