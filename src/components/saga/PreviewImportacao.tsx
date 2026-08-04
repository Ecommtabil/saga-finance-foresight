import { FinancialTable, type FinRow } from "@/components/saga/FinancialTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/saga/formatters";
import type { DadosImportados, Premissas } from "@/lib/saga/types";

const PREMISSAS_LABELS: { k: keyof Premissas; label: string; pct?: boolean }[] = [
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
  { k: "crescimentoProj", label: "Crescimento Projetado", pct: true },
  { k: "crescimentoPerp", label: "Crescimento Perpetuidade (g)", pct: true },
];

export function PreviewImportacao({
  dados,
  moeda = "R$",
}: {
  dados: DadosImportados;
  moeda?: string;
}) {
  const { anos, dre, balanco, premissas } = dados;

  const dreRows: FinRow[] = [
    { label: "Receita Bruta", values: dre.receitaBruta },
    { label: "Deduções", values: dre.deducoes, indent: true },
    { label: "Receita Líquida", values: dre.receitaLiquida, bold: true },
    { label: "CMV", values: dre.cmv, indent: true },
    { label: "Lucro Bruto", values: dre.lucroBruto, bold: true },
    { label: "Despesas Operacionais", values: dre.despOperacionais, indent: true },
    { label: "EBITDA", values: dre.ebitda, bold: true },
    { label: "Depreciação", values: dre.depreciacao, indent: true },
    { label: "EBIT", values: dre.ebit, bold: true },
    { label: "Resultado Financeiro", values: dre.resultadoFinanceiro, indent: true },
    { label: "LAIR", values: dre.lair },
    { label: "Impostos", values: dre.impostos, indent: true },
    { label: "Lucro Líquido", values: dre.lucroLiquido, bold: true },
  ];

  const balancoRows: FinRow[] = balanco
    ? dados.modo === "completa"
      ? [
          { label: "Caixa e Equivalentes", values: balanco.caixa, indent: true },
          { label: "Contas a Receber", values: balanco.contasReceber, indent: true },
          { label: "Estoques", values: balanco.estoques, indent: true },
          { label: "Ativo Circulante", values: balanco.ativoCirculante, bold: true },
          { label: "Ativo Não Circulante", values: balanco.ativoNaoCirculante },
          { label: "Ativo Total", values: balanco.ativoTotal, bold: true },
          { label: "Passivo Circulante", values: balanco.passivoCirculante },
          { label: "Passivo Não Circulante", values: balanco.passivoNaoCirculante },
          { label: "Patrimônio Líquido", values: balanco.patrimonioLiquido },
          { label: "Passivo + PL Total", values: balanco.passivoTotal, bold: true },
        ]
      : [
          { label: "Caixa e Equivalentes", values: balanco.caixa },
          {
            label: "Dívida Total",
            values: balanco.emprestimosCP.map((c, i) => c + balanco.emprestimosLP[i]),
          },
          { label: "Patrimônio Líquido", values: balanco.patrimonioLiquido },
          { label: "Ativo Total", values: balanco.ativoTotal, bold: true },
        ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prévia dos dados importados</CardTitle>
        <CardDescription>
          Confira as principais tabelas antes de seguir para os Índices Econômicos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="premissas">
          <TabsList>
            <TabsTrigger value="premissas">Premissas</TabsTrigger>
            <TabsTrigger value="dre">DRE</TabsTrigger>
            <TabsTrigger value="balanco">
              {dados.modo === "completa" ? "Balanço" : "Resumo Patrimonial"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="premissas" className="mt-4">
            <div className="overflow-x-auto rounded-lg border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">
                      Premissa
                    </th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PREMISSAS_LABELS.map((c, i) => (
                    <tr key={c.k} className={i % 2 === 1 ? "border-t bg-muted/10" : "border-t"}>
                      <td className="px-4 py-2">{c.label}</td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {c.pct
                          ? fmtPct(premissas[c.k])
                          : c.k === "dividaTotal" || c.k === "equityMercado"
                            ? fmtMoney(premissas[c.k], moeda)
                            : fmtNum(premissas[c.k], 2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="dre" className="mt-4">
            <FinancialTable anos={anos} rows={dreRows} moeda={moeda} />
          </TabsContent>

          <TabsContent value="balanco" className="mt-4">
            {balanco ? (
              <FinancialTable anos={anos} rows={balancoRows} moeda={moeda} />
            ) : (
              <p className="text-sm text-muted-foreground">
                Nenhum dado patrimonial disponível neste modo.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}