import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatBRLContabil } from "@/lib/finance";
import { tabelaFuncionarios, type Favorece, type PremissasEquipe, type RiscoQualitativo } from "@/lib/viabilidade/equipe-terceirizar";

export function TabelaFuncionarios({ p }: { p: PremissasEquipe }) {
  const linhas = tabelaFuncionarios(p);
  const virada = linhas.find((l, i) => i > 0 && l.melhor !== linhas[i - 1].melhor);
  return (
    <div className="rounded-lg border border-via-border p-3">
      <p className="text-sm font-semibold text-via-ink">Ponto de inflexão por nº de funcionários</p>
      <p className="mb-2 text-xs text-via-muted">
        {virada ? `A partir de ${virada.qtd} funcionário(s), a melhor opção passa a ser ${virada.melhor === "interno" ? "a equipe interna" : "terceirizar"}.` : `Em toda a faixa, a melhor opção é ${linhas[0].melhor === "interno" ? "a equipe interna" : "terceirizar"}.`}
        {" "}T&D e CAPEX ficam constantes; a mensalidade terceirizada é a da premissa.
      </p>
      <div className="max-h-80 overflow-auto">
        <table className="via-table">
          <thead><tr><th>Funcionários</th><th>VPL interno</th><th>VPL terceirizado</th><th>Melhor opção</th></tr></thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.qtd} className={l.qtd === p.qtd ? "via-subtotal" : ""}>
                <td>{l.qtd}{l.qtd === p.qtd ? " (atual)" : ""}</td>
                <td className="via-neg">{formatBRLContabil(l.vplInterno)}</td>
                <td className="via-neg">{formatBRLContabil(l.vplTerc)}</td>
                <td className={l.melhor === "interno" ? "font-semibold text-via-ink" : "font-semibold text-via-gold"}>{l.melhor === "interno" ? "Interno" : "Terceirizar"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const OPCOES: Array<[Favorece, string]> = [["interno", "Interno"], ["neutro", "Neutro"], ["terceirizado", "Terceirizado"]];

export function RiscosQualitativos({ riscos, onChange }: { riscos: RiscoQualitativo[]; onChange: (r: RiscoQualitativo[]) => void }) {
  const set = (id: string, patch: Partial<RiscoQualitativo>) => onChange(riscos.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const contagem = { interno: riscos.filter((r) => r.favorece === "interno").length, terceirizado: riscos.filter((r) => r.favorece === "terceirizado").length };
  return (
    <div className="rounded-lg border border-via-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-via-ink">Riscos qualitativos</p>
          <p className="text-xs text-via-muted">Não altera o cálculo; entra no relatório. Interno: {contagem.interno} · Terceirizado: {contagem.terceirizado}</p>
        </div>
        <Button size="sm" variant="outline" className="h-8 border-via-border text-xs"
          onClick={() => onChange([...riscos, { id: `r${Date.now()}`, texto: "Novo risco", favorece: "neutro" }])}>
          <Plus className="h-3.5 w-3.5" />Adicionar
        </Button>
      </div>
      <ul className="space-y-2">
        {riscos.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input aria-label="Descrição do risco" value={r.texto} onChange={(e) => set(r.id, { texto: e.target.value })} className="h-8 flex-1 border-via-border bg-via-input text-sm" />
            <div className="flex items-center gap-2">
              <div role="radiogroup" aria-label={`Favorece: ${r.texto}`} className="flex overflow-hidden rounded-md border border-via-border text-xs">
                {OPCOES.map(([v, t]) => (
                  <button key={v} type="button" role="radio" aria-checked={r.favorece === v} onClick={() => set(r.id, { favorece: v })}
                    className={`px-2.5 py-1.5 font-medium ${r.favorece === v ? (v === "interno" ? "bg-via-ink text-via-on-ink" : v === "terceirizado" ? "bg-via-gold text-via-ink" : "bg-via-sub text-via-ink") : "text-via-muted hover:text-via-ink"}`}>
                    {t}
                  </button>
                ))}
              </div>
              <Button size="icon" variant="ghost" aria-label={`Remover ${r.texto}`} className="h-8 w-8 text-via-muted" onClick={() => onChange(riscos.filter((x) => x.id !== r.id))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
