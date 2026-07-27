import { useEffect, useMemo, useState } from "react";
import { Download, X, Loader2, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { gerarRelatorioPDF } from "@/lib/saga/pdf-export";
import { renderizarGraficosParaPDF } from "@/lib/saga/chart-renderer";
import type { DadosImportados, Empresa } from "@/lib/saga/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: DadosImportados;
  empresa: Empresa | null;
};

export function PdfPreviewDialog({ open, onOpenChange, dados, empresa }: Props) {
  const [pdf, setPdf] = useState<{ url: string; filename: string; save: () => void } | null>(null);
  const [gerando, setGerando] = useState(false);

  const nomePadrao = useMemo(() => {
    const nome = empresa?.nome || dados.empresaPlanilha || "empresa";
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "empresa";
    const anoBase = dados.anos[dados.anos.length - 1];
    return `saga-relatorio-${slug}-${anoBase}`;
  }, [empresa, dados]);

  const [nomeArquivo, setNomeArquivo] = useState(nomePadrao);
  const [observacao, setObservacao] = useState("");

  useEffect(() => {
    if (open) setNomeArquivo(nomePadrao);
  }, [open, nomePadrao]);

  const gerar = async () => {
    setGerando(true);
    try {
      const graficos = await renderizarGraficosParaPDF(dados);
      setPdf((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        const r = gerarRelatorioPDF(dados, empresa, {
          nomeArquivo: nomeArquivo.trim() || nomePadrao,
          observacao,
          graficos,
        });
        return { url: r.url, filename: r.filename, save: r.save };
      });
    } finally {
      setGerando(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    gerar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open && pdf) {
      URL.revokeObjectURL(pdf.url);
      setPdf(null);
      setObservacao("");
    }
  }, [open, pdf]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle>Pré-visualização do relatório</DialogTitle>
          <DialogDescription>
            Ajuste o nome do arquivo e adicione uma observação para a capa. Clique em "Atualizar
            pré-visualização" para ver as mudanças.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 grid md:grid-cols-[280px_1fr]">
          <div className="border-r p-4 space-y-4 overflow-y-auto bg-background">
            <div className="space-y-2">
              <Label htmlFor="pdf-nome">Nome do arquivo</Label>
              <div className="flex items-center gap-1">
                <Input
                  id="pdf-nome"
                  value={nomeArquivo}
                  onChange={(e) => setNomeArquivo(e.target.value)}
                  placeholder={nomePadrao}
                />
                <span className="text-xs text-muted-foreground">.pdf</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Extensão .pdf é adicionada automaticamente.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pdf-obs">Observação na capa</Label>
              <Textarea
                id="pdf-obs"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                placeholder="Ex.: Análise preliminar para reunião com investidores em nov/2026."
                rows={6}
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">
                {observacao.length}/500 · aparece em destaque logo abaixo do cabeçalho.
              </p>
            </div>
            <Button className="w-full" variant="outline" onClick={gerar} disabled={gerando}>
              <RefreshCw className={`mr-2 h-4 w-4 ${gerando ? "animate-spin" : ""}`} />
              Atualizar pré-visualização
            </Button>
          </div>
          <div className="min-h-0 bg-muted">
            {pdf && !gerando ? (
              <iframe
                title="Pré-visualização do PDF"
                src={`${pdf.url}#view=FitH`}
                className="w-full h-full border-0"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="text-sm">Gerando pré-visualização…</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="p-4 border-t bg-background flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={!pdf || gerando} onClick={() => pdf?.save()}>
            <Download className="mr-2 h-4 w-4" />
            Baixar {pdf?.filename ?? "PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}