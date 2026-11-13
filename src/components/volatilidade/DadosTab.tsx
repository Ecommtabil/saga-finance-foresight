import { useRef, useState } from "react";
import { AlertTriangle, ClipboardPaste, FileUp, PencilLine, Plus, RotateCcw, Sparkles, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVolatilidade } from "@/lib/volatilidade/store";
import {
  celulaAjustada, gradeDeMatriz, gradeDeTexto, importarGrade, lerNumero, mascararCnpj, mesTexto, numero, PALETA_SERIES,
  sugerirColunas, validarEstudo, valorEfetivo, type Celula, type GradeImportada, type LinhaMes,
} from "@/lib/volatilidade/dados";
import { VolCard } from "./ui";

const novoId = () => crypto.randomUUID();
const rotulo = "mb-1 block text-xs font-medium uppercase tracking-wide text-vol-muted";
const campo = "border-vol-border bg-vol-surface text-vol-text";

function proximoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, "0")}`;
}

export function DadosTab() {
  const estudo = useVolatilidade(s => s.estudo);
  const atualizar = useVolatilidade(s => s.atualizar);
  const carregarExemplo = useVolatilidade(s => s.carregarExemplo);
  const [modo, setModo] = useState<"upload" | "colar">("upload");
  const [texto, setTexto] = useState("");
  const [grade, setGrade] = useState<GradeImportada | null>(null);
  const [avisos, setAvisos] = useState<string[]>([]);
  const arquivoRef = useRef<HTMLInputElement>(null);
  const validacoes = validarEstudo(estudo);

  const lerArquivo = async (f: File) => {
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matriz = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });
      const g = gradeDeMatriz(matriz);
      if (!g.linhas.length) throw new Error("vazio");
      setGrade(g);
    } catch {
      toast.error("Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv com uma coluna de mês e colunas numéricas.");
    } finally {
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  };

  const lerColado = () => {
    const g = gradeDeTexto(texto);
    if (!g.linhas.length) { toast.error("Cole ao menos uma linha de dados (mês e valores separados por tabulação)."); return; }
    setGrade(g);
  };

  const confirmarImportacao = (colMes: number, cols: number[], substituir: boolean) => {
    if (!grade) return;
    const r = importarGrade(grade, colMes, cols, novoId, substituir ? [] : estudo.series);
    atualizar(e => {
      if (substituir) return { ...e, series: r.series, linhas: r.linhas, filtro: { inicio: null, fim: null }, diagnostico: null };
      const series = [...e.series, ...r.series.filter(s => !e.series.some(x => x.id === s.id))];
      const mapa = new Map(e.linhas.map(l => [l.mes, { ...l, valores: { ...l.valores } }]));
      for (const l of r.linhas) {
        const atual = mapa.get(l.mes) ?? { mes: l.mes, valores: {} };
        mapa.set(l.mes, { ...atual, valores: { ...atual.valores, ...l.valores } });
      }
      return { ...e, series, linhas: [...mapa.values()], diagnostico: null };
    });
    setAvisos(r.avisos);
    setGrade(null);
    setTexto("");
    toast.success(`${r.linhas.length} meses importados em ${r.series.length} série(s).`);
  };

  const definirLinhas = (f: (l: LinhaMes[]) => LinhaMes[]) => atualizar(e => ({ ...e, linhas: f(e.linhas) }));
  const mudarCelula = (mes: string, serieId: string, c: Celula) =>
    definirLinhas(ls => ls.map(l => (l.mes === mes ? { ...l, valores: { ...l.valores, [serieId]: c } } : l)));
  const adicionarMes = () => definirLinhas(ls => {
    const ultimo = ls.length ? ls[ls.length - 1].mes : new Date().toISOString().slice(0, 7);
    let m = ls.length ? proximoMes(ultimo) : ultimo;
    while (ls.some(l => l.mes === m)) m = proximoMes(m);
    return [...ls, { mes: m, valores: {} }];
  });
  const mudarMes = (de: string, para: string) => {
    if (!para || de === para) return;
    if (estudo.linhas.some(l => l.mes === para)) { toast.error(`O mês ${mesTexto(para)} já existe na tabela.`); return; }
    definirLinhas(ls => ls.map(l => (l.mes === de ? { ...l, mes: para } : l)));
  };
  const adicionarSerie = () => atualizar(e => ({ ...e, series: [...e.series, { id: novoId(), nome: `Série ${e.series.length + 1}`, cor: PALETA_SERIES[e.series.length % PALETA_SERIES.length] }] }));

  return (
    <div className="space-y-6">
      <VolCard titulo="Cabeçalho do estudo">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div><label className={rotulo} htmlFor="vol-cliente">Cliente</label><Input id="vol-cliente" className={campo} value={estudo.cliente} placeholder="Nome do cliente" onChange={e => atualizar(x => ({ ...x, cliente: e.target.value }))} /></div>
          <div><label className={rotulo} htmlFor="vol-cnpj">CNPJ (opcional)</label><Input id="vol-cnpj" className={campo} value={estudo.cnpj} inputMode="numeric" placeholder="00.000.000/0000-00" onChange={e => atualizar(x => ({ ...x, cnpj: mascararCnpj(e.target.value) }))} /></div>
          <div><label className={rotulo} htmlFor="vol-resp">Responsável técnico</label><Input id="vol-resp" className={campo} value={estudo.responsavel} placeholder="Nome e registro (CRC)" onChange={e => atualizar(x => ({ ...x, responsavel: e.target.value }))} /></div>
          <div><label className={rotulo} htmlFor="vol-data">Data da análise</label><Input id="vol-data" type="date" className={campo} value={estudo.dataAnalise} onChange={e => atualizar(x => ({ ...x, dataAnalise: e.target.value }))} /></div>
        </div>
      </VolCard>

      <VolCard titulo="Entrada de dados" acao={
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => { carregarExemplo(); setAvisos([]); toast.success("Exemplo carregado."); }}><Sparkles />Carregar exemplo</Button>
          <Button variant="ghost" size="sm" onClick={() => { atualizar(e => ({ ...e, linhas: [], filtro: { inicio: null, fim: null }, diagnostico: null })); setAvisos([]); }}><RotateCcw />Limpar valores</Button>
        </div>
      }>
        <div className="mb-4 flex gap-2" role="tablist" aria-label="Forma de entrada">
          {([["upload", "Upload de Excel/CSV", FileUp], ["colar", "Colar do Excel", ClipboardPaste]] as const).map(([id, nome, Icone]) => (
            <Button key={id} role="tab" aria-selected={modo === id} variant="ghost" size="sm" onClick={() => setModo(id)}
              className={modo === id ? "bg-vol-ink text-vol-on-ink hover:bg-vol-ink hover:text-vol-on-ink" : "text-vol-text"}>
              <Icone className={modo === id ? "text-vol-gold" : ""} />{nome}
            </Button>
          ))}
        </div>
        {modo === "upload" ? (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-vol-border bg-vol-paper p-8 text-center text-vol-text transition hover:border-vol-gold">
            <FileUp className="h-8 w-8 text-vol-gold" />
            <span className="font-medium">Selecione um arquivo .xlsx, .xls ou .csv</span>
            <span className="text-xs text-vol-muted">A coluna de mês e as colunas numéricas são detectadas automaticamente; você confirma antes de importar.</span>
            <input ref={arquivoRef} type="file" accept=".xlsx,.xls,.csv" className="sr-only" aria-label="Arquivo de dados" onChange={e => { const f = e.target.files?.[0]; if (f) void lerArquivo(f); }} />
          </label>
        ) : (
          <div className="space-y-3">
            <Textarea value={texto} onChange={e => setTexto(e.target.value)} rows={7} aria-label="Dados colados"
              className={`${campo} font-mono text-xs`} placeholder={"Mês\tFaturamento\tRecebimento\njan/22\t476.288,42\t413.574\nfev/22\t527.830,72\t485.190"} />
            <Button onClick={lerColado} disabled={!texto.trim()}><ClipboardPaste />Interpretar dados colados</Button>
          </div>
        )}
        {avisos.length > 0 && (
          <div className="mt-4 rounded-xl border border-vol-warn/40 bg-vol-warn/10 p-4 text-sm text-vol-text">
            <p className="mb-2 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4 text-vol-warn" />Avisos da importação</p>
            <ul className="list-disc space-y-1 pl-5 text-xs">{avisos.slice(0, 12).map((a, i) => <li key={i}>{a}</li>)}</ul>
            {avisos.length > 12 && <p className="mt-1 text-xs text-vol-muted">… e mais {avisos.length - 12} aviso(s).</p>}
          </div>
        )}
      </VolCard>

      <VolCard titulo="Séries" acao={<Button size="sm" variant="outline" onClick={adicionarSerie}><Plus />Adicionar série</Button>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {estudo.series.map(s => (
            <div key={s.id} className="flex items-center gap-2 rounded-xl border border-vol-border bg-vol-paper p-2">
              <input type="color" value={s.cor} aria-label={`Cor de ${s.nome}`} className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-vol-border bg-transparent"
                onChange={e => atualizar(x => ({ ...x, series: x.series.map(y => (y.id === s.id ? { ...y, cor: e.target.value } : y)) }))} />
              <Input value={s.nome} aria-label="Nome da série" className={campo}
                onChange={e => atualizar(x => ({ ...x, series: x.series.map(y => (y.id === s.id ? { ...y, nome: e.target.value } : y)) }))} />
              <Button size="icon" variant="ghost" aria-label={`Remover ${s.nome}`} disabled={estudo.series.length <= 1}
                onClick={() => atualizar(x => ({ ...x, series: x.series.filter(y => y.id !== s.id), linhas: x.linhas.map(l => { const v = { ...l.valores }; delete v[s.id]; return { ...l, valores: v }; }) }))}>
                <Trash2 className="h-4 w-4 text-vol-bad" />
              </Button>
            </div>
          ))}
        </div>
      </VolCard>

      <VolCard titulo={`Tabela de dados (${estudo.linhas.length} meses)`} acao={<Button size="sm" variant="outline" onClick={adicionarMes}><Plus />Adicionar mês</Button>}>
        {estudo.linhas.length === 0 ? (
          <div className="rounded-xl border border-dashed border-vol-border p-8 text-center text-sm text-vol-muted">
            Nenhum mês informado. Faça upload de uma planilha, cole do Excel, adicione meses manualmente ou clique em <strong className="text-vol-text">Carregar exemplo</strong>.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="vol-table min-w-[560px]">
              <thead><tr><th>Mês</th>{estudo.series.map(s => <th key={s.id} className="num"><span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.cor }} />{s.nome}</span></th>)}<th className="w-10" /></tr></thead>
              <tbody>
                {estudo.linhas.map(l => (
                  <tr key={l.mes}>
                    <td><Input type="month" value={l.mes} aria-label={`Mês ${mesTexto(l.mes)}`} className={`${campo} h-8 w-40`} onChange={e => mudarMes(l.mes, e.target.value)} /></td>
                    {estudo.series.map(s => <td key={s.id} className="num"><CelulaEditavel celula={l.valores[s.id]} rotulo={`${s.nome} ${mesTexto(l.mes)}`} onChange={c => mudarCelula(l.mes, s.id, c)} /></td>)}
                    <td><Button size="icon" variant="ghost" aria-label={`Remover ${mesTexto(l.mes)}`} onClick={() => definirLinhas(ls => ls.filter(x => x.mes !== l.mes))}><Trash2 className="h-4 w-4 text-vol-muted" /></Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-center gap-1 text-xs text-vol-muted"><PencilLine className="h-3.5 w-3.5 text-vol-gold" />Use o lápis em cada célula para lançar um ajuste manual com observação (ex.: −50.000 estorno). Meses são sempre ordenados cronologicamente.</p>
      </VolCard>

      {validacoes.length > 0 && (
        <VolCard titulo="Validação dos dados">
          <ul className="space-y-2 text-sm">
            {validacoes.map((v, i) => (
              <li key={i} className={`flex items-start gap-2 ${v.nivel === "erro" ? "text-vol-bad" : "text-vol-text"}`}>
                {v.nivel === "erro" ? <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-vol-warn" />}{v.texto}
              </li>
            ))}
          </ul>
        </VolCard>
      )}

      {grade && <MapearColunas grade={grade} temDados={estudo.linhas.length > 0} onCancelar={() => setGrade(null)} onConfirmar={confirmarImportacao} />}
    </div>
  );
}

function CelulaEditavel({ celula, rotulo, onChange }: { celula?: Celula; rotulo: string; onChange: (c: Celula) => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [invalido, setInvalido] = useState(false);
  const ajustada = celulaAjustada(celula);
  const efetivo = valorEfetivo(celula);
  const confirmar = () => {
    if (editando === null) return;
    const t = editando.trim();
    if (!t) { onChange({ ...celula, valor: null }); setEditando(null); setInvalido(false); return; }
    const n = lerNumero(t);
    if (n === null) { setInvalido(true); toast.error(`Valor não numérico em ${rotulo}: "${t}".`); return; }
    if (n < 0) toast.warning(`Valor negativo em ${rotulo}.`);
    onChange({ ...celula, valor: n });
    setEditando(null);
    setInvalido(false);
  };
  return (
    <div className="flex items-center justify-end gap-1">
      <Input
        value={editando ?? (celula?.valor != null ? numero(celula.valor) : "")}
        aria-label={rotulo} aria-invalid={invalido} inputMode="decimal"
        className={`h-8 w-36 text-right tabular-nums ${campo} ${invalido ? "border-vol-bad ring-1 ring-vol-bad" : ""}`}
        onFocus={() => setEditando(celula?.valor != null ? numero(celula.valor) : "")}
        onChange={e => { setEditando(e.target.value); setInvalido(false); }}
        onBlur={confirmar}
        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={ajustada ? `Ajuste em ${rotulo}: ${celula?.obs ?? ""}` : `Ajustar ${rotulo}`} title={ajustada ? `Ajustado: ${numero(celula?.ajuste ?? 0)} ${celula?.obs ?? ""} → ${efetivo !== null ? numero(efetivo) : "—"}` : "Ajuste manual"}>
            <PencilLine className={`h-4 w-4 ${ajustada ? "text-vol-gold" : "text-vol-muted/50"}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3">
          <p className="text-sm font-semibold">Ajuste manual — {rotulo}</p>
          <AjusteForm celula={celula} onSalvar={onChange} />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function AjusteForm({ celula, onSalvar }: { celula?: Celula; onSalvar: (c: Celula) => void }) {
  const [ajuste, setAjuste] = useState(celula?.ajuste ? numero(celula.ajuste) : "");
  const [obs, setObs] = useState(celula?.obs ?? "");
  const n = ajuste.trim() ? lerNumero(ajuste) : 0;
  const base = celula?.valor ?? null;
  return (
    <div className="space-y-3">
      <div><label className="text-xs text-muted-foreground" htmlFor="vol-ajuste">Ajuste em R$ (aceita negativo)</label><Input id="vol-ajuste" value={ajuste} onChange={e => setAjuste(e.target.value)} placeholder="−50.000,00" /></div>
      <div><label className="text-xs text-muted-foreground" htmlFor="vol-obs">Observação</label><Input id="vol-obs" value={obs} onChange={e => setObs(e.target.value)} placeholder="Ex.: estorno de venda" /></div>
      {n === null ? <p className="text-xs text-destructive">Ajuste não numérico.</p> : base !== null && <p className="text-xs text-muted-foreground">Valor usado nos cálculos: <strong>{numero(base + n)}</strong></p>}
      <div className="flex gap-2">
        <Button size="sm" disabled={n === null} onClick={() => onSalvar({ valor: base, ajuste: n ?? 0, obs: obs.trim() || undefined })}>Aplicar</Button>
        <Button size="sm" variant="ghost" onClick={() => { setAjuste(""); setObs(""); onSalvar({ valor: base }); }}>Remover ajuste</Button>
      </div>
    </div>
  );
}

