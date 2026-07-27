import type { ReactNode } from "react";

export function PageHeader({
  titulo,
  subtitulo,
  action,
}: {
  titulo: string;
  subtitulo?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b pb-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {action}
    </div>
  );
}