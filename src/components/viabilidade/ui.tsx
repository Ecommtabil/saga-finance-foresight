import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Scale, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { parseBRL } from "@/lib/finance";
import { formatarValor } from "@/lib/viabilidade/estado";
import type { CampoPremissa, Kpi, Parecer } from "@/lib/viabilidade/tipos";

export function Bloco({ numero, titulo, children, acao, className = "" }: { numero?: number; titulo: string; children: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-xl border border-via-border bg-via-surface p-4 shadow-[var(--via-shadow)] md:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-via-ink">
          {numero !== undefined && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-via-gold text-xs font-bold text-via-ink">{numero}</span>}
          {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

// ---------- Inputs ----------
function mascaraMoeda(texto: string): string {
  const limpo = texto.replace(/[^\d,]/g, "");
  const [int = "", ...resto] = limpo.split(",");
  const dec = resto.join("").slice(0, 2);
  const intFmt = int.replace(/^0+(?=\d)/, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return limpo.includes(",") ? `${intFmt || "0"},${dec}` : intFmt;
}
const moedaTexto = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctTexto = (v: number) => (Math.round(v * 1e8) / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 4 });

function CampoTexto({ id, valor, formatar, ler, mascara, prefixo, sufixo, inputMode = "decimal", onChange }: {
  id: string; valor: number; formatar: (v: number) => string; ler: (s: string) => number; mascara?: (s: string) => string;
  prefixo?: string; sufixo?: string; inputMode?: "decimal" | "numeric"; onChange: (v: number) => void;
}) {
  const [texto, setTexto] = useState(() => formatar(valor));
  const [foco, setFoco] = useState(false);
  useEffect(() => { if (!foco) setTexto(formatar(valor)); }, [valor, foco, formatar]);
  return (
    <div className="relative">
      {prefixo && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-via-muted">{prefixo}</span>}
      <Input
        id={id} inputMode={inputMode} value={texto}
        onFocus={() => setFoco(true)}
        onBlur={() => { setFoco(false); setTexto(formatar(valor)); }}
        onChange={(e) => { const t = mascara ? mascara(e.target.value) : e.target.value; setTexto(t); onChange(ler(t)); }}
        className={`h-9 border-via-border bg-via-input text-right tabular-nums text-via-ink focus-visible:ring-via-gold ${prefixo ? "pl-9" : ""} ${sufixo ? "pr-12" : ""}`}
      />
      {sufixo && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-via-muted">{sufixo}</span>}
    </div>
  );
}

export function CampoPremissaInput<P>({ campo, valor, onChange }: { campo: CampoPremissa<P>; valor: unknown; onChange: (v: unknown) => void }) {
  const id = `via-${campo.chave}`;
  let controle: ReactNode;
  if (campo.tipo === "bool") {
    const v = Boolean(valor);
    controle = (
      <div role="radiogroup" aria-labelledby={`${id}-l`} className="flex w-full overflow-hidden rounded-md border border-via-border bg-via-input text-sm">
        {[true, false].map((op) => (
          <button key={String(op)} type="button" role="radio" aria-checked={v === op} onClick={() => onChange(op)}
            className={`flex-1 px-3 py-1.5 font-medium transition-colors ${v === op ? "bg-via-ink text-via-on-ink" : "text-via-muted hover:text-via-ink"}`}>
            {op ? "Sim" : "Não"}
          </button>
        ))}
      </div>
    );
  } else if (campo.tipo === "brl") {
    controle = <CampoTexto id={id} valor={Number(valor) || 0} prefixo="R$" formatar={moedaTexto} ler={parseBRL} mascara={mascaraMoeda} onChange={onChange} />;
  } else if (campo.tipo === "pct") {
    controle = <CampoTexto id={id} valor={Number(valor) || 0} sufixo="%" formatar={pctTexto} ler={(s) => parseBRL(s) / 100} mascara={(s) => s.replace(/[^\d,.-]/g, "")} onChange={onChange} />;
  } else {
    controle = (
      <CampoTexto id={id} valor={Number(valor) || 0} inputMode="numeric" formatar={(v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
        ler={(s) => { const n = Math.round(parseBRL(s)); return campo.max !== undefined ? Math.min(campo.max, n) : n; }}
        mascara={(s) => s.replace(/[^\d.]/g, "")}
        onChange={(v) => onChange(campo.min !== undefined ? Math.max(campo.min, v as number) : v)} />
    );
  }
  return (
    <div className="space-y-1">
      <Label id={`${id}-l`} htmlFor={campo.tipo === "bool" ? undefined : id} className="text-xs font-medium leading-snug text-via-text">
        {campo.rotulo}
        {campo.min !== undefined && campo.max !== undefined && campo.chave === "horizonte" && <span className="ml-1 font-normal text-via-muted">({campo.min} a {campo.max})</span>}
      </Label>
      {controle}
      {campo.ajuda && <p className="text-[11px] text-via-muted">{campo.ajuda}</p>}
    </div>
  );
}

export function FormPremissas<P extends object>({ campos, valores, onChange }: { campos: CampoPremissa<P>[]; valores: P; onChange: (chave: keyof P, v: unknown) => void }) {
  const grupos: Array<[string, CampoPremissa<P>[]]> = [];
  for (const c of campos) {
    if (c.visivel && !c.visivel(valores)) continue;
    const g = grupos.find(([n]) => n === c.grupo);
    if (g) g[1].push(c);
    else grupos.push([c.grupo, [c]]);
  }
  return (
    <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 xl:grid-cols-4">
      {grupos.map(([nome, lista]) => (
        <fieldset key={nome} className="min-w-0 space-y-3 rounded-lg border border-via-border/70 p-3">
          <legend className="px-1 text-[11px] font-semibold uppercase tracking-wider text-via-muted">{nome}</legend>
          {lista.map((c) => (
            <CampoPremissaInput key={c.chave} campo={c} valor={(valores as Record<string, unknown>)[c.chave]} onChange={(v) => onChange(c.chave as keyof P, v)} />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

// ---------- KPIs e parecer ----------
export function KpiCard({ kpi }: { kpi: Kpi }) {
  const cor = kpi.ok === true ? "text-via-good" : kpi.ok === false ? "text-via-bad" : "text-via-ink";
  const texto = formatarValor(kpi.valor, kpi.formato, kpi.textoNulo);
  return (
    <div className={`min-w-0 rounded-lg border p-3 ${kpi.destaque ? "border-via-gold/60 bg-via-paper" : "border-via-border bg-via-surface"}`}>
      <div className="flex items-start justify-between gap-1">
        <p className="text-[11px] font-medium uppercase leading-tight tracking-wide text-via-muted">{kpi.rotulo}</p>
        {kpi.dica && (
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label={`Sobre ${kpi.rotulo}`} className="shrink-0 text-via-muted hover:text-via-ink"><Info className="h-3.5 w-3.5" /></button>
              </TooltipTrigger>
              <TooltipContent className="max-w-64 text-xs">{kpi.dica}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <p className={`mt-1.5 whitespace-nowrap font-bold tabular-nums leading-tight ${texto.length > 15 ? "text-base" : "text-lg"} ${cor}`}>{texto}</p>
    </div>
  );
}

const ESTILO_PARECER = {
  verde: { classe: "border-via-good/40 bg-via-good/10", titulo: "text-via-good", Icone: CheckCircle2 },
  amarelo: { classe: "border-via-warn/40 bg-via-warn/10", titulo: "text-via-warn", Icone: AlertTriangle },
  vermelho: { classe: "border-via-bad/40 bg-via-bad/10", titulo: "text-via-bad", Icone: XCircle },
  info: { classe: "border-via-gold/60 bg-via-ink text-via-on-ink", titulo: "text-via-gold", Icone: Scale },
} as const;

export function ParecerCard({ parecer }: { parecer: Parecer }) {
  const e = ESTILO_PARECER[parecer.nivel];
  return (
    <div className={`rounded-xl border-2 p-4 ${e.classe}`} role="status" aria-label="Parecer automático">
      <div className="flex items-center gap-2">
        <e.Icone className={`h-5 w-5 shrink-0 ${e.titulo}`} />
        <p className={`text-sm font-bold tracking-wide ${e.titulo}`}>{parecer.titulo}</p>
      </div>
      <p className={`mt-2 text-sm leading-relaxed ${parecer.nivel === "info" ? "text-via-on-ink/90" : "text-via-text"}`}>{parecer.texto}</p>
    </div>
  );
}

export function GraficoCard({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: ReactNode }) {
  return (
    <div data-via-chart={titulo} className="min-w-0 rounded-lg border border-via-border bg-via-surface p-3">
      <p className="text-sm font-semibold text-via-ink">{titulo}</p>
      {subtitulo && <p className="text-xs text-via-muted">{subtitulo}</p>}
      <div className="via-chart mt-2">{children}</div>
    </div>
  );
}
