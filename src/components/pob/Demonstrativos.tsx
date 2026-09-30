import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportarXlsx, type AbaXlsx } from "@/lib/pob/export-xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ABERTURA_PADRAO, type ParametrosPOB } from "@/lib/pob/parametros";
import { calcularDemonstrativosPOB, type LinhaDem } from "@/lib/pob/projecao";
import { fmtMoney } from "@/lib/saga/formatters";
import { cn } from "@/lib/utils";

type Abertura = typeof ABERTURA_PADRAO;

function Tabela({
  titulo,
  linhas,
  meses,
  moeda,
  total = "soma",
  rodape,
}: {
  titulo: string;
  linhas: LinhaDem[];
  meses: string[];
  moeda: string;
  total?: "soma" | "nenhum";
  rodape?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto overscroll-x-contain scroll-smooth rounded-md border [-webkit-overflow-scrolling:touch]">
          <table className="w-full text-xs tabular-nums">
            <thead className="sticky top-0 bg-muted">
              <tr>
                <th className="sticky left-0 z-10 min-w-[240px] bg-muted p-2 text-left">Conta</th>
                {meses.map((m) => <th key={m} className="min-w-[96px] p-2 text-right">{m}</th>)}
                {total === "soma" && <th className="min-w-[110px] p-2 text-right">Total</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const soma = !/saldo/i.test(l.rotulo);
                return (
                  <tr
                    key={l.rotulo}
                    className={cn(
                      "border-t",
                      l.tipo === "total" && "bg-primary/5 font-semibold",
                      l.tipo === "sub" && "bg-muted/40 font-medium",
                    )}
                  >
                    <td className={cn("sticky left-0 bg-card p-2", l.tipo === "total" && "bg-primary/5", l.tipo === "sub" && "bg-muted/40")}>
                      {l.rotulo}
                    </td>
                    {l.valores.map((v, i) => (
                      <td key={i} className={cn("p-2 text-right", v < -0.004 && "text-destructive")}>{fmtMoney(v, moeda)}</td>
                    ))}
                    {total === "soma" && (
                      <td className="p-2 text-right font-medium">
                        {soma ? fmtMoney(l.valores.reduce((a, b) => a + b, 0), moeda) : "—"}
                      </td>
                    )}
                  </tr>
                );
              })}
              {rodape}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function Demonstrativos({
  parametros,
  meses,
  moeda,
  onAbertura,
  nomeCenario = "Cenario",
}: {
  parametros: ParametrosPOB;
  meses: string[];
  moeda: string;
  nomeCenario?: string;
  onAbertura: (a: Abertura) => void;
}) {
  const d = useMemo(() => calcularDemonstrativosPOB(parametros), [parametros]);
  const ab: Abertura = { ...ABERTURA_PADRAO, ...(parametros.abertura ?? {}) };
  const fechado = d.diferenca.every((x) => Math.abs(x) < 0.01);
  const campos: [keyof Abertura, string, boolean][] = [
    ["caixaInicial", "Saldo inicial de caixa (R$)", true],
    ["capitalSocial", "Capital social (R$)", true],
    ["imobilizadoInicial", "Imobilizado inicial (R$)", true],
    ["aliquotaIR", "Alíquota IR/CSLL (%)", false],
  ];

  const aba = (nome: string, linhas: LinhaDem[], total: boolean): AbaXlsx => ({
    nome,
    linhas: [
      ["Conta", ...meses, ...(total ? ["Total"] : [])],
      ...linhas.map((l) => [
        l.rotulo,
        ...l.valores,
        ...(total ? [/saldo/i.test(l.rotulo) ? null : l.valores.reduce((a, b) => a + b, 0)] : []),
      ]),
    ],
  });
  const exportar = () =>
    exportarXlsx(`Demonstrativos ${nomeCenario}`, [
      aba("DRE", d.dre, true),
      aba("Fluxo de Caixa", d.fluxo, true),
      aba("Balanço", [...d.balancoAtivo, { rotulo: "", valores: [] }, ...d.balancoPassivo], false),
    ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={exportar}>
          <Download className="mr-1.5 h-4 w-4" /> Exportar para Excel
        </Button>
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saldos de abertura</CardTitle>
          <CardDescription>
            Os lucros acumulados de abertura ({fmtMoney(d.lucrosIni, moeda)}) são calculados para fechar o balanço inicial.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-4">
          {campos.map(([k, rot, moedaCampo]) => (
            <div key={k} className="space-y-1">
              <Label className="text-xs">{rot}</Label>
              <Input
                type="number"
                min={0}
                max={moedaCampo ? undefined : 100}
                step="any"
                value={ab[k]}
                onChange={(e) => {
                  let v = Math.max(0, Number(e.target.value) || 0);
                  if (!moedaCampo) v = Math.min(100, v);
                  onAbertura({ ...ab, [k]: v });
                }}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabela titulo="DRE — Demonstração de Resultado" linhas={d.dre} meses={meses} moeda={moeda} />
      <Tabela titulo="Fluxo de Caixa (método direto)" linhas={d.fluxo} meses={meses} moeda={moeda} />

      <div className="flex items-center gap-3">
        <h3 className="text-base font-semibold">Balanço Patrimonial</h3>
        {fechado ? (
          <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Balanço fechado ✓
          </Badge>
        ) : (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3.5 w-3.5" /> Balanço não fecha
          </Badge>
        )}
      </div>
      <Tabela titulo="Ativo" linhas={d.balancoAtivo} meses={meses} moeda={moeda} total="nenhum" />
      <Tabela
        titulo="Passivo e Patrimônio Líquido"
        linhas={d.balancoPassivo}
        meses={meses}
        moeda={moeda}
        total="nenhum"
        rodape={
          <tr className="border-t-2">
            <td className="sticky left-0 bg-card p-2 font-semibold">Conferência (Ativo − Passivo+PL)</td>
            {d.diferenca.map((x, i) => (
              <td key={i} className="p-2 text-right">
                {Math.abs(x) < 0.01 ? (
                  <span className="font-semibold text-emerald-600">✓</span>
                ) : (
                  <span className="font-semibold text-destructive">{fmtMoney(x, moeda)}</span>
                )}
              </td>
            ))}
          </tr>
        }
      />
    </div>
  );
}
