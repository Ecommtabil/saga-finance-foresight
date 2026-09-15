import type { DadosImportados, Modo } from "@/lib/saga/types";

const ETL_URL = import.meta.env.VITE_ETL_URL || "http://localhost:8000";
const ETL_KEY = import.meta.env.VITE_ETL_API_KEY || "dev-etl-key";

export interface EtlImportResult {
  ok: boolean;
  dados: DadosImportados;
  avisos: string[];
  match_stats: Record<string, unknown>;
}

export async function importarFonteBruta(
  file: File,
  modo: Modo,
  opts?: { horizonteAnos?: number; useGliner?: boolean },
): Promise<EtlImportResult> {
  const body = new FormData();
  body.append("file", file);
  body.append("modo", modo);
  body.append("horizonte_anos", String(opts?.horizonteAnos ?? 5));
  body.append("use_gliner", opts?.useGliner ? "true" : "false");

  const res = await fetch(`${ETL_URL}/etl/import`, {
    method: "POST",
    headers: { "X-API-Key": ETL_KEY },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `ETL HTTP ${res.status}`);
  }

  return (await res.json()) as EtlImportResult;
}

export function etlConfigured(): boolean {
  return Boolean(ETL_URL);
}
