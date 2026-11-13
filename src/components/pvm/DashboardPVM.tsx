import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FileText, Info, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { VolCard } from "@/components/volatilidade/ui";
import { aplicarFiltros, intervalo, mesesDisponiveis, pvmMesAMes, SEM_FILTROS, tentarPVM, type NivelPVM, type RegistroPVM, type ResultadoPVM } from "@/lib/pvm";
import { brl, mesNome, pct2, pctSinal, periodoNome, qtd } from "@/lib/analise-pvm/importacao";
import { GLOSSARIO, leituraPVM } from "@/lib/analise-pvm/insights";
import { usePVM, type ControlesPVM, type ModoPVM } from "@/lib/analise-pvm/store";
import { FiltroMulti } from "./FiltroMulti";
import { Cascata, ComparativoNiveis, EvolucaoMensal, Ranking } from "./GraficosPVM";
import { TabelaPVM } from "./TabelaPVM";

const NIVEIS: Array<[NivelPVM, string]> = [["unidade", "Unidade"], ["categoria", "Categoria"], ["produto", "Produto"]];
const MODOS: Array<[ModoPVM, string]> = [["dois", "Dois meses"], ["acumulado", "Acumulado"], ["mensal", "Mês a mês"]];
const CAMPO_FILTRO = { unidade: "unidades", categoria: "categorias", produto: "produtos" } as const;
const campoSel = "h-9 w-[150px] border-vol-border bg-vol-surface text-sm text-vol-text";

function Glossario({ k }: { k: keyof typeof GLOSSARIO }) {
  const g = GLOSSARIO[k];
  return (
    <Popover>
      <PopoverTrigger asChild><button type="button" aria-label={`O que é ${g.titulo}`} className="inline-flex text-vol-muted hover:text-vol-gold"><Info className="h-3.5 w-3.5" /></button></PopoverTrigger>
      <PopoverContent className="w-80 text-sm"><p className="font-semibold">{g.titulo}</p><p className="mt-1 text-muted-foreground">{g.texto}</p><p className="mt-2 rounded bg-muted p-2 font-mono text-xs">{g.formula}</p></PopoverContent>
    </Popover>
  );
}

function SelMes({ valor, meses, onChange, rotulo }: { valor: string | null; meses: string[]; onChange: (m: string) => void; rotulo: string }) {
  return (
    <Select value={valor ?? undefined} onValueChange={onChange}>
      <SelectTrigger aria-label={rotulo} className={campoSel}><SelectValue placeholder="Mês" /></SelectTrigger>
      <SelectContent>{meses.map(m => <SelectItem key={m} value={m}>{mesNome(m)}</SelectItem>)}</SelectContent>
    </Select>
  );
}

function Kpi({ titulo, valor, detalhe, tom }: { titulo: string; valor: string; detalhe?: string; tom?: "bom" | "ruim" }) {
  return (
    <article className="min-w-0 rounded-2xl border border-vol-border bg-vol-surface p-4 shadow-[var(--vol-shadow)]">
      <p className="text-xs text-vol-muted">{titulo}</p>
      <p className="mt-1 break-words text-base font-semibold tabular-nums text-vol-text md:text-lg">{valor}</p>
      {detalhe && <p className={`mt-1 text-xs font-medium tabular-nums ${tom === "bom" ? "text-vol-good" : tom === "ruim" ? "text-vol-bad" : "text-vol-muted"}`}>{detalhe}</p>}
    </article>
  );
}

const tom = (v: number) => (v > 0 ? "bom" : v < 0 ? "ruim" : undefined);

