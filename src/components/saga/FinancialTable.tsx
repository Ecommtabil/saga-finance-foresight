import { fmtNum, fmtPctTable } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

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
}: {
  anos: number[];
  rows: FinRow[];
  moeda?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
              Conta ({moeda})
            </th>
            {anos.map((a) => (
              <th key={a} className="px-4 py-2 text-right font-semibold text-muted-foreground">
                {a}
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
  );
}