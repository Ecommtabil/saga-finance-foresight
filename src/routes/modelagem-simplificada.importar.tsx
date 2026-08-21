import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Upload as UploadIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useSimpl } from "@/lib/simpl/store";
import {
  baixarModeloSimpl,
  lerModeloSimpl,
  ImportSimplError,
  type ResultadoImportacaoSimpl,
} from "@/lib/simpl/import";

export const Route = createFileRoute("/modelagem-simplificada/importar")({
  head: () => ({
    meta: [
      { title: "Importar Planilha — Modelagem Simplificada | SAGA" },
      {
        name: "description",
        content:
          "Baixe a planilha modelo e importe receitas, pessoal, OPEX, CAPEX, funding, balanço e premissas para o modelo do cliente.",
      },
      { property: "og:title", content: "Importar Planilha — Modelagem Simplificada" },
      {
        property: "og:description",
        content: "Preenchimento automático do modelo financeiro a partir de um arquivo .xlsx.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ImportarSimplPage,
});

function ImportarSimplPage() {
  const { empresa, cenario, atualizarEmpresa, atualizarCenario } = useSimpl();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [res, setRes] = useState<ResultadoImportacaoSimpl | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file?: File) => {
    if (!file || !empresa || !cenario) return;
    setErro(null);
    setRes(null);
    setCarregando(true);
    try {
      const r = await lerModeloSimpl(file);
      atualizarCenario(r.cenario);
      atualizarEmpresa(r.empresa);
      setRes(r);
    } catch (e) {
      setErro(
        e instanceof ImportSimplError
          ? e.message
          : `Erro ao ler a planilha: ${(e as Error).message}`,
      );
    } finally {
      setCarregando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Importar planilha modelo</h1>
        <p className="text-sm text-muted-foreground">
          Os dados preenchem o cenário{" "}
          <span className="font-medium text-foreground">{cenario?.nome ?? "—"}</span> da empresa{" "}
          <span className="font-medium text-foreground">{empresa?.nome ?? "—"}</span>. O arquivo é
          lido no navegador.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Download className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">1. Baixar modelo .xlsx</CardTitle>
            <CardDescription>
              Abas: Premissas, Receitas, Pessoal, OPEX, CAPEX, Funding, Balanco e Valuation — já
              preenchidas com o cenário atual.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => baixarModeloSimpl(cenario, empresa)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" /> Baixar planilha modelo
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <UploadIcon className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">2. Enviar planilha preenchida</CardTitle>
            <CardDescription>
              Substitui produtos, cargos, OPEX, CAPEX, funding, capital de giro e premissas do
              cenário ativo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              hidden
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={carregando || !empresa}
              onClick={() => inputRef.current?.click()}
            >
              {carregando ? "Lendo planilha…" : "Fazer upload"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {erro && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Falha na importação</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {res && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>Dados aplicados ao cenário</CardTitle>
            </div>
            <CardDescription>
              Projeções, demonstrativos e valuation já foram recalculados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {res.resumo.map((r) => (
                <Badge key={r.aba} variant="secondary">
                  {r.aba}: {r.itens} {r.itens === 1 ? "registro" : "registros"}
                </Badge>
              ))}
            </div>

            {res.avisos.length > 0 && (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-sm">Avisos</AlertTitle>
                <AlertDescription>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
                    {res.avisos.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/modelagem-simplificada/demonstrativos">Ver demonstrativos</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/modelagem-simplificada/receitas">Conferir receitas</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/modelagem-simplificada/valuation">Ver valuation</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
