import { useEffect, useState } from "react";
import { Download, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { gerarRelatorioPDF } from "@/lib/saga/pdf-export";
import type { DadosImportados, Empresa } from "@/lib/saga/types";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  dados: DadosImportados;
  empresa: Empresa | null;
};

export function PdfPreviewDialog({ open, onOpenChange, dados, empresa }: Props) {
  const [pdf, setPdf] = useState<{ url: string; filename: string; save: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;
    // Defer generation so the dialog can render its loading state first.
    const id = setTimeout(() => {
      const r = gerarRelatorioPDF(dados, empresa);
      setPdf({ url: r.url, filename: r.filename, save: r.save });
    }, 30);
    return () => clearTimeout(id);
  }, [open, dados, empresa]);

  useEffect(() => {
    if (!open && pdf) {
      URL.revokeObjectURL(pdf.url);
      setPdf(null);
    }
  }, [open, pdf]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle>Pré-visualização do relatório</DialogTitle>
          <DialogDescription>
            Revise o conteúdo e a formatação. Se estiver tudo certo, clique em "Baixar PDF".
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0 bg-muted">
          {pdf ? (
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
        <DialogFooter className="p-4 border-t bg-background flex-row justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button disabled={!pdf} onClick={() => pdf?.save()}>
            <Download className="mr-2 h-4 w-4" /> Baixar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}