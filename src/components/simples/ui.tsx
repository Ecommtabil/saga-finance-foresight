import { useEffect, useState, type ClipboardEvent, type ReactNode } from "react";
import { AlertTriangle, Info, XCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { corFaixa, type Alerta } from "@/lib/simples/calculo";
import { lerValor } from "@/lib/simples/importacao";

const CLASSE_FAIXA = {
  verde: "bg-[var(--sn-verde-bg)] text-[var(--sn-verde)]",
  amarelo: "bg-[var(--sn-amarelo-bg)] text-[var(--sn-amarelo)]",
  laranja: "bg-[var(--sn-laranja-bg)] text-[var(--sn-laranja)]",
  vermelho: "bg-[var(--sn-vermelho-bg)] text-[var(--sn-vermelho)]",
  neutro: "bg-via-sub text-via-muted",
} as const;

export function FaixaBadge({ faixa }: { faixa: number }) {
  const texto = faixa === 0 ? "—" : faixa === 7 ? "Acima do teto" : `Faixa ${faixa}`;
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${CLASSE_FAIXA[corFaixa(faixa)]}`}>{texto}</span>;
}

const ICONE = { erro: XCircle, aviso: AlertTriangle, info: Info } as const;
const COR = {
  erro: "border-[var(--sn-vermelho)]/30 bg-[var(--sn-vermelho-bg)] text-[var(--sn-vermelho)]",
  aviso: "border-[var(--sn-amarelo)]/30 bg-[var(--sn-amarelo-bg)] text-[var(--sn-amarelo)]",
  info: "border-via-border bg-via-input text-via-ink",
} as const;

export function CaixaAlerta({ nivel, children }: { nivel: Alerta["nivel"]; children: ReactNode }) {
  const I = ICONE[nivel];
  return (
    <div role={nivel === "erro" ? "alert" : "status"} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${COR[nivel]}`}>
      <I className="mt-0.5 h-4 w-4 shrink-0" /><div>{children}</div>
    </div>
  );
}

export function IconeAlertas({ alertas }: { alertas: Alerta[] }) {
  if (!alertas.length) return null;
  const nivel = alertas.some((a) => a.nivel === "erro") ? "erro" : alertas.some((a) => a.nivel === "aviso") ? "aviso" : "info";
  const I = ICONE[nivel];
  const cor = nivel === "erro" ? "text-[var(--sn-vermelho)]" : nivel === "aviso" ? "text-[var(--sn-amarelo)]" : "text-via-blue";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={alertas.map((a) => a.texto).join(" ")} className={`ml-1 inline-flex align-middle ${cor}`}><I className="h-3.5 w-3.5" /></button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs space-y-1 text-xs">{alertas.map((a) => <p key={a.texto}>{a.texto}</p>)}</TooltipContent>
    </Tooltip>
  );
}

/** Cabeçalho de coluna com dica explicativa. */
export function Th({ children, dica, className = "" }: { children: ReactNode; dica?: string; className?: string }) {
  if (!dica) return <th scope="col" className={className}>{children}</th>;
  return (
    <th scope="col" className={className}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className="cursor-help underline decoration-dotted decoration-via-muted/60 underline-offset-2">{children}</span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs normal-case tracking-normal">{dica}</TooltipContent>
      </Tooltip>
    </th>
  );
}

function mascaraMoeda(texto: string): string {
  const limpo = texto.replace(/[^\d,]/g, "");
  const [int = "", ...resto] = limpo.split(",");
  const dec = resto.join("").slice(0, 2);
  const intFmt = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return limpo.includes(",") ? `${intFmt || "0"},${dec}` : intFmt;
}
const moedaTexto = (v: number) => (v ? v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "");

/** Converte o texto colado do Excel em matriz de valores (linhas × colunas). */
export function matrizColada(texto: string): (number | null)[][] {
  return texto.replace(/\r/g, "").replace(/\n$/, "").split("\n").map((l) => l.split("\t").map((c) => (c.trim() === "" ? null : lerValor(c))));
}

/** Campo R$ com máscara (vírgula decimal). Colar várias células chama onColarMatriz. */
export function CampoMoeda({ valor, onChange, rotulo, onColarMatriz, compacto = true }: {
  valor: number; onChange: (v: number) => void; rotulo: string; onColarMatriz?: (m: (number | null)[][]) => void; compacto?: boolean;
}) {
  const [texto, setTexto] = useState(moedaTexto(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setTexto(moedaTexto(valor)); }, [valor, foco]);
  const colar = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData("text/plain");
    if (/[\t\n]/.test(t.trim()) && onColarMatriz) {
      e.preventDefault();
      const m = matrizColada(t);
      const primeiro = m[0]?.[0];
      if (primeiro !== null && primeiro !== undefined && primeiro >= 0) setTexto(moedaTexto(primeiro));
      onColarMatriz(m);
      return;
    }
    const v = lerValor(t);
    if (v !== null) {
      e.preventDefault();
      if (v < 0) return onColarMatriz?.([[v]]);
      setTexto(moedaTexto(v)); onChange(v);
    }
  };
  return (
    <input
      aria-label={rotulo} inputMode="decimal" value={texto} placeholder="0,00"
      onFocus={() => setFoco(true)}
      onBlur={() => { setFoco(false); setTexto(moedaTexto(valor)); }}
      onChange={(e) => { const t = mascaraMoeda(e.target.value); setTexto(t); onChange(lerValor(t) ?? 0); }}
      onPaste={colar}
      className={`w-full rounded-md border border-via-border bg-via-input text-right tabular-nums text-via-ink outline-none placeholder:text-via-muted/50 focus:border-via-gold focus:ring-2 focus:ring-via-gold/30 ${compacto ? "h-8 min-w-[7.5rem] px-2 text-xs" : "h-9 px-3 text-sm"}`}
    />
  );
}
