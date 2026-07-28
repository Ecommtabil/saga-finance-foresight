import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Download, Upload as UploadIcon, RefreshCw, CheckCircle2, AlertCircle, FileDown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/saga/PageHeader";
import { useSaga } from "@/lib/saga/context";
import { baixarPlanilhaModelo } from "@/lib/saga/template";
import { lerPlanilha, PlanilhaError } from "@/lib/saga/parser";
import { PdfPreviewDialog } from "@/components/saga/PdfPreviewDialog";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Importação de Dados — SAGA" },
      { name: "description", content: "Baixe a planilha modelo e importe os dados financeiros." },
      { property: "og:title", content: "Importação de Dados — SAGA" },
      { property: "og:description", content: "Upload da planilha .xlsx com DRE, Balanço e Premissas." },
    ],
  }),
  component: UploadPage,
});

function UploadPage() {
  const { modo, dados, setDados, empresa } = useSaga();
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file || !modo) return;
    setErro(null);
    setCarregando(true);
    try {
      const d = await lerPlanilha(file, modo);
      setDados(d);
    } catch (e) {
      if (e instanceof PlanilhaError) setErro(e.message);
      else setErro(`Erro ao ler planilha: ${(e as Error).message}`);
    } finally {
      setCarregando(false);
    }
  };

  if (!modo) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader titulo="Importação de Dados" />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Selecione um modo antes</AlertTitle>
          <AlertDescription>
            Volte para o <Link to="/" className="underline">Início</Link> e escolha
            "Contabilidade Completa" ou "Dados Básicos".
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        titulo="Importação de Dados"
        subtitulo={`Modo: ${modo === "completa" ? "Contabilidade Completa" : "Dados Básicos"}`}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Download className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">1. Baixar planilha modelo</CardTitle>
            <CardDescription>
              Modelo pré-formatado com abas Premissas, DRE e{" "}
              {modo === "completa" ? "Balanço" : "Balanço Simplificado"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => baixarPlanilhaModelo(modo)}>
              <Download className="mr-2 h-4 w-4" /> Baixar Modelo .xlsx
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <UploadIcon className="h-8 w-8 text-primary" />
            <CardTitle className="mt-2">2. Enviar planilha preenchida</CardTitle>
            <CardDescription>
              O arquivo é lido no navegador. Nenhum dado é enviado a servidores.
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
              variant={dados ? "outline" : "default"}
              className="w-full"
              disabled={carregando}
              onClick={() => inputRef.current?.click()}
            >
              {carregando ? (
                <>Lendo planilha…</>
              ) : dados ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" /> Substituir planilha
                </>
              ) : (
                <>
                  <UploadIcon className="mr-2 h-4 w-4" /> Fazer upload
                </>
              )}
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

      {dados && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary">
              <CheckCircle2 className="h-5 w-5" />
              <CardTitle>Dados carregados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <Item label="Empresa (planilha)" v={dados.empresaPlanilha || "—"} />
              <Item label="Ano base" v={String(dados.anos[dados.anos.length - 1])} />
              <Item label="Período" v={`${dados.anos[0]} – ${dados.anos[dados.anos.length - 1]}`} />
              <Item label="Modo" v={dados.modo === "completa" ? "Completa" : "Básica"} />
              <Item label="Receita Líquida (ano base)" v={dados.dre.receitaLiquida[4].toLocaleString("pt-BR")} />
              <Item label="Lucro Líquido (ano base)" v={dados.dre.lucroLiquido[4].toLocaleString("pt-BR")} />
              <Item label="Ativo Total (ano base)" v={dados.balanco?.ativoTotal[4].toLocaleString("pt-BR") ?? "—"} />
              <Item label="WACC (estimado)" v={`${(((dados.premissas.rf + dados.premissas.beta * dados.premissas.erp) * 100) || 0).toFixed(1)}% (base ke)`} />
            </dl>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button asChild>
                <Link to="/dre">Ver DRE</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/indicadores">Ver Indicadores</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/diagnostico">Ver Diagnóstico</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/valuation">Ver Valuation</Link>
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPreviewOpen(true)}
              >
                <FileDown className="mr-2 h-4 w-4" /> Pré-visualizar Relatório PDF
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {dados && (
        <PdfPreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          dados={dados}
          empresa={empresa}
        />
      )}
    </div>
  );
}

function Item({ label, v }: { label: string; v: string }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{v}</dd>
    </div>
  );
}