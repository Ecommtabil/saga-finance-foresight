import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ClipboardPaste, Download, FileSpreadsheet, FileText, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  aplicarPrevia, consolidarPgdas, detectarCabecalho, interpretarPgdas, linhasDeColagem, linhasDePlanilha, montarPrevia, sugerirMapeamento, TODAS_COLUNAS,
  type ConsolidacaoPgdas, type DestinoTotais, type LinhaImport, type Mapeamento,
} from "@/lib/simples/importacao";
import { COLUNA_PRINCIPAL, NOME_COLUNA, type ColunaReceita } from "@/lib/simples/tabelas";
import { useSimples, type EmpresaSimples, type OrigemImportacao } from "@/lib/simples/store";
import { baixarModeloImportacao } from "@/lib/simples/export-excel";
import { num2, nomeMes } from "@/lib/simples/formato";
import { CaixaAlerta } from "./ui";

type Etapa = "origem" | "mapear" | "previa";
interface Planilha { nome: string; abas: Record<string, unknown[][]>; aba: string; cabecalho: number; mapa: Mapeamento }

const ORIGENS: Array<{ id: OrigemImportacao; titulo: string; texto: string; icone: typeof FileText }> = [
  { id: "pgdas", titulo: "Extrato do PGDAS-D (PDF)", texto: "Um ou mais PDFs. Lê receitas anteriores, RBT12 e a receita do PA por atividade.", icone: FileText },
  { id: "planilha", titulo: "Planilha Excel/CSV", texto: "O modelo do app ou qualquer planilha, com mapeamento das colunas.", icone: FileSpreadsheet },
  { id: "colar", titulo: "Colar do Excel", texto: "Duas colunas (mês e valor) para alimentar o histórico do RBT12.", icone: ClipboardPaste },
];
const STATUS = {
  novo: { texto: "novo", cls: "bg-[var(--sn-verde-bg)] text-[var(--sn-verde)]" },
  sobrescrever: { texto: "vai sobrescrever", cls: "bg-[var(--sn-amarelo-bg)] text-[var(--sn-amarelo)]" },
  igual: { texto: "sem alteração", cls: "bg-via-sub text-via-muted" },
  erro: { texto: "erro de leitura", cls: "bg-[var(--sn-vermelho-bg)] text-[var(--sn-vermelho)]" },
} as const;