export function DashboardPVM({ registros }: { registros: RegistroPVM[] }) {
  const { controles: c, setControles, cliente } = usePVM();
  const set = (p: Partial<ControlesPVM>) => setControles(x => ({ ...x, ...p }));
  const meses = useMemo(() => mesesDisponiveis(registros), [registros]);
  const [pdf, setPdf] = useState<{ blob: Blob; url: string } | null>(null);
  const [gerando, setGerando] = useState(false);
  const area = useRef<HTMLDivElement>(null);

  // Opções em cascata
  const opcoes = useMemo(() => {
    const porUnidade = aplicarFiltros(registros, { ...SEM_FILTROS, unidades: c.filtros.unidades });
    const porCategoria = aplicarFiltros(porUnidade, { ...SEM_FILTROS, categorias: c.filtros.categorias });
    const u = (rs: RegistroPVM[], k: "unidade" | "categoria" | "produto") => [...new Set(rs.map(r => r[k]))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    return { unidades: u(registros, "unidade"), categorias: u(porUnidade, "categoria"), produtos: u(porCategoria, "produto") };
  }, [registros, c.filtros.unidades, c.filtros.categorias]);

  const base = c.modo === "acumulado" && c.base && c.baseFim ? intervalo(meses, c.base, c.baseFim) : c.base ? [c.base] : [];
  const atual = c.modo === "acumulado" && c.atual && c.atualFim ? intervalo(meses, c.atual, c.atualFim) : c.atual ? [c.atual] : [];
  const sobreposto = c.modo === "acumulado" && base.some(m => atual.includes(m));

  const calc = useMemo(() => {
    const o = { base, atual, filtros: c.filtros };
    const niveis = Object.fromEntries(NIVEIS.map(([n]) => [n, tentarPVM(registros, { ...o, nivel: n })])) as Record<NivelPVM, ReturnType<typeof tentarPVM>>;
    return niveis;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registros, base.join(), atual.join(), c.filtros]);
  const atualCalc = calc[c.nivel];
  const transicoes = useMemo(() => (c.modo === "mensal" ? pvmMesAMes(registros, meses, c.nivel, c.filtros) : []), [c.modo, registros, meses, c.nivel, c.filtros]);

  const filtrarPorItem = (item: string) => {
    const k = CAMPO_FILTRO[c.nivel];
    set({ filtros: { ...c.filtros, [k]: [item] } });
    toast.success(`Dashboard filtrado por ${item}. Troque o nível para detalhar.`);
  };
  const filtrosAtivos = c.filtros.unidades.length + c.filtros.categorias.length + c.filtros.produtos.length > 0;

  const exportarExcel = async (r: ResultadoPVM) => {
    try {
      const { exportarExcelPVM } = await import("@/lib/analise-pvm/export-excel");
      const niveis = Object.fromEntries(NIVEIS.flatMap(([n]) => { const x = calc[n]; return x.ok ? [[n, x.r]] : []; }));
      await exportarExcelPVM(cliente, aplicarFiltros(registros, c.filtros), niveis, r);
    } catch { toast.error("Não foi possível exportar o Excel."); }
  };
  const gerarPdf = async (r: ResultadoPVM) => {
    setGerando(true);
    try {
      const { gerarPdfPVM } = await import("@/lib/analise-pvm/export-pdf");
      const blob = await gerarPdfPVM(cliente, r, leituraPVM(r), area.current?.querySelector<HTMLElement>('[data-pvm-chart="cascata"]') ?? null);
      setPdf({ blob, url: URL.createObjectURL(blob) });
    } catch { toast.error("Não foi possível gerar o PDF."); }
    finally { setGerando(false); }
  };

  return (
    <div className="space-y-6" ref={area}>
      {/* Barra de controles */}
      <div className="sticky top-[76px] z-10 rounded-2xl border border-vol-border bg-vol-surface/95 p-3 shadow-[var(--vol-shadow)] backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-vol-border p-0.5" role="radiogroup" aria-label="Modo">
            {MODOS.map(([m, n]) => <button key={m} type="button" role="radio" aria-checked={c.modo === m} onClick={() => set({ modo: m })} className={`rounded-md px-3 py-1.5 text-xs font-medium ${c.modo === m ? "bg-vol-ink text-vol-on-ink" : "text-vol-muted hover:text-vol-text"}`}>{n}</button>)}
          </div>
          {c.modo !== "mensal" && (
            <>
              <span className="text-xs text-vol-muted">Base</span>
              <SelMes rotulo="Período base" valor={c.base} meses={meses} onChange={m => set({ base: m, baseFim: c.baseFim && c.baseFim < m ? m : c.baseFim ?? m })} />
              {c.modo === "acumulado" && <><span className="text-xs text-vol-muted">até</span><SelMes rotulo="Fim do período base" valor={c.baseFim} meses={meses.filter(m => !c.base || m >= c.base)} onChange={m => set({ baseFim: m })} /></>}
              <span className="text-xs text-vol-muted">Atual</span>
              <SelMes rotulo="Período atual" valor={c.atual} meses={meses} onChange={m => set({ atual: m, atualFim: c.atualFim && c.atualFim < m ? m : c.atualFim ?? m })} />
              {c.modo === "acumulado" && <><span className="text-xs text-vol-muted">até</span><SelMes rotulo="Fim do período atual" valor={c.atualFim} meses={meses.filter(m => !c.atual || m >= c.atual)} onChange={m => set({ atualFim: m })} /></>}
            </>
          )}
          <div className="flex rounded-lg border border-vol-border p-0.5" role="radiogroup" aria-label="Nível de análise">
            {NIVEIS.map(([n, rot]) => <button key={n} type="button" role="radio" aria-checked={c.nivel === n} onClick={() => set({ nivel: n })} className={`rounded-md px-3 py-1.5 text-xs font-medium ${c.nivel === n ? "bg-vol-gold text-vol-ink" : "text-vol-muted hover:text-vol-text"}`}>{rot}</button>)}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <FiltroMulti rotulo="Unidade" opcoes={opcoes.unidades} selecionados={c.filtros.unidades} onChange={v => set({ filtros: { ...c.filtros, unidades: v } })} />
          <FiltroMulti rotulo="Categoria" opcoes={opcoes.categorias} selecionados={c.filtros.categorias} onChange={v => set({ filtros: { ...c.filtros, categorias: v } })} />
          <FiltroMulti rotulo="Produto" opcoes={opcoes.produtos} selecionados={c.filtros.produtos} onChange={v => set({ filtros: { ...c.filtros, produtos: v } })} />
          <Button variant="ghost" size="sm" disabled={!filtrosAtivos} onClick={() => set({ filtros: SEM_FILTROS })}><X />Limpar filtros</Button>
          {c.modo !== "mensal" && atualCalc.ok && (
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={() => void exportarExcel(atualCalc.r)}><FileSpreadsheet />Exportar Excel</Button>
              <Button size="sm" onClick={() => void gerarPdf(atualCalc.r)} disabled={gerando}>{gerando ? <Loader2 className="animate-spin" /> : <FileText />}Exportar PDF</Button>
            </div>
          )}
        </div>
      </div>

      {c.modo === "mensal" ? <MesAMes transicoes={transicoes} onDetalhar={(b, a) => set({ modo: "dois", base: b, atual: a })} /> : sobreposto ? (
        <VolCard><p className="flex items-center gap-2 text-sm text-vol-bad"><AlertTriangle className="h-4 w-4" />Os intervalos base e atual se sobrepõem. Escolha períodos distintos.</p></VolCard>
      ) : !atualCalc.ok ? (
        <VolCard><p className="flex items-center gap-2 text-sm text-vol-bad"><AlertTriangle className="h-4 w-4" />{atualCalc.erro}</p></VolCard>
      ) : (
        <Painel r={atualCalc.r} comparativo={NIVEIS.flatMap(([n, rot]) => { const x = calc[n]; return x.ok ? [{ nivel: rot, volume: x.r.total.volume, preco: x.r.total.preco, mix: x.r.total.mix }] : []; })}
          rotuloNivel={NIVEIS.find(n => n[0] === c.nivel)![1]} onItem={filtrarPorItem} />
      )}

      <Dialog open={!!pdf} onOpenChange={o => { if (!o) { if (pdf) URL.revokeObjectURL(pdf.url); setPdf(null); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader><DialogTitle>Pré-visualização do PDF</DialogTitle></DialogHeader>
          {pdf && <iframe title="Pré-visualização do PDF" src={pdf.url} className="h-[70vh] w-full rounded-md border" />}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPdf(null)}>Fechar</Button>
            <Button onClick={async () => { if (!pdf) return; const { baixarArquivo } = await import("@/lib/ncg/download"); const { nomeArquivoPVM } = await import("@/lib/analise-pvm/export-excel"); baixarArquivo(pdf.blob, nomeArquivoPVM(cliente, "pdf")); }}><FileText />Baixar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Painel({ r, comparativo, rotuloNivel, onItem }: { r: ResultadoPVM; comparativo: Array<{ nivel: string; volume: number; preco: number; mix: number }>; rotuloNivel: string; onItem: (i: string) => void }) {
  const t = r.total;
  const leitura = leituraPVM(r);
  const varPreco = t.p0 ? (t.p1 - t.p0) / t.p0 : 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Kpi titulo={`Receita base (${periodoNome(r.base)})`} valor={brl(t.r0)} />
        <Kpi titulo={`Receita atual (${periodoNome(r.atual)})`} valor={brl(t.r1)} />
        <Kpi titulo="Variação da receita" valor={brl(t.dR)} detalhe={pctSinal(t.r0 ? t.dR / t.r0 : 0)} tom={tom(t.dR)} />
        <Kpi titulo="Volume base × atual" valor={`${qtd(t.q0)} → ${qtd(t.q1)}`} detalhe={pctSinal(t.q0 ? t.dQ / t.q0 : 0)} tom={tom(t.dQ)} />
        <Kpi titulo="Preço médio base × atual" valor={`${brl(t.p0)} → ${brl(t.p1)}`} detalhe={pctSinal(varPreco)} tom={tom(varPreco)} />
        <article className={`flex min-w-0 flex-col justify-center rounded-2xl border p-4 shadow-[var(--vol-shadow)] ${r.conciliado ? "border-vol-good/40 bg-vol-good/10" : "border-vol-bad/40 bg-vol-bad/10"}`}>
          <p className="text-xs text-vol-muted">Conciliação</p>
          <p className={`mt-1 flex items-center gap-1.5 font-semibold ${r.conciliado ? "text-vol-good" : "text-vol-bad"}`}>
            {r.conciliado ? <><CheckCircle2 className="h-4 w-4" />✔ Conciliado</> : <><AlertTriangle className="h-4 w-4" />⚠ Diferença de {brl(r.diferenca)}</>}
          </p>
          <p className="mt-1 text-[11px] text-vol-muted">Volume + Preço + Mix = Receita atual − base</p>
        </article>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <VolCard titulo="Cascata da receita">
          <Cascata r={r} />
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-vol-muted">
            {(["volume", "preco", "mix"] as const).map(k => <span key={k} className="inline-flex items-center gap-1">{GLOSSARIO[k].titulo}: <strong className={t[k] >= 0 ? "text-vol-good" : "text-vol-bad"}>{brl(t[k])}</strong> <Glossario k={k} /></span>)}
            <span>Eixo vertical não começa em zero, para destacar os efeitos.</span>
          </div>
        </VolCard>
        <VolCard titulo="Leitura da variação">
          <ul className="space-y-2 text-sm leading-relaxed text-vol-text">{leitura.frases.map((f, i) => <li key={i} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-vol-gold" />{f}</li>)}</ul>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
            <ListaPreco titulo="Maiores quedas de preço médio" itens={leitura.quedasPreco} />
            <ListaPreco titulo="Maiores altas de preço médio" itens={leitura.altasPreco} />
          </div>
        </VolCard>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <VolCard titulo={<span className="flex items-center gap-2">Efeitos nos 3 níveis <Glossario k="mix" /></span>}>
          <ComparativoNiveis dados={comparativo} />
          <p className="mt-2 text-xs text-vol-muted">O Volume é igual nos três níveis; o Mix aparece mais quando a análise desce de nível.</p>
        </VolCard>
        <VolCard titulo="Quem explica a variação"><Ranking r={r} /></VolCard>
      </div>

      <VolCard titulo={<span className="flex items-center gap-2">Tabela detalhada por {rotuloNivel.toLowerCase()} <Search className="h-4 w-4 text-vol-muted" /></span>}>
        <TabelaPVM r={r} rotulo={rotuloNivel} onItem={onItem} />
        <p className="mt-2 text-xs text-vol-muted">Clique no título de uma coluna para ordenar e numa linha para filtrar o dashboard por aquele item. Itens novos usam o preço médio total base; descontinuados, o preço médio total atual.</p>
      </VolCard>
    </>
  );
}

function ListaPreco({ titulo, itens }: { titulo: string; itens: ReturnType<typeof leituraPVM>["quedasPreco"] }) {
  return (
    <div className="rounded-xl border border-vol-border bg-vol-paper p-3">
      <p className="mb-1 text-xs font-semibold text-vol-muted">{titulo}</p>
      {itens.length ? <ol className="space-y-1 text-sm">{itens.map(i => <li key={i.item} className="flex justify-between gap-2"><span className="truncate">{i.item}</span><span className={`tabular-nums ${i.dP < 0 ? "text-vol-bad" : "text-vol-good"}`}>{pctSinal(i.dP / i.p0)}</span></li>)}</ol> : <p className="text-xs text-vol-muted">Nenhum item.</p>}
    </div>
  );
}

function MesAMes({ transicoes, onDetalhar }: { transicoes: ReturnType<typeof pvmMesAMes>; onDetalhar: (b: string, a: string) => void }) {
  if (!transicoes.length) return <VolCard><p className="text-sm text-vol-muted">São necessários pelo menos 2 meses.</p></VolCard>;
  return (
    <>
      <VolCard titulo="Evolução mês a mês"><EvolucaoMensal transicoes={transicoes} /></VolCard>
      <VolCard titulo="Transições">
        <div className="overflow-x-auto">
          <table className="vol-table min-w-[860px]">
            <thead><tr><th>Período</th><th className="num">Receita base</th><th className="num">Receita atual</th><th className="num">Variação</th><th className="num">Ef. Volume</th><th className="num">Ef. Preço</th><th className="num">Ef. Mix</th><th>Conciliação</th><th /></tr></thead>
            <tbody className="text-vol-text">
              {transicoes.map(t => (
                <tr key={t.atual}>
                  <td>{mesNome(t.base)} → {mesNome(t.atual)}</td>
                  {t.resultado ? (
                    <>
                      <td className="num">{brl(t.resultado.total.r0)}</td><td className="num">{brl(t.resultado.total.r1)}</td>
                      <td className={`num ${t.resultado.total.dR < 0 ? "text-vol-bad" : "text-vol-good"}`}>{brl(t.resultado.total.dR)} ({pct2(t.resultado.total.r0 ? t.resultado.total.dR / t.resultado.total.r0 : 0)})</td>
                      {(["volume", "preco", "mix"] as const).map(k => <td key={k} className={`num ${t.resultado!.total[k] < 0 ? "text-vol-bad" : "text-vol-good"}`}>{brl(t.resultado!.total[k])}</td>)}
                      <td className={t.resultado.conciliado ? "text-vol-good" : "text-vol-bad"}>{t.resultado.conciliado ? "✔ Conciliado" : `⚠ ${brl(t.resultado.diferenca)}`}</td>
                      <td><Button size="sm" variant="ghost" onClick={() => onDetalhar(t.base, t.atual)}>Detalhar</Button></td>
                    </>
                  ) : <td colSpan={8} className="text-vol-bad">{t.erro}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </VolCard>
    </>
  );
}
