import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { useMF2 } from "@/lib/mf2/store";
import { projetarModelo, type LinhaMes } from "@/lib/mf2/engine";
import { fmtNum } from "@/lib/saga/formatters";
import {
  NavRelatorios,
  RelatorioFinanceiro,
  type LinhaRel,
} from "@/components/mf2/RelatorioFinanceiro";

export const Route = createFileRoute("/modelagem-financeira-2/relatorios/fluxo/$modeloId")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa indireto projetado — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Fluxo operacional, de investimento e de financiamento mês a mês e por ano, com prova real do saldo de caixa.",
      },
      { property: "og:title", content: "Fluxo de Caixa projetado — SAGA" },
      {
        property: "og:description",
        content: "Método indireto: lucro líquido, depreciação, capital de giro, CAPEX, dívidas e dividendos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FluxoPage,
});

function FluxoPage() {
  const { modeloId } = Route.useParams();
  const { obterModelo, pronto } = useMF2();
  const modelo = obterModelo(modeloId);
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

  const varCG = (l: LinhaMes) => l.fluxoOperacional - l.lucroLiquido - l.depreciacao;
  const pior = projecao.meses.reduce(
    (a: LinhaMes | null, m) =>
      !a || Math.abs(m.provaRealCaixa) > Math.abs(a.provaRealCaixa) ? m : a,
    null,
  );
  const bate = !pior || Math.abs(pior.provaRealCaixa) < 0.5;

  const linhas: LinhaRel[] = [
    {
      rotulo: "FLUXO DE CAIXA OPERACIONAL",
      tipo: "soma",
      valor: (l) => l.fluxoOperacional,
      estilo: "total",
    },
    { rotulo: "Lucro líquido", tipo: "soma", valor: (l) => l.lucroLiquido, indent: 1 },
    { rotulo: "(+) Depreciação e amortização", tipo: "soma", valor: (l) => l.depreciacao, indent: 1 },
    { rotulo: "(+/-) Variação do capital de giro", tipo: "soma", valor: varCG, indent: 1 },
    {
      rotulo: "FLUXO DE CAIXA DE INVESTIMENTO",
      tipo: "soma",
      valor: (l) => l.fluxoInvestimento,
      estilo: "total",
    },
    { rotulo: "CAPEX (imobilizado, intangível, investimentos)", tipo: "soma", valor: (l) => -l.capex, indent: 1 },
    {
      rotulo: "FLUXO DE CAIXA DE FINANCIAMENTO",
      tipo: "soma",
      valor: (l) => l.fluxoFinanciamento,
      estilo: "total",
    },
    { rotulo: "Captação de dívidas", tipo: "soma", valor: (l) => l.captacoes, indent: 1 },
    { rotulo: "Amortização de dívidas", tipo: "soma", valor: (l) => -l.amortizacoes, indent: 1 },
    { rotulo: "Variação do revolvente", tipo: "soma", valor: (l) => l.variacaoRevolvente, indent: 1 },
    { rotulo: "Aportes / reduções de capital", tipo: "soma", valor: (l) => l.aportes, indent: 1 },
    { rotulo: "Dividendos", tipo: "soma", valor: (l) => -l.dividendos, indent: 1 },
    {
      rotulo: "Saldo inicial de caixa",
      derivado: (p) => p[0]?.caixaInicial ?? 0,
      estilo: "grupo",
    },
    {
      rotulo: "Variação do período",
      derivado: (p) => (p[p.length - 1]?.caixaFinal ?? 0) - (p[0]?.caixaInicial ?? 0),
      estilo: "grupo",
    },
    { rotulo: "SALDO FINAL DE CAIXA", tipo: "saldo", valor: (l) => l.caixaFinal, estilo: "total" },
    {
      rotulo: "Crescimento % a.a.",
      crescimento: (l) => l.fluxoOperacional,
      estilo: "sub",
      indent: 1,
    },
    {
      rotulo: "Conferência: saldo final vs. caixa do Balanço",
      tipo: "saldo",
      valor: (l) => l.provaRealCaixa,
      estilo: "sub",
    },
  ];

  return (
    <>
      <PageHeader
        titulo={`Fluxo de Caixa — ${modelo.nomeEmpresa}`}
        subtitulo="Método indireto, em visão mensal (60 meses) ou anual (5 anos)."
      />
      <NavRelatorios modeloId={modeloId} atual="fluxo" />
      <RelatorioFinanceiro
        meses={projecao.meses}
        linhas={linhas}
        moeda={modelo.unidadeMonetaria === "BRL" ? "R$" : modelo.unidadeMonetaria}
        conferencia={
          bate ? (
            <Badge className="gap-1.5" variant="secondary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Saldo final igual ao caixa do Balanço
            </Badge>
          ) : (
            <Badge className="gap-1.5" variant="destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Divergência de{" "}
              {fmtNum(pior?.provaRealCaixa, 2)} em {pior?.rotulo}
            </Badge>
          )
        }
      />
    </>
  );
}
