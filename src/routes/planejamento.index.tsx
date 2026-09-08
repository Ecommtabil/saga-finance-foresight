import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Calculator, LayoutDashboard, Scale, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePlanejamento } from "@/lib/pob/store";

export const Route = createFileRoute("/planejamento/")({
  head: () => ({
    meta: [
      { title: "Planejamento Orçamentário — Início | SAGA" },
      {
        name: "description",
        content: "Ponto de partida do planejamento orçamentário: escolha um cenário e comece pelas premissas.",
      },
      { property: "og:title", content: "Planejamento Orçamentário — Início | SAGA" },
      { property: "og:description", content: "Escolha um cenário e comece pelas premissas do orçamento." },
    ],
  }),
  component: PlanejamentoInicio,
});

const SECOES = [
  {
    to: "/planejamento/premissas",
    icon: SlidersHorizontal,
    titulo: "Premissas",
    desc: "Vendas, impostos, produção, matéria-prima, mão de obra, custos indiretos, despesas, CAPEX e empréstimos.",
  },
  {
    to: "/planejamento/projecao",
    icon: Scale,
    titulo: "Projeção Orçamentária",
    desc: "Projeção mensal de 12 meses com DRE, fluxo de caixa e balanço patrimonial.",
  },
  {
    to: "/planejamento/variacao",
    icon: BarChart3,
    titulo: "Variação",
    desc: "Orçado x Realizado por volume, preço, custos variáveis e fixos, com gráfico em cascata.",
  },
  {
    to: "/planejamento/custos",
    icon: Calculator,
    titulo: "Custos",
    desc: "Ficha técnica de custo unitário por produto: matéria-prima, mão de obra e CIF rateado.",
  },
  {
    to: "/planejamento/dashboard",
    icon: LayoutDashboard,
    titulo: "Dashboard",
    desc: "Margem bruta, EBITDA, margem líquida, ROE, ROIC e fluxo de caixa mensal.",
  },
];

function PlanejamentoInicio() {
  const { cenario } = usePlanejamento();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Planejamento Orçamentário</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cenário ativo: <strong>{cenario?.nome ?? "—"}</strong> · Exercício {cenario?.ano ?? "—"}. Cada
          cenário guarda seu próprio conjunto de premissas e projeções.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {SECOES.map((s) => (
          <Link key={s.to} to={s.to} className="block">
            <Card className="h-full transition hover:border-primary">
              <CardHeader>
                <s.icon className="h-7 w-7 text-primary" />
                <CardTitle className="mt-2 text-base">{s.titulo}</CardTitle>
                <CardDescription>{s.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Como funciona</CardTitle>
          <CardDescription>
            Comece pelas Premissas. Tudo o que for informado ali alimenta automaticamente a Projeção,
            os relatórios e o Dashboard. A comparação com o realizado acontece na aba Variação.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          As próximas seções serão construídas uma de cada vez.
        </CardContent>
      </Card>
    </div>
  );
}
