import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, Calculator, Copy, Database, FilePlus2, FileText, FolderOpen, LineChart, Save, Settings } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVolatilidade } from "@/lib/volatilidade/store";
import { calcularSeries, linhasFiltradas, mesTexto, moedaCompacta, ordenarLinhas, pct, serieValida } from "@/lib/volatilidade/dados";
import { diagnosticoAutomatico } from "@/lib/volatilidade/diagnostico";
import { DadosTab } from "@/components/volatilidade/DadosTab";
import { AnaliseTab } from "@/components/volatilidade/AnaliseTab";
import { CalculadoraTab } from "@/components/volatilidade/CalculadoraTab";
import { RelatorioTab } from "@/components/volatilidade/RelatorioTab";
import { ConfiguracoesTab } from "@/components/volatilidade/ConfiguracoesTab";
import { EstudosSalvos } from "@/components/volatilidade/EstudosSalvos";
import { Bolinha, classeDo } from "@/components/volatilidade/ui";

export const Route = createFileRoute("/volatilidade")({
  head: () => ({
    meta: [
      { title: "Estudo de Volatilidade Financeira | SAGA" },
      { name: "description", content: "Análise estatística da variabilidade mensal de faturamento, recebimento e outras séries, com faixas de probabilidade e relatório para o cliente." },
      { property: "og:title", content: "Estudo de Volatilidade Financeira | SAGA" },
      { property: "og:description", content: "Média, desvio padrão, coeficiente de variação, curvas normais e diagnóstico automático para PMEs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VolatilidadePage,
});

type Aba = "dados" | "analise" | "calculadora" | "relatorio" | "config";
const ABAS: { id: Aba; rotulo: string; icone: typeof Database }[] = [
  { id: "dados", rotulo: "Dados", icone: Database },
  { id: "analise", rotulo: "Análise", icone: LineChart },
  { id: "calculadora", rotulo: "Calculadora", icone: Calculator },
  { id: "relatorio", rotulo: "Relatório", icone: FileText },
  { id: "config", rotulo: "Configurações", icone: Settings },
];
const TODOS = "__todos";
const corClasse = { baixa: "text-vol-good", moderada: "text-vol-warn", alta: "text-vol-bad" } as const;

function VolatilidadePage() {
  const [aba, setAba] = useState<Aba>("dados");
  const [listaAberta, setListaAberta] = useState(false);
  const st = useVolatilidade();
  const { estudo, config } = st;

  useEffect(() => {
    void Promise.resolve(useVolatilidade.persist.rehydrate()).then(() => {
      const e = useVolatilidade.getState().estudo;
      if (!e.dataAnalise) useVolatilidade.getState().atualizar(x => ({ ...x, dataAnalise: new Date().toISOString().slice(0, 10) }));
    });
  }, []);

  const todas = useMemo(() => calcularSeries(estudo), [estudo]);
  const validas = useMemo(() => todas.filter(serieValida), [todas]);
  const diagnostico = useMemo(() => diagnosticoAutomatico(todas, { baixo: config.cvBaixo, moderado: config.cvModerado }), [todas, config.cvBaixo, config.cvModerado]);
  const meses = ordenarLinhas(estudo.linhas).map(l => l.mes);
  const filtradas = linhasFiltradas(estudo);
  const periodo = filtradas.length ? `${mesTexto(filtradas[0].mes)} a ${mesTexto(filtradas[filtradas.length - 1].mes)}` : "Sem dados";
  const mudarFiltro = (campo: "inicio" | "fim", v: string) => st.atualizar(e => {
    const f = { ...e.filtro, [campo]: v === TODOS ? null : v };
    if (f.inicio && f.fim && f.inicio > f.fim) { if (campo === "inicio") f.fim = f.inicio; else f.inicio = f.fim; }
    return { ...e, filtro: f };
  });

  return (
    <div className={`vol-tool min-h-full min-w-0 bg-vol-paper font-[Inter,system-ui,sans-serif] text-vol-text ${config.escuro ? "vol-dark" : ""}`}>
      <header className="sticky top-0 z-20 border-b border-vol-border bg-vol-ink/95 px-4 py-3 text-vol-on-ink shadow-[var(--vol-shadow)] backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-vol-gold"><Activity className="h-5 w-5 text-vol-ink" /></div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold md:text-lg">Estudo de Volatilidade <span className="text-vol-gold">Financeira</span></h1>
              <p className="truncate text-xs text-vol-on-ink/70">{estudo.cliente || "Cliente não informado"}{estudo.cnpj ? ` · ${estudo.cnpj}` : ""} · {periodo}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {validas.map(s => {
              const c = classeDo(s.stats.cv, config);
              return (
                <div key={s.serie.id} className="text-xs leading-tight">
                  <p className="flex items-center gap-1.5 font-semibold"><Bolinha cor={s.serie.cor} />{s.serie.nome}</p>
                  <p className="tabular-nums text-vol-on-ink/80">μ {moedaCompacta(s.stats.media)} · DP {moedaCompacta(s.stats.desvio)} · <span className={`font-semibold ${corClasse[c]}`} style={{ filter: "brightness(1.35)" }}>CV {pct(s.stats.cv)}</span></p>
                </div>
              );
            })}
            {meses.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-vol-on-ink/70">Período</span>
                {(["inicio", "fim"] as const).map(campo => (
                  <Select key={campo} value={estudo.filtro[campo] ?? TODOS} onValueChange={v => mudarFiltro(campo, v)}>
                    <SelectTrigger aria-label={campo === "inicio" ? "Mês inicial" : "Mês final"} className="h-8 w-[104px] border-vol-on-ink/20 bg-vol-on-ink/10 text-xs text-vol-on-ink"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={TODOS}>{campo === "inicio" ? "Início" : "Fim"}</SelectItem>
                      {meses.map(m => <SelectItem key={m} value={m}>{mesTexto(m)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => { st.salvar(); toast.success("Estudo salvo neste projeto."); }}><Save />Salvar estudo</Button>
          <Button variant="outline" onClick={() => setListaAberta(true)}><FolderOpen />Estudos salvos ({st.salvos.length})</Button>
          <Button variant="outline" onClick={() => { st.duplicar(); setAba("dados"); toast.success("Estudo duplicado: informe o novo cliente e salve."); }}><Copy />Duplicar estudo</Button>
          <Button variant="ghost" onClick={() => { st.novoEstudo(); setAba("dados"); toast.success("Novo estudo em branco."); }}><FilePlus2 />Novo estudo</Button>
        </div>

        <nav role="tablist" aria-label="Etapas do estudo" className="flex gap-2 overflow-x-auto rounded-2xl border border-vol-border bg-vol-surface p-2 shadow-[var(--vol-shadow)]">
          {ABAS.map(({ id, rotulo, icone: Icone }) => {
            const ativa = aba === id;
            return (
              <Button key={id} variant="ghost" role="tab" aria-selected={ativa} onClick={() => setAba(id)}
                className={`h-auto min-w-fit flex-1 gap-2 rounded-lg px-3 py-2.5 text-sm font-medium ${ativa ? "bg-vol-ink text-vol-on-ink hover:bg-vol-ink hover:text-vol-on-ink" : "text-vol-muted hover:bg-vol-ink/5 hover:text-vol-text"}`}>
                <Icone className={`h-4 w-4 ${ativa ? "text-vol-gold" : ""}`} />{rotulo}
              </Button>
            );
          })}
        </nav>

        {aba === "dados" && <DadosTab />}
        {aba === "analise" && <AnaliseTab series={validas} config={config} />}
        {aba === "calculadora" && <CalculadoraTab key={validas.map(s => s.serie.id).join()} series={validas} config={config} />}
        {aba === "relatorio" && <RelatorioTab estudo={estudo} series={validas} config={config} periodo={periodo} diagnosticoAuto={diagnostico} onDiagnostico={t => st.atualizar(e => ({ ...e, diagnostico: t }))} />}
        {aba === "config" && <ConfiguracoesTab config={config} onChange={st.definirConfig} />}
      </div>

      <EstudosSalvos aberto={listaAberta} onFechar={() => setListaAberta(false)} estudos={st.salvos} ativoId={estudo.id}
        onAbrir={id => { st.abrir(id); setListaAberta(false); setAba("analise"); toast.success("Estudo aberto."); }}
        onDuplicar={id => { st.duplicar(id); setListaAberta(false); setAba("dados"); toast.success("Estudo duplicado: informe o novo cliente e salve."); }}
        onExcluir={id => { st.excluir(id); toast.success("Estudo excluído."); }} />
    </div>
  );
}
