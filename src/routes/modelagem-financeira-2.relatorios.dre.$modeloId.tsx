import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { useMF2 } from "@/lib/mf2/store";
import { projetarModelo, type LinhaMes } from "@/lib/mf2/engine";
import { safeDiv } from "@/lib/saga/formatters";
import {
  NavRelatorios,
  RelatorioFinanceiro,
  type LinhaRel,
} from "@/components/mf2/RelatorioFinanceiro";

export const Route = createFileRoute("/modelagem-financeira-2/relatorios/dre/$modeloId")({
  head: () => ({
    meta: [
      { title: "DRE projetada 5 anos — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Demonstração do resultado mensal e anual: receita bruta, deduções, custos, EBITDA, EBIT e lucro líquido com margens.",
      },
      { property: "og:title", content: "DRE projetada — SAGA" },
      {
        property: "og:description",
        content: "Tabela financeira tradicional com visão mensal de 60 meses ou anual de 5 anos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DrePage,
});

function DrePage() {
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

  const t = modelo.tributacao;
  const regime = modelo.regimeTributario;
  const simples = regime === "Simples Nacional";
  const soma = (p: LinhaMes[], f: (m: LinhaMes) => number) => p.reduce((a, m) => a + f(m), 0);
  const margem = (f: (m: LinhaMes) => number) => (p: LinhaMes[]) =>
    safeDiv(soma(p, f), soma(p, (m) => m.receitaLiquida));

  const linhas: LinhaRel[] = [
    { rotulo: "Receita bruta", tipo: "soma", valor: (l) => l.receitaBruta, estilo: "total" },
    { rotulo: "Crescimento % a.a.", crescimento: (l) => l.receitaBruta, estilo: "sub", indent: 1 },
    { rotulo: "(-) Deduções da receita", tipo: "soma", valor: (l) => l.deducoes, estilo: "grupo" },
    ...(simples
      ? [
          {
            rotulo: "DAS (Simples Nacional)",
            tipo: "soma" as const,
            valor: (l: LinhaMes) => -l.receitaBruta * (t.aliquotaDas || 0),
            indent: 1,
          },
        ]
      : [
          {
            rotulo: "ICMS",
            tipo: "soma" as const,
            valor: (l: LinhaMes) => -l.receitaBruta * (t.aliquotaIcms || 0),
            indent: 1,
          },
          {
            rotulo: "ISS",
            tipo: "soma" as const,
            valor: (l: LinhaMes) => -l.receitaBruta * (t.aliquotaIss || 0),
            indent: 1,
          },
          {
            rotulo: "IPI",
            tipo: "soma" as const,
            valor: (l: LinhaMes) => -l.receitaBruta * (t.aliquotaIpi || 0),
            indent: 1,
          },
          {
            rotulo: "PIS/COFINS",
            tipo: "soma" as const,
            valor: (l: LinhaMes) => -l.receitaBruta * (t.aliquotaPisCofins || 0),
            indent: 1,
          },
        ]),
    ...(regime === "Lucro Real"
      ? [
          {
            rotulo: "(+) Créditos tributários",
            tipo: "soma" as const,
            valor: (l: LinhaMes) =>
              l.receitaBruta * (t.percentualCreditosTributarios || 0),
            indent: 1,
          },
        ]
      : []),
    { rotulo: "Receita líquida", tipo: "soma", valor: (l) => l.receitaLiquida, estilo: "total" },
    {
      rotulo: "(-) Custos das vendas",
      tipo: "soma",
      valor: (l) => -l.custoDasVendas,
      estilo: "grupo",
    },
    { rotulo: "Pessoal (custo)", tipo: "soma", valor: (l) => -l.custoPessoal, indent: 1 },
    { rotulo: "Custos variáveis", tipo: "soma", valor: (l) => -l.custosVariaveis, indent: 1 },
    { rotulo: "Custos fixos", tipo: "soma", valor: (l) => -l.custosFixos, indent: 1 },
    { rotulo: "Lucro bruto", tipo: "soma", valor: (l) => l.lucroBruto, estilo: "total" },
    {
      rotulo: "Margem bruta %",
      derivado: margem((m) => m.lucroBruto),
      pct: true,
      estilo: "sub",
      indent: 1,
    },
    {
      rotulo: "(-) Despesas operacionais",
      tipo: "soma",
      valor: (l) => -l.despesasOperacionais,
      estilo: "grupo",
    },
    { rotulo: "Pessoal (despesa)", tipo: "soma", valor: (l) => -l.despesaPessoal, indent: 1 },
    { rotulo: "Despesas fixas SG&A", tipo: "soma", valor: (l) => -l.despesasFixasSga, indent: 1 },
    {
      rotulo: "Despesas variáveis SG&A",
      tipo: "soma",
      valor: (l) => -l.despesasVariaveisSga,
      indent: 1,
    },
    { rotulo: "Depreciação e amortização", tipo: "soma", valor: (l) => -l.depreciacao, indent: 1 },
    { rotulo: "EBIT", tipo: "soma", valor: (l) => l.ebit, estilo: "total" },
    {
      rotulo: "Margem EBIT %",
      derivado: margem((m) => m.ebit),
      pct: true,
      estilo: "sub",
      indent: 1,
    },
    { rotulo: "(+) Depreciação e amortização", tipo: "soma", valor: (l) => l.depreciacao, indent: 1 },
    { rotulo: "EBITDA", tipo: "soma", valor: (l) => l.ebitda, estilo: "total" },
    {
      rotulo: "Margem EBITDA %",
      derivado: margem((m) => m.ebitda),
      pct: true,
      estilo: "sub",
      indent: 1,
    },
    {
      rotulo: "(+/-) Resultado financeiro",
      tipo: "soma",
      valor: (l) => l.resultadoFinanceiro,
      estilo: "grupo",
    },
    { rotulo: "Receitas financeiras", tipo: "soma", valor: (l) => l.receitasFinanceiras, indent: 1 },
    {
      rotulo: "Despesas financeiras",
      tipo: "soma",
      valor: (l) => -l.despesasFinanceiras,
      indent: 1,
    },
    {
      rotulo: "Lucro antes de IRPJ/CSLL",
      tipo: "soma",
      valor: (l) => l.lucroAntesImpostos,
      estilo: "total",
    },
    { rotulo: "(-) IRPJ/CSLL", tipo: "soma", valor: (l) => -l.irpjCsll, indent: 1 },
    { rotulo: "Lucro líquido", tipo: "soma", valor: (l) => l.lucroLiquido, estilo: "total" },
    {
      rotulo: "Margem líquida %",
      derivado: margem((m) => m.lucroLiquido),
      pct: true,
      estilo: "sub",
      indent: 1,
    },
    { rotulo: "Crescimento % a.a.", crescimento: (l) => l.lucroLiquido, estilo: "sub", indent: 1 },
  ];

  return (
    <>
      <PageHeader
        titulo={`DRE — ${modelo.nomeEmpresa}`}
        subtitulo="Demonstração do resultado projetada, em visão mensal (60 meses) ou anual (5 anos)."
      />
      <NavRelatorios modeloId={modeloId} atual="dre" />
      <RelatorioFinanceiro
        meses={projecao.meses}
        linhas={linhas}
        moeda={modelo.unidadeMonetaria === "BRL" ? "R$" : modelo.unidadeMonetaria}
      />
    </>
  );
}
