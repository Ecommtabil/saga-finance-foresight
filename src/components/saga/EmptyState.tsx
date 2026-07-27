import { Link } from "@tanstack/react-router";
import { FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ titulo }: { titulo: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 p-10 text-center">
      <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{titulo}</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Nenhum dado carregado ainda. Baixe a planilha modelo, preencha no Excel e
          faça o upload para visualizar este módulo.
        </p>
      </div>
      <Button asChild>
        <Link to="/upload">Ir para Importação</Link>
      </Button>
    </div>
  );
}