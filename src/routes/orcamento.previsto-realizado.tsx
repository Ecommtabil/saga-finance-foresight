import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/saga/PageHeader";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrcamento } from "@/lib/orcamento/store";
import { analisarVariancia, ultimoMesRealizado } from "@/lib/orcamento/engine";
import { MESES, TIPO_LABEL } from "@/lib/orcamento/types";
import { fmtMoney, fmtNum, fmtPctTable } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orcamento/previsto-realizado")({
  component: PrevistoRealizado,
});

function PrevistoRealizado() {
  const { orcamento } = useOrcamento();
  const [ate, setAte] = useState<string>("auto");

  if (!orcamento || orcamento.linhas.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <p className="text-sm text-muted-foreground">Importe o orçamento para ver as variações.</p>
          <Button asChild>
            <Link to="/orcamento/dados">Ir para Dados & Importação</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const limite = ate === "auto" ? Math.max(ultimoMesRealizado(orcamento.linhas), 0) : Number(ate);
  const an = analisarVariancia(orcamento, limite);
  const grupos = [...new Set(orcamento.linhas.map((l) => l.grupo))];

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Previsto × Realizado"
        subtitulo="Variações mensais e acumuladas por conta, com sinalização de desvios favoráveis e desfavoráveis."
        action={
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Acumulado até</span>
            <Select value={ate} onValueChange={setAte}>
              <SelectTrigger className="h-9 w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (último real)</SelectItem>
                {MESES.map((m, i) => (
                  <SelectItem key={m} value={String(i)}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { l: "Receita", o: an.totais.receitaOrc, r: an.totais.receitaReal, rec: true },
          { l: "Custos", o: an.totais.custoOrc, r: an.totais.custoReal, rec: false },
          { l: "Despesas", o: an.totais.despesaOrc, r: an.totais.despesaReal, rec: false },
          { l: "Resultado", o: an.totais.resultadoOrc, r: an.totais.resultadoReal, rec: true },
        ].map((k) => {
          const v = k.r - k.o;
          const bom = k.rec ? v >= 0 : v <= 0;
          return (
            <Card key={k.l}>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  {k.l} — YTD
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold tabular-nums">{fmtMoney(k.r)}</p>
                <p className="text-xs text-muted-foreground">Orçado {fmtMoney(k.o)}</p>
                <p
                  className={cn(
                    "mt-1 text-xs font-medium tabular-nums",
                    bom ? "text-emerald-600" : "text-destructive",
                  )}
                >
                  {v >= 0 ? "+" : ""}
                  {fmtNum(v)} ({k.o ? fmtPctTable(v / Math.abs(k.o)) : "—"})
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-1.5 text-sm">
            Variações por conta
            <InfoTooltip text="Variação = realizado − orçado. Verde indica desvio favorável ao resultado (mais receita ou menos custo/despesa); vermelho indica desvio desfavorável." />
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">Conta</th>
                <th className="p-2 text-left">Tipo</th>
                <th className="p-2 text-right">Orçado YTD</th>
                <th className="p-2 text-right">Realizado YTD</th>
                <th className="p-2 text-right">Variação</th>
                <th className="p-2 text-right">Var %</th>
                <th className="p-2 text-right">Orçado ano</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((g) => (
                <>
                  <tr key={g} className="border-t bg-muted/30">
                    <td colSpan={7} className="p-2 font-semibold">
                      {g}
                    </td>
                  </tr>
                  {an.linhas
                    .filter((l) => l.linha.grupo === g)
                    .map((l) => (
                      <tr key={l.linha.id} className="border-t">
                        <td className="p-2">{l.linha.conta}</td>
                        <td className="p-2 text-muted-foreground">{TIPO_LABEL[l.linha.tipo]}</td>
                        <td className="p-2 text-right tabular-nums">{fmtNum(l.orcadoYtd)}</td>
                        <td className="p-2 text-right tabular-nums">{fmtNum(l.realizadoYtd)}</td>
                        <td
                          className={cn(
                            "p-2 text-right font-medium tabular-nums",
                            l.favoravelYtd ? "text-emerald-600" : "text-destructive",
                          )}
                        >
                          {fmtNum(l.varYtd)}
                        </td>
                        <td
                          className={cn(
                            "p-2 text-right tabular-nums",
                            l.favoravelYtd ? "text-emerald-600" : "text-destructive",
                          )}
                        >
                          {l.varYtdPct == null ? "—" : fmtPctTable(l.varYtdPct)}
                        </td>
                        <td className="p-2 text-right tabular-nums text-muted-foreground">
                          {fmtNum(l.orcadoAno)}
                        </td>
                      </tr>
                    ))}
                </>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhe mensal (variação por mês)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-auto p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>
                <th className="p-2 text-left">Conta</th>
                {MESES.map((m) => (
                  <th key={m} className="p-2 text-right">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {an.linhas.map((l) => (
                <tr key={l.linha.id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{l.linha.conta}</td>
                  {l.variacao.map((v, i) => (
                    <td
                      key={i}
                      className={cn(
                        "p-2 text-right tabular-nums",
                        v == null
                          ? "text-muted-foreground"
                          : (l.linha.tipo === "receita" || l.linha.tipo === "outros") === v >= 0
                            ? "text-emerald-600"
                            : "text-destructive",
                      )}
                    >
                      {v == null ? "—" : fmtNum(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
