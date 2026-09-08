import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/saga/PageHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMF2 } from "@/lib/mf2/store";
import {
  baixarPlanilhaModeloMF2,
  lerPlanilhaModeloMF2,
  type ResultadoImportacaoMF2,
} from "@/lib/mf2/import";

export const Route = createFileRoute("/modelagem-financeira-2/importar")({
  head: () => ({
    meta: [
      { title: "Importar Dados — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Baixe a planilha modelo, preencha no Excel e importe premissas, produtos, custos e dívidas do modelo financeiro.",
      },
      { property: "og:title", content: "Importar Dados — Modelagem Simplificada 2" },
      {
        property: "og:description",
        content: "Importação de premissas do modelo financeiro por planilha .xlsx.",
      },
    ],
  }),
  component: ImportarMF2,
});

function ImportarMF2() {
  const { modelos, pronto, obterModelo, atualizarModelo, criarModelo } = useMF2();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [modeloId, setModeloId] = useState<string>("__novo__");
  const [resultado, setResultado] = useState<ResultadoImportacaoMF2 | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const modeloAtual = modeloId === "__novo__" ? null : obterModelo(modeloId);

  async function onArquivo(file: File | undefined) {
    if (!file) return;
    setCarregando(true);
    setErro(null);
    setResultado(null);
    try {
      const res = await lerPlanilhaModeloMF2(file);
      let alvoId = modeloId;
      if (modeloId === "__novo__") {
        const novo = criarModelo({
          nomeEmpresa: res.patch.nomeEmpresa || "Modelo importado",
          unidadeMonetaria: res.patch.unidadeMonetaria ?? "BRL",
          regimeTributario: res.patch.regimeTributario ?? "Simples Nacional",
          tipoNegocio: res.patch.tipoNegocio ?? "Serviços",
          dataInicioModelo: res.patch.dataInicioModelo ?? new Date().toISOString().slice(0, 10),
        });
        alvoId = novo.id;
        setModeloId(novo.id);
      }
      atualizarModelo(alvoId, res.patch);
      setResultado(res);
      toast.success("Planilha importada com sucesso.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setCarregando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <PageHeader
        titulo="Importar dados por planilha"
        subtitulo="Baixe o modelo, preencha no Excel e faça o upload. As abas preenchidas substituem os dados do modelo escolhido."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Escolha o destino</CardTitle>
            <CardDescription>
              Importe para um modelo existente ou crie um novo a partir da planilha.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Select value={modeloId} onValueChange={setModeloId} disabled={!pronto}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__novo__">Criar novo modelo a partir da planilha</SelectItem>
                  {modelos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nomeEmpresa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              className="w-full"
              onClick={() => baixarPlanilhaModeloMF2(modeloAtual)}
            >
              <Download className="mr-1.5 h-4 w-4" />
              Baixar planilha modelo
              {modeloAtual ? " (com dados atuais)" : ""}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Envie a planilha preenchida</CardTitle>
            <CardDescription>Arquivo .xlsx gerado a partir do modelo do SAGA.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void onArquivo(e.target.files?.[0])}
            />
            <Button
              className="w-full"
              disabled={carregando}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="mr-1.5 h-4 w-4" />
              {carregando ? "Lendo arquivo..." : "Selecionar arquivo .xlsx"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Abas reconhecidas: Geral, Macro, Produtos, Sazonalidade, Pessoal, CustosVar%,
              CustosVarUnit, CustosFixos, DespesasFixas, DespesasVar%, Tributacao, CapitalGiro,
              Ativos e Dividas.
            </p>
          </CardContent>
        </Card>
      </div>

      {erro && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro na importação</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {resultado && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Resumo da importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-muted-foreground">Aba</th>
                    <th className="px-4 py-2 text-right font-semibold text-muted-foreground">
                      Itens
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.resumo.map((r) => (
                    <tr key={r.aba} className="border-t">
                      <td className="px-4 py-2">{r.aba}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.itens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {resultado.avisos.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Avisos</AlertTitle>
                <AlertDescription>
                  <ul className="list-disc space-y-1 pl-4">
                    {resultado.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex flex-wrap gap-2">
              {modeloId !== "__novo__" && (
                <>
                  <Button
                    size="sm"
                    onClick={() =>
                      void navigate({
                        to: "/modelagem-financeira-2/$modeloId",
                        params: { modeloId },
                      })
                    }
                  >
                    Abrir premissas
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link
                      to="/modelagem-financeira-2/projecao/$modeloId"
                      params={{ modeloId }}
                    >
                      Ver projeção
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
