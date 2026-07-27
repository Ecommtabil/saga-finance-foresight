import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { useSaga } from "@/lib/saga/context";
import type { Premissas } from "@/lib/saga/types";

export const Route = createFileRoute("/indices")({
  head: () => ({
    meta: [
      { title: "Índices Econômicos — SAGA" },
      { name: "description", content: "Ajuste das premissas macroeconômicas e de risco." },
      { property: "og:title", content: "Índices Econômicos — SAGA" },
      { property: "og:description", content: "Selic, CDI, IPCA, Beta, ERP." },
    ],
  }),
  component: IndicesPage,
});

const CAMPOS: { k: keyof Premissas; label: string; pct?: boolean }[] = [
  { k: "selic", label: "Selic", pct: true },
  { k: "cdi", label: "CDI", pct: true },
  { k: "ipca", label: "IPCA", pct: true },
  { k: "rf", label: "Taxa Livre de Risco (Rf)", pct: true },
  { k: "beta", label: "Beta" },
  { k: "erp", label: "Prêmio de Risco (ERP)", pct: true },
  { k: "aliquotaIR", label: "Alíquota IR/CSLL", pct: true },
  { k: "custoDivida", label: "Custo da Dívida (Kd)", pct: true },
  { k: "dividaTotal", label: "Dívida Total (mercado)" },
  { k: "equityMercado", label: "Equity (mercado)" },
  { k: "crescimentoProj", label: "Crescimento Projetado (5 anos)", pct: true },
  { k: "crescimentoPerp", label: "Crescimento Perpetuidade (g)", pct: true },
];

function IndicesPage() {
  const { dados, atualizarPremissas } = useSaga();
  if (!dados) return <><PageHeader titulo="Índices Econômicos" /><EmptyState titulo="Premissas indisponíveis" /></>;
  const p = dados.premissas;
  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Índices Econômicos & Premissas"
        subtitulo="Ajuste as premissas antes de rodar o valuation. Alterações refletem imediatamente no DCF."
      />
      <Card>
        <CardHeader><CardTitle>Premissas</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {CAMPOS.map((c) => (
              <div key={c.k} className="space-y-1">
                <Label htmlFor={c.k}>{c.label}{c.pct && " (%)"}</Label>
                <Input
                  id={c.k}
                  type="number"
                  step="0.01"
                  value={c.pct ? Number(((p[c.k] as number) * 100).toFixed(2)) : (p[c.k] as number)}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    atualizarPremissas({ [c.k]: c.pct ? v / 100 : v } as Partial<Premissas>);
                  }}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}