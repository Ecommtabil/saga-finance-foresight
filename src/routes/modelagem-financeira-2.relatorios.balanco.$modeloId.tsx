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

export const Route = createFileRoute("/modelagem-financeira-2/relatorios/balanco/$modeloId")({
  head: () => ({
    meta: [
      { title: "Balanço Patrimonial projetado — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Ativo, passivo e patrimônio líquido projetados mês a mês e por ano, com conferência automática de fechamento.",
      },
      { property: "og:title", content: "Balanço Patrimonial projetado — SAGA" },
      {
        property: "og:description",
        content: "Saldos de dezembro por ano ou saldos mensais dos 60 meses, com badge de balanceamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BalancoPage,
});

function BalancoPage() {
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

  const pior = projecao.meses.reduce(
    (a: LinhaMes | null, m) =>
      !a || Math.abs(m.balanceCheck) > Math.abs(a.balanceCheck) ? m : a,
    null,
  );
  const fecha = !pior || Math.abs(pior.balanceCheck) < 0.5;

  const linhas: LinhaRel[] = [
    { rotulo: "ATIVO CIRCULANTE", tipo: "saldo", valor: (l) => l.ativoCirculante, estilo: "grupo" },
    { rotulo: "Caixa e equivalentes", tipo: "saldo", valor: (l) => l.caixaFinal, indent: 1 },
    { rotulo: "Contas a receber", tipo: "saldo", valor: (l) => l.contasReceber, indent: 1 },
    { rotulo: "Estoques", tipo: "saldo", valor: (l) => l.estoques, indent: 1 },
    { rotulo: "Tributos a recuperar", tipo: "saldo", valor: (l) => l.tributosRecuperar, indent: 1 },
    {
      rotulo: "Adiantamento a fornecedores",
      tipo: "saldo",
      valor: (l) => l.adiantFornecedores,
      indent: 1,
    },
    {
      rotulo: "ATIVO NÃO CIRCULANTE",
      tipo: "saldo",
      valor: (l) => l.ativoNaoCirculante,
      estilo: "grupo",
    },
    { rotulo: "Imobilizado líquido", tipo: "saldo", valor: (l) => l.imobilizadoLiquido, indent: 1 },
    { rotulo: "Intangível líquido", tipo: "saldo", valor: (l) => l.intangivelLiquido, indent: 1 },
    { rotulo: "Investimentos", tipo: "saldo", valor: (l) => l.investimentos, indent: 1 },
    { rotulo: "TOTAL DO ATIVO", tipo: "saldo", valor: (l) => l.ativoTotal, estilo: "total" },
    {
      rotulo: "PASSIVO CIRCULANTE",
      tipo: "saldo",
      valor: (l) => l.passivoCirculante,
      estilo: "grupo",
    },
    { rotulo: "Dívidas de curto prazo", tipo: "saldo", valor: (l) => l.dividaCurtoPrazo, indent: 1 },
    { rotulo: "Crédito revolvente", tipo: "saldo", valor: (l) => l.saldoRevolvente, indent: 1 },
    { rotulo: "Contas a pagar", tipo: "saldo", valor: (l) => l.contasPagar, indent: 1 },
    {
      rotulo: "Obrigações tributárias",
      tipo: "saldo",
      valor: (l) => l.obrigacoesTributarias,
      indent: 1,
    },
    {
      rotulo: "Obrigações trabalhistas",
      tipo: "saldo",
      valor: (l) => l.obrigacoesTrabalhistas,
      indent: 1,
    },
    {
      rotulo: "Adiantamento de clientes",
      tipo: "saldo",
      valor: (l) => l.adiantClientes,
      indent: 1,
    },
    {
      rotulo: "PASSIVO NÃO CIRCULANTE",
      tipo: "saldo",
      valor: (l) => l.passivoNaoCirculante,
      estilo: "grupo",
    },
    { rotulo: "Dívidas de longo prazo", tipo: "saldo", valor: (l) => l.dividaLongoPrazo, indent: 1 },
    {
      rotulo: "PATRIMÔNIO LÍQUIDO",
      tipo: "saldo",
      valor: (l) => l.patrimonioLiquido,
      estilo: "grupo",
    },
    { rotulo: "Capital social", tipo: "saldo", valor: (l) => l.capitalSocial, indent: 1 },
    {
      rotulo: "Reservas / lucros acumulados",
      tipo: "saldo",
      valor: (l) => l.lucrosAcumulados,
      indent: 1,
    },
    { rotulo: "Lucro do período", tipo: "soma", valor: (l) => l.lucroLiquido, indent: 1 },
    {
      rotulo: "TOTAL DO PASSIVO + PL",
      tipo: "saldo",
      valor: (l) => l.passivoTotal,
      estilo: "total",
    },
    { rotulo: "Conferência (Ativo - Passivo)", tipo: "saldo", valor: (l) => l.balanceCheck, estilo: "sub" },
  ];

  return (
    <>
      <PageHeader
        titulo={`Balanço Patrimonial — ${modelo.nomeEmpresa}`}
        subtitulo="Saldos mensais (60 meses) ou saldos de dezembro de cada ano."
      />
      <NavRelatorios modeloId={modeloId} atual="balanco" />
      <RelatorioFinanceiro
        meses={projecao.meses}
        linhas={linhas}
        moeda={modelo.unidadeMonetaria === "BRL" ? "R$" : modelo.unidadeMonetaria}
        conferencia={
          fecha ? (
            <Badge className="gap-1.5" variant="secondary">
              <CheckCircle2 className="h-3.5 w-3.5" /> Balanceado em todos os 60 meses
            </Badge>
          ) : (
            <Badge className="gap-1.5" variant="destructive">
              <AlertTriangle className="h-3.5 w-3.5" /> Erro de {fmtNum(pior?.balanceCheck, 2)} em{" "}
              {pior?.rotulo}
            </Badge>
          )
        }
      />
    </>
  );
}
