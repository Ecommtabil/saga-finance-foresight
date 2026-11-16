import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Copy, ExternalLink, GitCompare, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ESTUDOS, LISTA_ESTUDOS, premissasCompletas, relatorioDe } from "@/lib/viabilidade/estudos";
import { carregarCenarioNoEstudo, duplicarCenario, excluirCenario, formatarPremissa, formatarValor, lerCenarios, type Cenario } from "@/lib/viabilidade/estado";
import type { CampoPremissa, EstudoId } from "@/lib/viabilidade/tipos";
import { Bloco } from "@/components/viabilidade/ui";

export const Route = createFileRoute("/viabilidade/cenarios")({
  head: () => ({
    meta: [
      { title: "Meus cenários — Estudos de Viabilidade | Ecommtabil" },
      { name: "description", content: "Cenários salvos dos estudos de viabilidade, com filtros por cliente e estudo e comparador lado a lado." },
      { property: "og:title", content: "Meus cenários — Estudos de Viabilidade | Ecommtabil" },
      { property: "og:description", content: "Abra, duplique, exclua e compare até 3 cenários do mesmo estudo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CenariosPage,
});

const TODOS = "__todos";

function CenariosPage() {
  const navigate = useNavigate();
  const [lista, setLista] = useState<Cenario[]>([]);
  const [filtroCliente, setFiltroCliente] = useState("");
  const [filtroEstudo, setFiltroEstudo] = useState<string>(TODOS);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [excluir, setExcluir] = useState<Cenario | null>(null);
  const recarregar = () => setLista(lerCenarios());
  useEffect(recarregar, []);

  const filtrados = useMemo(() => lista.filter((c) =>
    (filtroEstudo === TODOS || c.estudo === filtroEstudo) &&
    (!filtroCliente.trim() || (c.cabecalho?.cliente ?? "").toLowerCase().includes(filtroCliente.trim().toLowerCase()) || c.nome.toLowerCase().includes(filtroCliente.trim().toLowerCase()))
  ), [lista, filtroCliente, filtroEstudo]);

  const escolhidos = selecionados.map((id) => lista.find((c) => c.id === id)).filter((c): c is Cenario => !!c);
  const estudoSelecionado = escolhidos[0]?.estudo;

  const alternar = (c: Cenario, marcar: boolean) => {
    if (!marcar) return setSelecionados((s) => s.filter((x) => x !== c.id));
    if (estudoSelecionado && c.estudo !== estudoSelecionado) return toast.error("Compare apenas cenários do mesmo estudo.");
    if (selecionados.length >= 3) return toast.error("Selecione no máximo 3 cenários.");
    setSelecionados((s) => [...s, c.id]);
  };

  const abrir = (c: Cenario) => {
    if (!carregarCenarioNoEstudo(c)) return toast.error("Não foi possível abrir o cenário.");
    navigate({ to: ESTUDOS[c.estudo].rota });
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-via-gold">Análise de Viabilidade</p>
        <h1 className="text-2xl font-bold tracking-tight text-via-ink">Meus cenários</h1>
        <p className="text-sm text-via-muted">Cenários salvos neste navegador, dentro do projeto atual. Marque até 3 do mesmo estudo para comparar.</p>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-via-border bg-via-surface p-4 shadow-[var(--via-shadow)] sm:flex-row">
        <Input aria-label="Filtrar por cliente" placeholder="Filtrar por cliente ou nome" value={filtroCliente} onChange={(e) => setFiltroCliente(e.target.value)} className="h-9 border-via-border sm:max-w-xs" />
        <Select value={filtroEstudo} onValueChange={setFiltroEstudo}>
          <SelectTrigger aria-label="Filtrar por estudo" className="h-9 border-via-border sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos os estudos</SelectItem>
            {LISTA_ESTUDOS.map((e) => <SelectItem key={e.id} value={e.id}>{e.titulo}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-via-border bg-via-surface p-10 text-center text-sm text-via-muted">
          {lista.length === 0 ? "Nenhum cenário salvo ainda. Abra um estudo e clique em “Salvar cenário”." : "Nenhum cenário com esses filtros."}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-via-border bg-via-surface shadow-[var(--via-shadow)]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-via-paper text-left text-xs uppercase tracking-wide text-via-muted">
              <tr><th className="w-10 p-3" /><th className="p-3">Cenário</th><th className="p-3">Estudo</th><th className="p-3">Cliente</th><th className="p-3">Parecer</th><th className="p-3">Salvo em</th><th className="p-3 text-right">Ações</th></tr>
            </thead>
            <tbody>
              {filtrados.map((c) => {
                const rel = relatorioDe(c.estudo, c.premissas);
                return (
                  <tr key={c.id} className="border-t border-via-border">
                    <td className="p-3"><Checkbox aria-label={`Comparar ${c.nome}`} checked={selecionados.includes(c.id)} onCheckedChange={(v) => alternar(c, v === true)} /></td>
                    <td className="p-3 font-medium text-via-ink">{c.nome}</td>
                    <td className="p-3 text-via-muted">{ESTUDOS[c.estudo].titulo}</td>
                    <td className="p-3">{c.cabecalho?.cliente || "–"}</td>
                    <td className="p-3 text-xs font-semibold text-via-ink">{rel.parecer.titulo}</td>
                    <td className="p-3 text-via-muted">{new Date(c.criadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => abrir(c)}><ExternalLink className="h-4 w-4" />Abrir</Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Duplicar ${c.nome}`} onClick={() => { duplicarCenario(c.id) ? toast.success("Cenário duplicado") : toast.error("Falha ao duplicar"); recarregar(); }}><Copy className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-via-bad" aria-label={`Excluir ${c.nome}`} onClick={() => setExcluir(c)}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {escolhidos.length >= 2 && estudoSelecionado && (
        <Comparador estudo={estudoSelecionado} cenarios={escolhidos} onLimpar={() => setSelecionados([])} />
      )}
      {escolhidos.length === 1 && <p className="text-sm text-via-muted"><GitCompare className="mr-1 inline h-4 w-4" />Marque mais um cenário de “{ESTUDOS[escolhidos[0].estudo].titulo}” para comparar.</p>}

      <AlertDialog open={!!excluir} onOpenChange={(o) => !o && setExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cenário?</AlertDialogTitle>
            <AlertDialogDescription>“{excluir?.nome}” será removido deste navegador. Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (excluir) { excluirCenario(excluir.id); setSelecionados((s) => s.filter((x) => x !== excluir.id)); recarregar(); toast.success("Cenário excluído"); } setExcluir(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Comparador({ estudo, cenarios, onLimpar }: { estudo: EstudoId; cenarios: Cenario[]; onLimpar: () => void }) {
  const campos = ESTUDOS[estudo].campos as unknown as CampoPremissa<Record<string, unknown>>[];
  const premissas = cenarios.map((c) => premissasCompletas(estudo, c.premissas) as unknown as Record<string, unknown>);
  const relatorios = cenarios.map((c) => relatorioDe(estudo, c.premissas));
  const diferentes = campos.filter((cp) => new Set(premissas.map((p) => JSON.stringify(p[cp.chave]))).size > 1);
  return (
    <Bloco titulo={`Comparador — ${ESTUDOS[estudo].titulo}`} acao={<Button size="sm" variant="ghost" onClick={onLimpar}><X className="h-4 w-4" />Limpar seleção</Button>}>
      <div className="overflow-x-auto">
        <table className="via-table">
          <thead><tr><th>Item</th>{cenarios.map((c) => <th key={c.id}>{c.nome}</th>)}</tr></thead>
          <tbody>
            <tr className="via-secao"><td>Premissas que mudam</td><td colSpan={cenarios.length} /></tr>
            {diferentes.length === 0 && <tr><td colSpan={cenarios.length + 1} className="text-via-muted">As premissas são iguais.</td></tr>}
            {diferentes.map((cp) => (
              <tr key={cp.chave} className="via-calc"><td>{cp.rotulo}</td>{premissas.map((p, i) => <td key={i}>{formatarPremissa(cp, p[cp.chave])}</td>)}</tr>
            ))}
            <tr className="via-secao"><td>Indicadores</td><td colSpan={cenarios.length} /></tr>
            {relatorios[0].kpis.map((k, ki) => (
              <tr key={k.id}><td>{k.rotulo}</td>{relatorios.map((r, i) => {
                const kk = r.kpis[ki];
                return <td key={i} className={kk.valor !== null && kk.valor < 0 && kk.formato === "brl" ? "via-neg" : ""}>{formatarValor(kk.valor, kk.formato, kk.textoNulo)}</td>;
              })}</tr>
            ))}
            <tr className="via-total"><td>Parecer</td>{relatorios.map((r, i) => <td key={i} className="whitespace-normal text-left text-xs">{r.parecer.titulo}</td>)}</tr>
          </tbody>
        </table>
      </div>
    </Bloco>
  );
}
