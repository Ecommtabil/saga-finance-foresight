import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, PctInput, NumInput } from "@/components/simpl/fields";
import { useSimpl } from "@/lib/simpl/store";
import { gradeSensibilidade } from "@/lib/simpl/valuation";
import { fmtMoney, fmtMult, fmtPct } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-simplificada/valuation")({
  head: () => ({
    meta: [
      { title: "Valuation DCF — Modelagem Simplificada" },
      {
        name: "description",
        content: "FCFF, WACC via CAPM, perpetuidade de Gordon e sensibilidade de Enterprise Value.",
      },
      { property: "og:title", content: "Valuation DCF — SAGA" },
      { property: "og:description", content: "Enterprise e Equity Value com múltiplo implícito." },
    ],
  }),
  component: ValuationPage,
});

function ValuationPage() {
  const { empresa, cenario, dcf, atualizarCenario } = useSimpl();
  if (!empresa || !cenario || !dcf) return null;
  const v = cenario.valuation;
  const moeda = empresa.moeda;
  const set = (patch: Partial<typeof v>) => atualizarCenario({ valuation: { ...v, ...patch } });
  const grade = gradeSensibilidade(dcf, v.gPerp);

  return (
    <>
      <PageHeader
        titulo="Valuation (DCF)"
        subtitulo="Fluxo de caixa livre para a firma descontado ao WACC, com valor terminal por perpetuidade."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Custo de capital</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Campo label="Taxa livre de risco (Rf)" ajuda="Retorno de um título soberano de longo prazo — base do CAPM.">
              <PctInput value={v.rf} onChange={(x) => set({ rf: x })} />
            </Campo>
            <Campo label="Beta" ajuda="Sensibilidade do retorno da empresa ao mercado. Relavancar pela estrutura de capital alvo.">
              <NumInput value={v.beta} onChange={(x) => set({ beta: x })} />
            </Campo>
            <Campo label="Prêmio de risco (ERP)" ajuda="Retorno adicional exigido por investir em ações em vez do ativo livre de risco.">
              <PctInput value={v.erp} onChange={(x) => set({ erp: x })} />
            </Campo>
            <Campo label="Risco país" ajuda="Spread soberano que remunera o risco de operar no Brasil.">
              <PctInput value={v.riscoPais} onChange={(x) => set({ riscoPais: x })} />
            </Campo>
            <Campo label="Risco específico" ajuda="Prêmio por porte, liquidez e dependência de sócios, típico de PMEs.">
              <PctInput value={v.riscoEspecifico} onChange={(x) => set({ riscoEspecifico: x })} />
            </Campo>
            <Campo label="Spread da dívida sobre CDI" ajuda="Custo da dívida = CDI + spread, líquido de IR quando há benefício fiscal.">
              <PctInput value={v.spreadDivida} onChange={(x) => set({ spreadDivida: x })} />
            </Campo>
            <Campo label="% capital próprio (alvo)" ajuda="Estrutura de capital alvo usada na ponderação do WACC.">
              <PctInput value={v.pesoEquity} onChange={(x) => set({ pesoEquity: x })} />
            </Campo>
            <Campo label="g na perpetuidade" ajuda="Crescimento nominal de longo prazo; deve ser menor que o WACC.">
              <PctInput value={v.gPerp} onChange={(x) => set({ gPerp: x })} />
            </Campo>
            <Campo label="Observação / fonte" className="sm:col-span-2">
              <Textarea
                className="min-h-[60px] text-sm"
                value={v.obs}
                onChange={(e) => set({ obs: e.target.value })}
              />
            </Campo>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Kpi titulo="Ke (custo do equity)" valor={fmtPct(dcf.ke)} />
            <Kpi titulo="Kd líquido" valor={fmtPct(dcf.kdLiquido)} />
            <Kpi titulo="WACC" valor={fmtPct(dcf.wacc)} destaque />
            <Kpi titulo="EV/EBITDA implícito" valor={fmtMult(dcf.evEbitda)} />
            <Kpi titulo="VP do período explícito" valor={fmtMoney(dcf.somaVp, moeda)} />
            <Kpi titulo="VP do valor terminal" valor={fmtMoney(dcf.vpTerminal, moeda)} />
            <Kpi titulo="Enterprise Value" valor={fmtMoney(dcf.enterpriseValue, moeda)} destaque />
            <Kpi titulo="Equity Value" valor={fmtMoney(dcf.equityValue, moeda)} destaque />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Fluxo de caixa livre para a firma (FCFF)</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Linha</TableHead>
                    {dcf.anos.map((a) => (
                      <TableHead key={a.rotulo} className="text-right">
                        {a.rotulo}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["NOPAT", (a: (typeof dcf.anos)[number]) => a.nopat],
                    ["(+) D&A", (a: (typeof dcf.anos)[number]) => a.da],
                    ["(-) CAPEX", (a: (typeof dcf.anos)[number]) => -a.capex],
                    ["(-) Δ Capital de giro", (a: (typeof dcf.anos)[number]) => -a.varNcg],
                    ["FCFF", (a: (typeof dcf.anos)[number]) => a.fcff],
                    ["Valor presente", (a: (typeof dcf.anos)[number]) => a.vp],
                  ].map(([label, fn], i) => (
                    <TableRow key={String(label)} className={i >= 4 ? "font-semibold" : ""}>
                      <TableCell>{label as string}</TableCell>
                      {dcf.anos.map((a) => (
                        <TableCell key={a.rotulo} className="text-right tabular-nums">
                          {fmtMoney((fn as (x: typeof a) => number)(a), moeda)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-3 text-xs text-muted-foreground">
                Valor terminal (Gordon): {fmtMoney(dcf.valorTerminal, moeda)} — FCFF do último ano ×
                (1 + g) ÷ (WACC − g).
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Sensibilidade do Enterprise Value — WACC × g
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>WACC \ g</TableHead>
                    {grade.gs.map((g) => (
                      <TableHead key={g} className="text-right">
                        {fmtPct(g)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grade.waccs.map((w, i) => (
                    <TableRow key={w}>
                      <TableCell className="font-medium">{fmtPct(w)}</TableCell>
                      {grade.ev[i].map((ev, j) => {
                        const centro = i === 2 && j === 2;
                        return (
                          <TableCell
                            key={j}
                            className={`text-right tabular-nums ${centro ? "bg-primary/10 font-semibold" : ""}`}
                          >
                            {isFinite(ev) ? fmtMoney(ev, moeda) : "—"}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function Kpi({ titulo, valor, destaque }: { titulo: string; valor: string; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-primary/40 bg-primary/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{valor}</div>
    </div>
  );
}
