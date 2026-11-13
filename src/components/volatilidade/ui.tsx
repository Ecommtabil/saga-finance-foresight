import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { classificarCV, ROTULO_CLASSE, type ClasseCV } from "@/lib/volatilidade/stats";
import type { ConfigVolatilidade } from "@/lib/volatilidade/dados";

export function VolCard({ titulo, acao, children, className = "" }: { titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-vol-border bg-vol-surface p-5 shadow-[var(--vol-shadow)] md:p-6 ${className}`}>
      {(titulo || acao) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {titulo && <h2 className="text-base font-semibold text-vol-text md:text-lg">{titulo}</h2>}
          {acao}
        </div>
      )}
      {children}
    </section>
  );
}

export function Dica({ texto }: { texto: string }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" aria-label="Explicação" className="inline-flex align-middle text-vol-muted hover:text-vol-gold">
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{texto}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const COR_CLASSE: Record<ClasseCV, string> = {
  baixa: "bg-vol-good/15 text-vol-good border-vol-good/30",
  moderada: "bg-vol-warn/15 text-vol-warn border-vol-warn/40",
  alta: "bg-vol-bad/15 text-vol-bad border-vol-bad/30",
};

export function classeDo(cv: number, c: ConfigVolatilidade): ClasseCV {
  return classificarCV(cv, { baixo: c.cvBaixo, moderado: c.cvModerado });
}

export function SeloCV({ cv, config }: { cv: number; config: ConfigVolatilidade }) {
  const c = classeDo(cv, config);
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${COR_CLASSE[c]}`}>{ROTULO_CLASSE[c]}</span>;
}

export function Bolinha({ cor }: { cor: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cor }} />;
}

export const estiloTooltip = { background: "var(--vol-surface)", borderColor: "var(--vol-border)", color: "var(--vol-text)", borderRadius: 10, fontSize: 12 };
export const eixoTick = { fill: "var(--vol-muted)", fontSize: 11 };
