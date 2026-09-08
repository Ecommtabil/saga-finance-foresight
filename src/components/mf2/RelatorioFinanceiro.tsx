import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmtNum, fmtPctTable, safeDiv } from "@/lib/saga/formatters";
import type { LinhaMes } from "@/lib/mf2/engine";

export type VisaoRel = "mensal" | "anual";

export interface LinhaRel {
  rotulo: string;
  /** Como agregar na visão anual: soma (contas de resultado/fluxo) ou saldo de dezembro. */
  tipo?: "soma" | "saldo";
  valor?: (l: LinhaMes) => number;
  /** Linha calculada a partir de todos os meses da coluna (ex.: margens). */
  derivado?: (periodo: LinhaMes[]) => number;
  /** Linha de crescimento % vs. coluna anterior, sobre a base informada. */
  crescimento?: (l: LinhaMes) => number;
  pct?: boolean;
  estilo?: "total" | "sub" | "grupo" | "item";
  indent?: number;
}

interface Coluna {
  chave: string;
  rotulo: string;
  meses: LinhaMes[];
}

function agregar(col: Coluna, ln: LinhaRel): number | null {
  if (ln.derivado) return ln.derivado(col.meses);
  if (!ln.valor) return null;
  if (ln.tipo === "saldo") {
    const ultimo = col.meses[col.meses.length - 1];
    return ultimo ? ln.valor(ultimo) : null;
  }
  return col.meses.reduce((a, m) => a + ln.valor!(m), 0);
}

export function RelatorioFinanceiro({
  meses,
  linhas,
  moeda = "R$",
  conferencia,
}: {
  meses: LinhaMes[];
  linhas: LinhaRel[];
  moeda?: string;
  conferencia?: ReactNode;
}) {
  const [visao, setVisao] = useState<VisaoRel>("anual");

  const colunas = useMemo<Coluna[]>(() => {
    if (visao === "mensal") {
      return meses.map((m) => ({ chave: String(m.indice), rotulo: m.rotulo, meses: [m] }));
    }
    const anos = Array.from(new Set(meses.map((m) => m.ano))).sort((a, b) => a - b);
    return anos.map((a) => ({
      chave: `ano-${a}`,
      rotulo: `Ano ${a}`,
      meses: meses.filter((m) => m.ano === a),
    }));
  }, [meses, visao]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Visão:</span>
          <Button
            size="sm"
            variant={visao === "mensal" ? "default" : "outline"}
            onClick={() => setVisao("mensal")}
          >
            Mensal (60 meses)
          </Button>
          <Button
            size="sm"
            variant={visao === "anual" ? "default" : "outline"}
            onClick={() => setVisao("anual")}
          >
            Anual (5 anos)
          </Button>
        </div>
        {conferencia}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="sticky left-0 z-10 min-w-[260px] bg-muted px-4 py-2 text-left font-semibold text-muted-foreground">
                Conta ({moeda})
              </th>
              {colunas.map((c) => (
                <th
                  key={c.chave}
                  className="min-w-[96px] px-3 py-2 text-right font-semibold text-muted-foreground"
                >
                  {c.rotulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((ln, i) => {
              const valores = colunas.map((c) =>
                ln.crescimento
                  ? c.meses.reduce((a, m) => a + ln.crescimento!(m), 0)
                  : agregar(c, ln),
              );
              const total = ln.estilo === "total";
              const grupo = ln.estilo === "grupo";
              const sub = ln.estilo === "sub";
              return (
                <tr
                  key={ln.rotulo + i}
                  className={cn(
                    "border-t",
                    total && "bg-muted/40 font-semibold",
                    grupo && "bg-muted/20 font-medium",
                    !total && !grupo && !sub && i % 2 === 1 && "bg-muted/[0.06]",
                  )}
                >
                  <td
                    className={cn(
                      "sticky left-0 z-10 px-4 py-1.5",
                      total && "bg-muted/60 font-semibold",
                      grupo && "bg-muted/40 font-medium",
                      !total && !grupo && "bg-card",
                      sub && "italic text-muted-foreground",
                    )}
                    style={{ paddingLeft: 16 + (ln.indent ?? 0) * 16 }}
                  >
                    {ln.rotulo}
                  </td>
                  {valores.map((v, j) => {
                    let texto = "—";
                    let negativo = false;
                    if (ln.crescimento) {
                      const anterior = valores[j - 1];
                      if (j > 0 && anterior !== null && anterior !== 0 && v !== null) {
                        const g = safeDiv(v - anterior, Math.abs(anterior));
                        texto = fmtPctTable(g);
                        negativo = g < 0;
                      }
                    } else if (v !== null) {
                      texto = ln.pct ? fmtPctTable(v) : fmtNum(v, 0);
                      negativo = v < 0;
                    }
                    return (
                      <td
                        key={colunas[j].chave}
                        className={cn(
                          "px-3 py-1.5 text-right tabular-nums",
                          total && "font-semibold",
                          sub && "italic text-muted-foreground",
                          negativo && !sub && "text-destructive",
                          negativo && sub && "text-destructive/80",
                        )}
                      >
                        {texto}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function NavRelatorios({
  modeloId,
  atual,
}: {
  modeloId: string;
  atual: "dashboard" | "dre" | "balanco" | "fluxo" | "indicadores";
}) {
  const itens = [
    { chave: "dashboard", rotulo: "Dashboard", to: "/modelagem-financeira-2/dashboard/$modeloId" },
    { chave: "dre", rotulo: "DRE", to: "/modelagem-financeira-2/relatorios/dre/$modeloId" },
    { chave: "balanco", rotulo: "Balanço Patrimonial", to: "/modelagem-financeira-2/relatorios/balanco/$modeloId" },
    { chave: "fluxo", rotulo: "Fluxo de Caixa", to: "/modelagem-financeira-2/relatorios/fluxo/$modeloId" },
    { chave: "indicadores", rotulo: "Indicadores", to: "/modelagem-financeira-2/indicadores/$modeloId" },
  ] as const;

  return (
    <Card className="mb-6">
      <CardContent className="flex flex-wrap items-center gap-2 py-3">
        <Button asChild size="sm" variant="ghost">
          <Link to="/modelagem-financeira-2/$modeloId" params={{ modeloId }}>
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Premissas
          </Link>
        </Button>
        {itens.map((it) => (
          <Button key={it.chave} asChild size="sm" variant={it.chave === atual ? "default" : "outline"}>
            <Link to={it.to} params={{ modeloId }}>
              {it.rotulo}
            </Link>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
