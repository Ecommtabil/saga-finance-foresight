import { useState } from "react";
import { fmtNum, fmtPctTable, safeDiv } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FinRow {
  label: string;
  values: number[];
  bold?: boolean;
  isPct?: boolean;
  indent?: boolean;
}

export function FinancialTable({
  anos,
  rows,
  moeda = "R$",
  analises = false,
  baseAV,
  baseAVLabel = "base",
}: {
  anos: number[];
  rows: FinRow[];
  moeda?: string;
  /** Habilita botões de expansão com Análise Vertical (AV) e Horizontal (AH). */
  analises?: boolean;
  /** Série usada como 100% na Análise Vertical (por ano). */
  baseAV?: number[];
  baseAVLabel?: string;
}) {
  const [av, setAv] = useState(false);
  const [ah, setAh] = useState(false);
  const extras = (av ? 1 : 0) + (ah ? 1 : 0);

  return (
    <div className="space-y-3">
      {analises && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Expandir:</span>
          <Button
            type="button"
            size="sm"
            variant={av ? "default" : "outline"}
            onClick={() => setAv((v) => !v)}
          >
            Análise Vertical (AV%)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={ah ? "default" : "outline"}
            onClick={() => setAh((v) => !v)}
          >
            Análise Horizontal (AH%)
          </Button>
          {(av || ah) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setAv(false);
                setAh(false);
              }}
            >
              Limpar
            </Button>
          )}
          {av && (
            <span className="text-xs text-muted-foreground">
              AV% = participação sobre {baseAVLabel}
            </span>
          )}
          {ah && (
            <span className="text-xs text-muted-foreground">
              AH% = variação vs. ano anterior
            </span>
          )}
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          {extras > 0 && (
            <tr>
              <th className="px-4 py-1" />
              {anos.map((a) => (
                <th
                  key={a}
                  colSpan={1 + extras}
                  className="border-l px-4 py-1 text-center text-xs font-semibold text-muted-foreground"
                >
                  {a}
                </th>
              ))}
            </tr>
          )}
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
              Conta ({moeda})
            </th>
            {anos.map((a) => (
              <th key={a} className="contents">
                {null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.label + i}
              className={cn(
                "border-t",
                r.bold && "bg-muted/30 font-semibold",
                i % 2 === 1 && !r.bold && "bg-muted/10",
              )}
            >
              <td className={cn("px-4 py-2", r.indent && "pl-8")}>{r.label}</td>
              {r.values.map((v, j) => (
                <td
                  key={j}
                  className={cn(
                    "px-4 py-2 text-right tabular-nums",
                    extras > 0 && "border-l",
                    v < 0 && "text-destructive",
                  )}
                >
                  {r.isPct ? fmtPctTable(v) : fmtNum(v, 0)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}