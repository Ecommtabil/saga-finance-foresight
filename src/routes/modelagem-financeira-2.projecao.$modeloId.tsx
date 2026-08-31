import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { PctInput } from "@/components/simpl/fields";
import { useMF2 } from "@/lib/mf2/store";
import { projetarModelo, type LinhaMes } from "@/lib/mf2/engine";
import { fmtNum } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-financeira-2/projecao/$modeloId")({
  head: () => ({
    meta: [
      { title: "Projeção mensal 60 meses — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "DRE, balanço patrimonial e fluxo de caixa mensais projetados para 5 anos com conferências automáticas.",
      },
      { property: "og:title", content: "Projeção mensal de 60 meses — SAGA" },
      {
        property: "og:description",
        content: "Motor de cálculo integrado: DRE, BP e DFC mensais com balance check e prova real.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjecaoPage,
});

type Linhas = { rotulo: string; campo: (l: LinhaMes) => number; forte?: boolean }[];

function TabelaMensal({ meses, linhas }: { meses: LinhaMes[]; linhas: Linhas }) {
  return (
    <div className="overflow-x-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[220px] bg-card">Linha</TableHead>
            {meses.map((m) => (
              <TableHead key={m.indice} className="min-w-[92px] text-right">
                {m.rotulo}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {linhas.map((ln) => (
            <TableRow key={ln.rotulo}>
              <TableCell
                className={`sticky left-0 z-10 bg-card ${ln.forte ? "font-semibold" : ""}`}
              >
                {ln.rotulo}
              </TableCell>
              {meses.map((m) => (
                <TableCell
                  key={m.indice}
                  className={`text-right tabular-nums ${ln.forte ? "font-semibold" : ""}`}
                >
                  {fmtNum(ln.campo(m), 0)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ProjecaoPage() {
  const { modeloId } = Route.useParams();
  const { obterModelo, atualizarModelo, pronto } = useMF2();
  const modelo = obterModelo(modeloId);
  const [ano, setAno] = useState("1");

  const projecao = useMemo(() => (modelo ? projetarModelo(modelo) : null), [modelo]);

  if (!pronto) return null;
  if (!modelo || !projecao) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Modelo não encontrado.{" "}
          <Link className="underline" to="/modelagem-financeira-2">
            Voltar aos modelos
          </Link>
        </CardContent>
      </Card>
    );
  }

  const mesesAno = projecao.meses.filter((m) => m.ano === Number(ano));
  const anuais = projecao.anuais;

  const dre: Linhas = [
    { rotulo: "Receita bruta", campo: (l) => l.receitaBruta, forte: true },
    { rotulo: "(-) Deduções", campo: (l) => l.deducoes },
    { rotulo: "Receita líquida", campo: (l) => l.receitaLiquida, forte: true },
    { rotulo: "(-) Pessoal (custo)", campo: (l) => -l.custoPessoal },
    { rotulo: "(-) Custos variáveis", campo: (l) => -l.custosVariaveis },
    { rotulo: "(-) Custos fixos", campo: (l) => -l.custosFixos },
    { rotulo: "Lucro bruto", campo: (l) => l.lucroBruto, forte: true },
    { rotulo: "(-) Pessoal (despesa)", campo: (l) => -l.despesaPessoal },
    { rotulo: "(-) SG&A fixas", campo: (l) => -l.despesasFixasSga },
    { rotulo: "(-) SG&A variáveis", campo: (l) => -l.despesasVariaveisSga },
    { rotulo: "(-) Depreciação e amortização", campo: (l) => -l.depreciacao },
    { rotulo: "EBIT", campo: (l) => l.ebit, forte: true },
    { rotulo: "EBITDA", campo: (l) => l.ebitda, forte: true },
    { rotulo: "Receitas financeiras", campo: (l) => l.receitasFinanceiras },
    { rotulo: "Despesas financeiras", campo: (l) => -l.despesasFinanceiras },
    { rotulo: "Lucro antes de IRPJ/CSLL", campo: (l) => l.lucroAntesImpostos, forte: true },
    { rotulo: "(-) IRPJ/CSLL", campo: (l) => -l.irpjCsll },
    { rotulo: "Lucro líquido", campo: (l) => l.lucroLiquido, forte: true },
  ];

  const bp: Linhas = [
    { rotulo: "Caixa", campo: (l) => l.caixaFinal },
    { rotulo: "Contas a receber", campo: (l) => l.contasReceber },
    { rotulo: "Estoques", campo: (l) => l.estoques },
    { rotulo: "Tributos a recuperar", campo: (l) => l.tributosRecuperar },
    { rotulo: "Adiant. a fornecedores", campo: (l) => l.adiantFornecedores },
    { rotulo: "Ativo circulante", campo: (l) => l.ativoCirculante, forte: true },
    { rotulo: "Imobilizado líquido", campo: (l) => l.imobilizadoLiquido },
    { rotulo: "Intangível líquido", campo: (l) => l.intangivelLiquido },
    { rotulo: "Investimentos", campo: (l) => l.investimentos },
    { rotulo: "Ativo total", campo: (l) => l.ativoTotal, forte: true },
    { rotulo: "Dívidas curto prazo", campo: (l) => l.dividaCurtoPrazo },
    { rotulo: "Revolvente", campo: (l) => l.saldoRevolvente },
    { rotulo: "Contas a pagar", campo: (l) => l.contasPagar },
    { rotulo: "Obrigações tributárias", campo: (l) => l.obrigacoesTributarias },
    { rotulo: "Obrigações trabalhistas", campo: (l) => l.obrigacoesTrabalhistas },
    { rotulo: "Adiant. de clientes", campo: (l) => l.adiantClientes },
    { rotulo: "Passivo circulante", campo: (l) => l.passivoCirculante, forte: true },
    { rotulo: "Dívidas longo prazo", campo: (l) => l.dividaLongoPrazo },
    { rotulo: "Capital social", campo: (l) => l.capitalSocial },
    { rotulo: "Lucros acumulados", campo: (l) => l.lucrosAcumulados },
    { rotulo: "Patrimônio líquido", campo: (l) => l.patrimonioLiquido, forte: true },
    { rotulo: "Passivo + PL", campo: (l) => l.passivoTotal, forte: true },
    { rotulo: "Balance check", campo: (l) => l.balanceCheck },
  ];

  const dfc: Linhas = [
    { rotulo: "Caixa inicial", campo: (l) => l.caixaInicial },
    { rotulo: "Fluxo operacional", campo: (l) => l.fluxoOperacional, forte: true },
    { rotulo: "Fluxo de investimento", campo: (l) => l.fluxoInvestimento, forte: true },
    { rotulo: "Fluxo de financiamento", campo: (l) => l.fluxoFinanciamento, forte: true },
    { rotulo: "Captações", campo: (l) => l.captacoes },
    { rotulo: "Amortizações", campo: (l) => -l.amortizacoes },
    { rotulo: "Variação revolvente", campo: (l) => l.variacaoRevolvente },
    { rotulo: "Aportes de capital", campo: (l) => l.aportes },
    { rotulo: "Dividendos", campo: (l) => -l.dividendos },
    { rotulo: "Caixa final", campo: (l) => l.caixaFinal, forte: true },
  ];

  return (
    <>
      <PageHeader
        titulo={`Projeção mensal — ${modelo.nomeEmpresa}`}
        subtitulo="60 meses (5 anos) calculados a partir das premissas do modelo."
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/modelagem-financeira-2/$modeloId" params={{ modeloId }}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Premissas
            </Link>
          </Button>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-6 py-4">
          {projecao.balancoFecha ? (
            <Badge className="gap-1.5" variant="secondary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Balanço fecha e prova real do caixa OK em
              todos os 60 meses
            </Badge>
          ) : (
            <Badge className="gap-1.5" variant="destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> {projecao.alertas.length} mês(es) com
              divergência — ex.: {projecao.alertas[0]?.mes} ({fmtNum(projecao.alertas[0]?.diferenca, 2)})
            </Badge>
          )}
          <div className="flex items-center gap-2 text-xs">
            <span className="font-medium">% dividendos trimestrais</span>
            <PctInput
              className="w-24"
              value={modelo.percentualDividendos ?? 0}
              onChange={(v) => atualizarModelo(modelo.id, { percentualDividendos: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Resumo anual</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Linha</TableHead>
                {anuais.map((a) => (
                  <TableHead key={a.ano} className="text-right">
                    Ano {a.ano}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(
                [
                  ["Receita bruta", (a: (typeof anuais)[0]) => a.receitaBruta],
                  ["Receita líquida", (a: (typeof anuais)[0]) => a.receitaLiquida],
                  ["Lucro bruto", (a: (typeof anuais)[0]) => a.lucroBruto],
                  ["EBITDA", (a: (typeof anuais)[0]) => a.ebitda],
                  ["EBIT", (a: (typeof anuais)[0]) => a.ebit],
                  ["Lucro líquido", (a: (typeof anuais)[0]) => a.lucroLiquido],
                  ["CAPEX", (a: (typeof anuais)[0]) => a.capex],
                  ["Fluxo operacional", (a: (typeof anuais)[0]) => a.fluxoOperacional],
                  ["Caixa final", (a: (typeof anuais)[0]) => a.caixaFinal],
                ] as const
              ).map(([rot, f]) => (
                <TableRow key={rot}>
                  <TableCell className="font-medium">{rot}</TableCell>
                  {anuais.map((a) => (
                    <TableCell key={a.ano} className="text-right tabular-nums">
                      {fmtNum(f(a), 0)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Ano exibido nas tabelas mensais:</span>
        {[1, 2, 3, 4, 5].map((a) => (
          <Button
            key={a}
            size="sm"
            variant={String(a) === ano ? "default" : "outline"}
            onClick={() => setAno(String(a))}
          >
            Ano {a}
          </Button>
        ))}
      </div>

      <Tabs defaultValue="dre">
        <TabsList>
          <TabsTrigger value="dre">DRE mensal</TabsTrigger>
          <TabsTrigger value="bp">Balanço</TabsTrigger>
          <TabsTrigger value="dfc">Fluxo de caixa</TabsTrigger>
        </TabsList>
        <TabsContent value="dre">
          <Card>
            <CardContent className="pt-4">
              <TabelaMensal meses={mesesAno} linhas={dre} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="bp">
          <Card>
            <CardContent className="pt-4">
              <TabelaMensal meses={mesesAno} linhas={bp} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="dfc">
          <Card>
            <CardContent className="pt-4">
              <TabelaMensal meses={mesesAno} linhas={dfc} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
