import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { BookOpen, Layers, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSaga } from "@/lib/saga/context";
import type { Modo } from "@/lib/saga/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAGA — Início" },
      { name: "description", content: "Escolha o modo de análise: Contabilidade Completa ou Dados Básicos." },
      { property: "og:title", content: "SAGA — Início" },
      { property: "og:description", content: "Comece pela seleção do modo de análise." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { modo, setModo, empresa } = useSaga();
  const navigate = useNavigate();

  const selecionar = (m: Modo) => {
    setModo(m);
    navigate({ to: "/upload" });
  };

  if (!empresa?.nome) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <Building2 className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Comece pelo cadastro da empresa</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Antes de escolher o modo de análise, informe os dados de identificação da empresa.
        </p>
        <Button asChild className="mt-6">
          <Link to="/empresa">Cadastrar empresa</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">{empresa.nome}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha o nível de profundidade dos dados da empresa que será analisada.
        </p>
        {modo && (
          <p className="mt-3 text-xs uppercase tracking-wide text-accent-foreground">
            Modo atual: <strong>{modo === "completa" ? "Contabilidade Completa" : "Dados Básicos"}</strong>
          </p>
        )}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="border-2 transition hover:border-primary">
          <CardHeader>
            <BookOpen className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">Contabilidade Completa</CardTitle>
            <CardDescription>
              Você possui DRE e Balanço Patrimonial detalhados. Habilita todos os módulos:
              indicadores de liquidez, endividamento, eficiência e ciclo de caixa.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => selecionar("completa")}>
              Selecionar modo completo
            </Button>
          </CardContent>
        </Card>
        <Card className="border-2 transition hover:border-primary">
          <CardHeader>
            <Layers className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">Dados Básicos</CardTitle>
            <CardDescription>
              Você tem apenas receita, custos e poucos dados de balanço. Os módulos que exigem
              Balanço completo ficam ocultos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => selecionar("basica")}>
              Selecionar modo básico
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}