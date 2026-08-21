import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, NumInput, PctInput } from "@/components/simpl/fields";
import { useSimpl } from "@/lib/simpl/store";
import { ajustarHorizonte, MESES } from "@/lib/simpl/defaults";

export const Route = createFileRoute("/modelagem-simplificada/premissas")({
  head: () => ({
    meta: [
      { title: "Premissas macro — Modelagem Simplificada" },
      {
        name: "description",
        content: "Horizonte de projeção de 3 a 10 anos, IPCA e Selic editáveis por ano.",
      },
      { property: "og:title", content: "Premissas macroeconômicas — SAGA" },
      { property: "og:description", content: "IPCA, Selic e horizonte configuráveis por cenário." },
    ],
  }),
  component: PremissasPage,
});

function PremissasPage() {
  const { cenario, atualizarCenario } = useSimpl();
  if (!cenario) return null;
  const p = cenario.premissas;

  const setPremissa = (patch: Partial<typeof p>) =>
    atualizarCenario({ premissas: { ...p, ...patch } });

  const setArray = (campo: "ipca" | "selic", idx: number, v: number) => {
    const arr = [...p[campo]];
    arr[idx] = v;
    setPremissa({ [campo]: arr } as Partial<typeof p>);
  };

  return (
    <>
      <PageHeader
        titulo="Premissas do modelo"
        subtitulo="Horizonte configurável e curvas macro editáveis ano a ano."
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Período</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo label="Mês inicial">
              <Select
                value={String(p.mesInicio)}
                onValueChange={(v) => setPremissa({ mesInicio: Number(v) })}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <Campo label="Ano inicial">
              <NumInput value={p.anoInicio} onChange={(v) => setPremissa({ anoInicio: v })} />
            </Campo>
            <Campo label="Horizonte (anos)" ajuda="Permitido de 3 a 10 anos.">
              <Select
                value={String(p.horizonteAnos)}
                onValueChange={(v) => atualizarCenario(ajustarHorizonte(cenario, Number(v)))}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a} anos
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Campo>
            <div className="flex items-center justify-between rounded-md border p-2 sm:col-span-2">
              <div className="text-xs">
                <div className="font-medium">Reforma tributária (IBS/CBS)</div>
                <div className="text-muted-foreground">
                  Substitui ISS/ICMS/PIS/COFINS por IBS + CBS nas deduções.
                </div>
              </div>
              <Switch
                checked={p.reformaTributaria}
                onCheckedChange={(v) => setPremissa({ reformaTributaria: v })}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Curvas macroeconômicas por ano (%)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Indicador</TableHead>
                  {p.ipca.map((_, i) => (
                    <TableHead key={i} className="text-right">
                      {p.anoInicio + i}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">IPCA</TableCell>
                  {p.ipca.map((v, i) => (
                    <TableCell key={i} className="p-1">
                      <PctInput value={v} onChange={(nv) => setArray("ipca", i, nv)} />
                    </TableCell>
                  ))}
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium">Selic / CDI</TableCell>
                  {p.selic.map((v, i) => (
                    <TableCell key={i} className="p-1">
                      <PctInput value={v} onChange={(nv) => setArray("selic", i, nv)} />
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">
              IPCA corrige despesas fixas e salários; Selic remunera o caixa médio e serve de base
              para o custo da dívida no valuation.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
