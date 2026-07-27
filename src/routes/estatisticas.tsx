import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSaga } from "@/lib/saga/context";
import {
  estatisticaDescritiva,
  regressaoLinear,
  correlacao,
  volatilidade,
} from "@/lib/saga/calculations";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/estatisticas")({
  head: () => ({
    meta: [
      { title: "Análises Estatísticas — SAGA" },
      { name: "description", content: "Estatística descritiva, regressão, correlação e volatilidade." },
      { property: "og:title", content: "Análises Estatísticas — SAGA" },
      { property: "og:description", content: "Análises quantitativas com aviso de amostra pequena." },
    ],
  }),
  component: EstPage,
});

function EstPage() {
  const { dados } = useSaga();
  if (!dados) return <><PageHeader titulo="Estatísticas" /><EmptyState titulo="Estatísticas indisponíveis" /></>;

  const receita = dados.dre.receitaLiquida;
  const lucro = dados.dre.lucroLiquido;
  const ebitda = dados.dre.ebitda;

  const series = [
    { nome: "Receita Líquida", arr: receita },
    { nome: "EBITDA", arr: ebitda },
    { nome: "Lucro Líquido", arr: lucro },
  ];

  const reg = regressaoLinear(receita);

  const corrMatrix = series.map((a) => series.map((b) => correlacao(a.arr, b.arr)));

  return (
    <div className="space-y-6">
      <PageHeader titulo="Análises Estatísticas" subtitulo="Estatística descritiva, tendência, correlação e volatilidade." />

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Amostra pequena (5 anos)</AlertTitle>
        <AlertDescription>
          Resultados estatísticos com n = 5 têm baixa robustez e devem ser interpretados como indicativos.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Estatística Descritiva</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left">Série</th>
                <th className="p-2 text-right">Média</th>
                <th className="p-2 text-right">Desvio Padrão</th>
                <th className="p-2 text-right">Mín</th>
                <th className="p-2 text-right">Máx</th>
                <th className="p-2 text-right">Volatilidade (retornos)</th>
              </tr>
            </thead>
            <tbody>
              {series.map((s) => {
                const e = estatisticaDescritiva(s.arr);
                return (
                  <tr key={s.nome} className="border-t">
                    <td className="p-2 font-medium">{s.nome}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.media)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.desvio)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.min)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtNum(e.max)}</td>
                    <td className="p-2 text-right tabular-nums">{fmtPct(volatilidade(s.arr))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Tendência Linear (Receita Líquida)</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div><div className="text-xs uppercase text-muted-foreground">Coeficiente Angular</div><div className="font-medium">{fmtNum(reg.slope, 2)}</div></div>
            <div><div className="text-xs uppercase text-muted-foreground">Intercepto</div><div className="font-medium">{fmtNum(reg.intercept, 2)}</div></div>
            <div><div className="text-xs uppercase text-muted-foreground">R²</div><div className="font-medium">{fmtPct(reg.r2, 2)}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Matriz de Correlação</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2"></th>
                {series.map((s) => <th key={s.nome} className="p-2 text-right text-muted-foreground">{s.nome}</th>)}
              </tr>
            </thead>
            <tbody>
              {series.map((row, i) => (
                <tr key={row.nome} className="border-t">
                  <td className="p-2 font-medium text-muted-foreground">{row.nome}</td>
                  {corrMatrix[i].map((v, j) => (
                    <td
                      key={j}
                      className={cn("p-2 text-right tabular-nums")}
                      style={{
                        backgroundColor: `color-mix(in oklab, ${v >= 0 ? "var(--accent)" : "var(--destructive)"} ${Math.round(Math.abs(v) * 70)}%, transparent)`,
                      }}
                    >
                      {v.toFixed(2)}
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