export function ImportarReceitas({ empresa, aberto, onFechar }: { empresa: EmpresaSimples; aberto: boolean; onFechar: () => void }) {
  const registrarImportacao = useSimples((s) => s.registrarImportacao);
  const [etapa, setEtapa] = useState<Etapa>("origem");
  const [origem, setOrigem] = useState<OrigemImportacao>("pgdas");
  const [linhas, setLinhas] = useState<LinhaImport[]>([]);
  const [arquivo, setArquivo] = useState("");
  const [pgdas, setPgdas] = useState<ConsolidacaoPgdas | null>(null);
  const [planilha, setPlanilha] = useState<Planilha | null>(null);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [destino, setDestino] = useState<DestinoTotais>(empresa.anexos[0]);
  const [sobrescrever, setSobrescrever] = useState(true);
  const [selecao, setSelecao] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!aberto) return;
    setEtapa("origem"); setLinhas([]); setPgdas(null); setPlanilha(null); setTexto(""); setArquivo(""); setDestino(empresa.anexos[0]); setSobrescrever(true);
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const previa = useMemo(() => montarPrevia(empresa, linhas, destino), [empresa, linhas, destino]);
  useEffect(() => { setSelecao(new Set(previa.filter((p) => p.status !== "erro" && p.status !== "igual").map((p) => p.id))); }, [previa]);
  const precisaDestino = linhas.some((l) => (l.total || !l.anexo) && l.mes && Number(l.mes.slice(0, 4)) === empresa.ano);

  const lerPdfs = async (files: FileList | null) => {
    if (!files?.length) return;
    setCarregando(true);
    try {
      const { extrairTextoPdf } = await import("@/lib/simples/pdf-texto");
      const extratos = [];
      for (const f of Array.from(files)) extratos.push(interpretarPgdas(await extrairTextoPdf(f), f.name));
      const c = consolidarPgdas(extratos, empresa.ano, empresa.cnpj);
      if (!c.linhas.length) { toast.error("Não encontrei receitas nesses PDFs. Confira se é o extrato do PGDAS-D."); setPgdas(c); return; }
      setPgdas(c); setLinhas(c.linhas); setArquivo(Array.from(files).map((f) => f.name).join(", ")); setEtapa("previa");
    } catch (e) {
      toast.error(`Não foi possível ler o PDF: ${e instanceof Error ? e.message : "erro desconhecido"}`);
    } finally { setCarregando(false); }
  };

  const lerPlanilha = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setCarregando(true);
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: "array" });
      const abas: Record<string, unknown[][]> = {};
      for (const n of wb.SheetNames) abas[n] = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[n], { header: 1, raw: true, defval: "" });
      const aba = wb.SheetNames.find((n) => (abas[n]?.length ?? 0) > 1) ?? wb.SheetNames[0];
      const cab = detectarCabecalho(abas[aba] ?? []);
      setPlanilha({ nome: f.name, abas, aba, cabecalho: cab, mapa: sugerirMapeamento(abas[aba]?.[cab] ?? []) });
      setArquivo(f.name); setEtapa("mapear");
    } catch {
      toast.error("Não foi possível ler a planilha.");
    } finally { setCarregando(false); }
  };

  const confirmar = () => {
    const r = aplicarPrevia(empresa, previa, selecao, sobrescrever);
    const nova = { ...r.empresa };
    if (pgdas && origem === "pgdas") {
      nova.conferenciaRbt12 = { ...nova.conferenciaRbt12, ...pgdas.conferencias };
      nova.folha = { ...nova.folha, ...pgdas.folha };
    }
    registrarImportacao(empresa.id, nova, { usuario: "Este navegador", arquivo: arquivo || "Texto colado", origem, meses: r.importados, sobrescritos: r.sobrescritos, ignorados: r.ignorados });
    toast.success(`${r.importados} meses importados, ${r.sobrescritos} sobrescritos, ${r.ignorados} ignorados`);
    onFechar();
  };

  const cabecalho = planilha ? (planilha.abas[planilha.aba]?.[planilha.cabecalho] ?? []).map((c, i) => String(c || `Coluna ${i + 1}`)) : [];
  const SelCol = ({ valor, onChange, rotulo }: { valor: number; onChange: (v: number) => void; rotulo: string }) => (
    <label className="space-y-1">
      <span className="text-xs font-medium text-via-ink">{rotulo}</span>
      <Select value={String(valor)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-9" aria-label={rotulo}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="-1">— não usar —</SelectItem>
          {cabecalho.map((c, i) => <SelectItem key={i} value={String(i)}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </label>
  );

  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="via-tool max-h-[92vh] max-w-5xl overflow-y-auto font-[Inter,system-ui,sans-serif]">
        <DialogHeader>
          <DialogTitle className="text-via-ink">Importar receitas</DialogTitle>
          <DialogDescription>
            Meses de {empresa.ano - 1} vão para o bloco do ano anterior; meses de {empresa.ano} vão para a grade do anexo. Nada é gravado antes da confirmação.
          </DialogDescription>
        </DialogHeader>

        {etapa === "origem" && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3" role="radiogroup" aria-label="Origem">
              {ORIGENS.map((o) => (
                <button key={o.id} type="button" role="radio" aria-checked={origem === o.id} onClick={() => setOrigem(o.id)}
                  className={`rounded-xl border p-4 text-left transition-colors ${origem === o.id ? "border-via-ink bg-via-input" : "border-via-border bg-via-surface hover:border-via-ink/40"}`}>
                  <o.icone className="h-5 w-5 text-via-gold" />
                  <p className="mt-2 text-sm font-semibold text-via-ink">{o.titulo}</p>
                  <p className="mt-1 text-xs text-via-muted">{o.texto}</p>
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-dashed border-via-border bg-via-paper p-5">
              {origem === "pgdas" && (
                <div className="space-y-3">
                  <p className="text-sm text-via-muted">Selecione um ou mais PDFs do extrato/declaração do PGDAS-D. Se o mesmo mês aparecer em mais de um, vale o PDF do período mais recente. A leitura é feita aqui no navegador.</p>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-via-ink px-4 py-2 text-sm font-medium text-via-on-ink hover:bg-via-ink/90">
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-via-gold" />}Escolher PDFs
                    <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" disabled={carregando} onChange={(e) => { void lerPdfs(e.target.files); e.target.value = ""; }} />
                  </label>
                  {pgdas && !pgdas.linhas.length && pgdas.avisos.map((a) => <CaixaAlerta key={a} nivel="aviso">{a}</CaixaAlerta>)}
                </div>
              )}
              {origem === "planilha" && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-via-ink px-4 py-2 text-sm font-medium text-via-on-ink hover:bg-via-ink/90">
                    {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4 text-via-gold" />}Escolher planilha
                    <input type="file" accept=".xlsx,.xls,.csv" className="sr-only" disabled={carregando} onChange={(e) => { void lerPlanilha(e.target.files); e.target.value = ""; }} />
                  </label>
                  <Button variant="outline" onClick={() => void baixarModeloImportacao(empresa.ano)}><Download className="h-4 w-4" />Baixar modelo</Button>
                  <p className="w-full text-xs text-via-muted">Aceita meses como 01/2025, jan/25, janeiro 2025 ou data do Excel, e valores em formato BR (1.234,56) ou US.</p>
                </div>
              )}
              {origem === "colar" && (
                <div className="space-y-3">
                  <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder={"01/2024\t35.000,00\n02/2024\t38.200,50\n…"} aria-label="Texto colado com mês e valor" className="font-mono text-xs" />
                  <Button disabled={!texto.trim()} onClick={() => { setLinhas(linhasDeColagem(texto)); setArquivo("Texto colado"); setEtapa("previa"); }} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90">Ver prévia</Button>
                </div>
              )}
            </div>
          </div>
        )}

        {etapa === "mapear" && planilha && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              {Object.keys(planilha.abas).length > 1 && (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-via-ink">Aba</span>
                  <Select value={planilha.aba} onValueChange={(aba) => { const cab = detectarCabecalho(planilha.abas[aba] ?? []); setPlanilha({ ...planilha, aba, cabecalho: cab, mapa: sugerirMapeamento(planilha.abas[aba]?.[cab] ?? []) }); }}>
                    <SelectTrigger className="h-9 w-48" aria-label="Aba"><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(planilha.abas).map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                </label>
              )}
              <p className="text-sm text-via-muted">Cabeçalho na linha {planilha.cabecalho + 1} de <strong className="text-via-ink">{planilha.nome}</strong>. Confira qual coluna é cada informação (sugestão automática pelo nome).</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SelCol rotulo="Mês" valor={planilha.mapa.mes} onChange={(v) => setPlanilha({ ...planilha, mapa: { ...planilha.mapa, mes: v } })} />
              <SelCol rotulo="Anexo (opcional)" valor={planilha.mapa.anexo} onChange={(v) => setPlanilha({ ...planilha, mapa: { ...planilha.mapa, anexo: v } })} />
              <SelCol rotulo="Total do mês (sem segregação)" valor={planilha.mapa.total} onChange={(v) => setPlanilha({ ...planilha, mapa: { ...planilha.mapa, total: v } })} />
              {TODAS_COLUNAS.map((c: ColunaReceita) => (
                <SelCol key={c} rotulo={NOME_COLUNA[c]} valor={planilha.mapa.colunas[c] ?? -1} onChange={(v) => setPlanilha({ ...planilha, mapa: { ...planilha.mapa, colunas: { ...planilha.mapa.colunas, [c]: v } } })} />
              ))}
            </div>
            {planilha.mapa.mes < 0 && <CaixaAlerta nivel="erro">Escolha a coluna do mês.</CaixaAlerta>}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setEtapa("origem")}><ArrowLeft className="h-4 w-4" />Voltar</Button>
              <Button disabled={planilha.mapa.mes < 0} onClick={() => { setLinhas(linhasDePlanilha(planilha.abas[planilha.aba] ?? [], planilha.cabecalho, planilha.mapa)); setEtapa("previa"); }} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90">Ver prévia</Button>
            </div>
          </div>
        )}

        {etapa === "previa" && (
          <div className="space-y-4">
            {pgdas && origem === "pgdas" && pgdas.avisos.map((a) => <CaixaAlerta key={a} nivel="aviso">{a}</CaixaAlerta>)}
            {pgdas && origem === "pgdas" && Object.keys(pgdas.conferencias).length > 0 && (
              <CaixaAlerta nivel="info">RBT12 lido do PGDAS-D para {Object.keys(pgdas.conferencias).map(nomeMes).join(", ")}: será usado para conferir o RBT12 calculado (alerta se a diferença passar de R$ 1,00).{Object.keys(pgdas.folha).length ? ` Folha de salários de ${Object.keys(pgdas.folha).length} meses guardada para o Fator R.` : ""}</CaixaAlerta>
            )}
            <div className="flex flex-wrap items-end gap-4 rounded-lg border border-via-border bg-via-paper p-3">
              {precisaDestino && (
                <label className="space-y-1">
                  <span className="text-xs font-medium text-via-ink">Totais sem segregação de {empresa.ano}</span>
                  <Select value={destino} onValueChange={(v) => setDestino(v as DestinoTotais)}>
                    <SelectTrigger className="h-9 w-72" aria-label="Destino dos totais"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {empresa.anexos.map((a) => <SelectItem key={a} value={a}>Anexo {a} – {NOME_COLUNA[COLUNA_PRINCIPAL[a]].toLowerCase()}</SelectItem>)}
                      <SelectItem value="anterior">Só o bloco do ano anterior (ignorar {empresa.ano})</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              )}
              <div className="space-y-1">
                <span className="text-xs font-medium text-via-ink">Sobrescrever meses já preenchidos?</span>
                <div role="radiogroup" aria-label="Sobrescrever meses já preenchidos?" className="flex overflow-hidden rounded-md border border-via-border bg-via-surface text-sm">
                  {[true, false].map((op) => (
                    <button key={String(op)} type="button" role="radio" aria-checked={sobrescrever === op} onClick={() => setSobrescrever(op)}
                      className={`px-4 py-1.5 font-medium ${sobrescrever === op ? "bg-via-ink text-via-on-ink" : "text-via-muted hover:text-via-ink"}`}>{op ? "Sim" : "Não"}</button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-via-muted">{previa.filter((p) => p.status === "novo").length} novos · {previa.filter((p) => p.status === "sobrescrever").length} a sobrescrever · {previa.filter((p) => p.status === "erro").length} com erro</p>
            </div>
            <div className="sn-scroll max-h-[45vh] overflow-y-auto rounded-lg border border-via-border">
              <table className="sn-table">
                <thead>
                  <tr>
                    <th scope="col"><Checkbox aria-label="Selecionar todas" checked={selecao.size > 0 && selecao.size === previa.filter((p) => p.status !== "erro").length}
                      onCheckedChange={(c) => setSelecao(c === true ? new Set(previa.filter((p) => p.status !== "erro").map((p) => p.id)) : new Set())} /></th>
                    <th scope="col">Mês</th><th scope="col">Anexo</th><th scope="col" className="!text-left">Coluna</th><th scope="col">Valor importado</th><th scope="col">Valor atual</th><th scope="col" className="!text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previa.map((p) => (
                    <tr key={p.id} className={p.status === "sobrescrever" ? "[&>td]:!bg-[var(--sn-amarelo-bg)]" : p.status === "erro" ? "[&>td]:!bg-[var(--sn-vermelho-bg)]" : ""}>
                      <td><Checkbox aria-label={`Importar ${p.mes ?? ""}`} disabled={p.status === "erro"} checked={selecao.has(p.id)}
                        onCheckedChange={(c) => setSelecao((s) => { const n = new Set(s); if (c === true) n.add(p.id); else n.delete(p.id); return n; })} /></td>
                      <td>{p.mes ? nomeMes(p.mes) : "—"}</td>
                      <td>{p.destino === "anterior" ? "Ano anterior" : p.destino ? `Anexo ${p.destino}` : "—"}</td>
                      <td className="!text-left">{p.destino === "anterior" ? "Receita total (RBT12)" : p.coluna ? NOME_COLUNA[p.coluna] : "—"}</td>
                      <td>{p.valor !== null ? num2(p.valor) : "—"}</td>
                      <td className="text-via-muted">{p.status === "erro" ? "—" : num2(p.atual)}</td>
                      <td className="!text-left">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[p.status].cls}`}>{STATUS[p.status].texto}</span>
                        {p.mensagem && <span className="ml-2 text-[11px] text-via-muted">{p.mensagem}{p.ref ? ` (${p.ref})` : ""}</span>}
                      </td>
                    </tr>
                  ))}
                  {previa.length === 0 && <tr><td colSpan={7} className="!text-center text-via-muted">Nenhuma receita encontrada.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setEtapa(origem === "planilha" ? "mapear" : "origem")}><ArrowLeft className="h-4 w-4" />Voltar</Button>
              <Button disabled={selecao.size === 0} onClick={confirmar} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90">Confirmar importação</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