function MapearColunas({ grade, temDados, onCancelar, onConfirmar }: { grade: GradeImportada; temDados: boolean; onCancelar: () => void; onConfirmar: (mes: number, cols: number[], substituir: boolean) => void }) {
  const sug = sugerirColunas(grade);
  const [colMes, setColMes] = useState(sug.colunaMes);
  const [cols, setCols] = useState<number[]>(sug.colunasSeries);
  const [substituir, setSubstituir] = useState(true);
  const ok = colMes >= 0 && cols.length > 0;
  return (
    <Dialog open onOpenChange={o => { if (!o) onCancelar(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Confirme as colunas</DialogTitle>
          <DialogDescription>{grade.linhas.length} linhas encontradas. Confira qual coluna é o mês e quais são as séries.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Coluna do mês</p>
            <Select value={colMes >= 0 ? String(colMes) : undefined} onValueChange={v => { const i = Number(v); setColMes(i); setCols(c => c.filter(x => x !== i)); }}>
              <SelectTrigger aria-label="Coluna do mês"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{grade.cabecalho.map((c, i) => <SelectItem key={i} value={String(i)}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-muted-foreground">Séries</p>
            <div className="flex flex-wrap gap-3">
              {grade.cabecalho.map((c, i) => i === colMes ? null : (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={cols.includes(i)} onCheckedChange={v => setCols(x => (v ? [...x, i].sort((a, b) => a - b) : x.filter(y => y !== i)))} />{c}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="max-h-64 overflow-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted"><tr>{grade.cabecalho.map((c, i) => <th key={i} className={`px-2 py-1.5 text-left font-medium ${i === colMes ? "text-primary" : cols.includes(i) ? "" : "text-muted-foreground line-through"}`}>{c}</th>)}</tr></thead>
            <tbody>{grade.linhas.slice(0, 10).map((l, r) => <tr key={r} className="border-t">{l.map((v, i) => <td key={i} className="px-2 py-1">{v instanceof Date ? v.toLocaleDateString("pt-BR") : String(v ?? "")}</td>)}</tr>)}</tbody>
          </table>
        </div>
        {temDados && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={substituir} onCheckedChange={v => setSubstituir(!!v)} />Substituir os dados atuais (desmarque para mesclar por mês)
          </label>
        )}
        {!ok && <p className="text-sm text-destructive">Selecione a coluna do mês e ao menos uma série numérica.</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onCancelar}>Cancelar</Button>
          <Button disabled={!ok} onClick={() => onConfirmar(colMes, cols, substituir || !temDados)}>Importar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
