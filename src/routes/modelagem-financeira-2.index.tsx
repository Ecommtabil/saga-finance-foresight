import { createFileRoute, Link } from "@tanstack/react-router";
import { Copy, FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { useMF2 } from "@/lib/mf2/store";

export const Route = createFileRoute("/modelagem-financeira-2/")({
  head: () => ({
    meta: [
      { title: "Meus Modelos — Modelagem Financeira 2" },
      {
        name: "description",
        content: "Lista de modelos financeiros cadastrados, com regime tributário e período base.",
      },
      { property: "og:title", content: "Meus Modelos — Modelagem Financeira 2" },
      { property: "og:description", content: "Gerencie seus modelos financeiros de 5 anos." },
    ],
  }),
  component: DashboardMF2,
});

function DashboardMF2() {
  const { modelos, pronto, duplicarModelo, removerModelo } = useMF2();

  return (
    <>
      <PageHeader
        titulo="Modelagem Financeira 2"
        subtitulo="Seus modelos de projeção de 5 anos. Cada modelo guarda premissas, produtos, custos, tributação e funding."
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/modelagem-financeira-2/importar">
                <Upload className="mr-1.5 h-4 w-4" /> Importar planilha
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/modelagem-financeira-2/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Novo Modelo
              </Link>
            </Button>
          </div>
        }

      />

      {!pronto ? null : modelos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhum modelo criado ainda</p>
              <p className="text-sm text-muted-foreground">
                Crie um modelo para começar a definir as premissas da projeção.
              </p>
            </div>
            <Button asChild size="sm">
              <Link to="/modelagem-financeira-2/novo">
                <Plus className="mr-1.5 h-4 w-4" /> Novo Modelo
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {modelos.map((m) => (
            <Card key={m.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-start justify-between gap-2 text-base">
                  <span className="truncate">{m.nomeEmpresa}</span>
                  <Badge variant="secondary">{m.unidadeMonetaria}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="space-y-1 text-muted-foreground">
                  <div>
                    Regime: <span className="text-foreground">{m.regimeTributario}</span>
                  </div>
                  <div>
                    Negócio: <span className="text-foreground">{m.tipoNegocio}</span>
                  </div>
                  <div>
                    Início:{" "}
                    <span className="text-foreground">
                      {new Date(m.dataInicioModelo).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="text-xs">
                    {m.produtos.length} produto(s) · {m.cargos.length} cargo(s) ·{" "}
                    {m.dividas.length} dívida(s)
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link to="/modelagem-financeira-2/$modeloId" params={{ modeloId: m.id }}>
                      Abrir premissas
                    </Link>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link
                      to="/modelagem-financeira-2/relatorios/dre/$modeloId"
                      params={{ modeloId: m.id }}
                    >
                      Relatórios
                    </Link>
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => duplicarModelo(m.id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removerModelo(m.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
