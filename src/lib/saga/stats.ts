import * as XLSX from "xlsx";

export interface SerieEstatistica {
  nome: string;
  valores: number[];
}

export interface DatasetEstatistico {
  periodos: string[];
  series: SerieEstatistica[];
  nomeArquivo?: string;
}

export function gerarPlanilhaModeloEstatistica(): Blob {
  const wb = XLSX.utils.book_new();
  const headerSeries = [
    "Periodo",
    "Receita",
    "Custos",
    "Taxas",
    "Comissoes",
    "Fretes",
    "Impostos",
    "Volume de Vendas",
  ];
  const meses: string[] = [];
  for (let ano = 2024; ano <= 2025; ano++) {
    for (let m = 1; m <= 12; m++) {
      meses.push(`${ano}-${String(m).padStart(2, "0")}`);
    }
  }
  const sampleSeries = meses.map((p) => [p, "", "", "", "", "", "", ""]);
  const wsSeries = XLSX.utils.aoa_to_sheet([headerSeries, ...sampleSeries]);
  XLSX.utils.book_append_sheet(wb, wsSeries, "Series");

  const sampleDespesas = meses.map((p) => [p, "Marketing", ""]);
  const wsDespesas = XLSX.utils.aoa_to_sheet([
    ["Periodo", "Descrição", "Despesas"],
    ...sampleDespesas,
  ]);
  XLSX.utils.book_append_sheet(wb, wsDespesas, "Despesas");

  const wsInstr = XLSX.utils.aoa_to_sheet([
    ["Instruções — Módulo Estatístico SAGA"],
    [],
    ["1. A primeira coluna de cada aba deve conter o Período (ano, mês, trimestre ou label livre)."],
    ["2. Cada coluna adicional é uma série numérica que será analisada no SAGA."],
    ["3. Aba 'Series': receitas, custos, taxas, comissões, fretes, impostos e volume de vendas."],
    ["4. Aba 'Despesas': formato longo — Periodo, Descrição (categoria) e Despesas (valor)."],
    ["   Cada categoria em 'Descrição' vira uma série própria (ex.: 'Despesas — Marketing')."],
    ["5. Você pode adicionar quantas linhas (períodos) e colunas (séries) desejar em qualquer aba."],
    ["6. Os períodos são casados entre as abas pela primeira coluna — use os mesmos rótulos."],
    ["7. Use ponto como separador decimal. Cabeçalhos claros viram os nomes das séries no SAGA."],
  ]);
  XLSX.utils.book_append_sheet(wb, wsInstr, "Instrucoes");

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function baixarPlanilhaModeloEstatistica() {
  const blob = gerarPlanilhaModeloEstatistica();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "SAGA_Modelo_Estatistica.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function parsePlanilhaEstatistica(file: File): Promise<DatasetEstatistico> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames.filter(
    (n) => !n.toLowerCase().startsWith("instru"),
  );
  if (!sheetNames.length) throw new Error("Planilha vazia ou sem abas.");

  const periodosOrdem: string[] = [];
  const periodosSet = new Set<string>();
  const seriesMap = new Map<string, Map<string, number>>();

  const normPeriodo = (v: unknown, fallback: number): string => {
    if (v === null || v === undefined || v === "") return String(fallback);
    if (v instanceof Date) {
      const y = v.getUTCFullYear();
      const m = String(v.getUTCMonth() + 1).padStart(2, "0");
      return `${y}-${m}`;
    }
    return String(v).trim();
  };
  const normHeader = (h: string) =>
    h.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  for (const sheetName of sheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      blankrows: false,
      defval: null,
      raw: false,
    });
    if (rows.length < 2) continue;
    const header = rows[0].map((v) => String(v ?? "").trim());
    if (header.length < 2) continue;
    const headerNorm = header.map(normHeader);
    const descIdx = headerNorm.findIndex((h) => h === "descricao" || h === "descrição");
    const isLongFormat = descIdx > 0 && header.length >= 3;
    const multiAba = sheetNames.length > 1;

    if (isLongFormat) {
      // Formato longo: Periodo | Descrição | valor1 [| valor2 ...]
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every((v) => v === null || v === "")) continue;
        const periodo = normPeriodo(row[0], i);
        if (!periodosSet.has(periodo)) {
          periodosSet.add(periodo);
          periodosOrdem.push(periodo);
        }
        const categoria = String(row[descIdx] ?? "").trim() || "Sem categoria";
        for (let c = 1; c < header.length; c++) {
          if (c === descIdx) continue;
          const nomeCol = header[c] || `Coluna ${c}`;
          const base = multiAba ? `${sheetName} — ${categoria}` : `${nomeCol} — ${categoria}`;
          const raw = row[c];
          const num =
            typeof raw === "number"
              ? raw
              : parseFloat(String(raw ?? "").replace(",", "."));
          if (!seriesMap.has(base)) seriesMap.set(base, new Map());
          seriesMap.get(base)!.set(periodo, Number.isFinite(num) ? num : NaN);
        }
      }
      continue;
    }

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((v) => v === null || v === "")) continue;
      const periodo = normPeriodo(row[0], i);
      if (!periodosSet.has(periodo)) {
        periodosSet.add(periodo);
        periodosOrdem.push(periodo);
      }
      for (let c = 1; c < header.length; c++) {
        const nomeCol = header[c] || `Coluna ${c}`;
        const nomeSerie = multiAba ? `${sheetName} · ${nomeCol}` : nomeCol;
        const raw = row[c];
        const num =
          typeof raw === "number"
            ? raw
            : parseFloat(String(raw ?? "").replace(",", "."));
        if (!seriesMap.has(nomeSerie)) seriesMap.set(nomeSerie, new Map());
        seriesMap.get(nomeSerie)!.set(periodo, Number.isFinite(num) ? num : NaN);
      }
    }
  }

  if (!periodosOrdem.length) {
    throw new Error("Nenhuma linha de dados encontrada nas abas da planilha.");
  }
  if (!seriesMap.size) {
    throw new Error("Nenhuma série numérica encontrada. Verifique os cabeçalhos.");
  }

  const series: SerieEstatistica[] = Array.from(seriesMap.entries()).map(
    ([nome, mapa]) => ({
      nome,
      valores: periodosOrdem.map((p) => (mapa.has(p) ? mapa.get(p)! : NaN)),
    }),
  );

  return { periodos: periodosOrdem, series, nomeArquivo: file.name };
}

// ============= Cálculos =============

function clean(arr: number[]): number[] {
  return arr.filter((v) => Number.isFinite(v));
}

export function descritiva(arr: number[]) {
  const a = clean(arr);
  const n = a.length;
  if (!n) return { n: 0, media: 0, mediana: 0, desvio: 0, min: 0, max: 0, cv: 0, soma: 0 };
  const soma = a.reduce((x, y) => x + y, 0);
  const media = soma / n;
  const sorted = [...a].sort((x, y) => x - y);
  const mediana =
    n % 2 === 0 ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : sorted[(n - 1) / 2];
  const variancia = a.reduce((x, y) => x + (y - media) ** 2, 0) / n;
  const desvio = Math.sqrt(variancia);
  return {
    n,
    media,
    mediana,
    desvio,
    min: Math.min(...a),
    max: Math.max(...a),
    cv: media ? desvio / Math.abs(media) : 0,
    soma,
  };
}

export function regLinear(y: number[]) {
  const yy = clean(y);
  const n = yy.length;
  if (n < 2) return { slope: 0, intercept: 0, r2: 0, yPred: [] as number[] };
  const x = Array.from({ length: n }, (_, i) => i + 1);
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = yy.reduce((a, b) => a + b, 0) / n;
  const num = x.reduce((a, xi, i) => a + (xi - mx) * (yy[i] - my), 0);
  const den = x.reduce((a, xi) => a + (xi - mx) ** 2, 0);
  const slope = den ? num / den : 0;
  const intercept = my - slope * mx;
  const yPred = x.map((xi) => intercept + slope * xi);
  const ssRes = yy.reduce((a, yi, i) => a + (yi - yPred[i]) ** 2, 0);
  const ssTot = yy.reduce((a, yi) => a + (yi - my) ** 2, 0);
  const r2 = ssTot ? 1 - ssRes / ssTot : 0;
  return { slope, intercept, r2, yPred };
}

export function correlacaoS(a: number[], b: number[]) {
  const pares: [number, number][] = [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (Number.isFinite(a[i]) && Number.isFinite(b[i])) pares.push([a[i], b[i]]);
  }
  const n = pares.length;
  if (n < 2) return 0;
  const ma = pares.reduce((s, [x]) => s + x, 0) / n;
  const mb = pares.reduce((s, [, y]) => s + y, 0) / n;
  const num = pares.reduce((s, [x, y]) => s + (x - ma) * (y - mb), 0);
  const da = Math.sqrt(pares.reduce((s, [x]) => s + (x - ma) ** 2, 0));
  const db = Math.sqrt(pares.reduce((s, [, y]) => s + (y - mb) ** 2, 0));
  return da && db ? num / (da * db) : 0;
}

export function retornos(arr: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    if (Number.isFinite(arr[i]) && Number.isFinite(arr[i - 1]) && arr[i - 1] !== 0) {
      r.push((arr[i] - arr[i - 1]) / Math.abs(arr[i - 1]));
    }
  }
  return r;
}

export function volatilidadeS(arr: number[]) {
  return descritiva(retornos(arr)).desvio;
}

export function mediaMovel(arr: number[], janela: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    if (i < janela - 1) {
      out.push(NaN);
      continue;
    }
    let s = 0;
    let c = 0;
    for (let j = i - janela + 1; j <= i; j++) {
      if (Number.isFinite(arr[j])) {
        s += arr[j];
        c++;
      }
    }
    out.push(c ? s / c : NaN);
  }
  return out;
}

export function histograma(arr: number[], bins = 8) {
  const a = clean(arr);
  if (a.length < 2) return [] as { faixa: string; freq: number; centro: number }[];
  const min = Math.min(...a);
  const max = Math.max(...a);
  const range = max - min || 1;
  const step = range / bins;
  const buckets = Array.from({ length: bins }, (_, i) => ({
    faixa: `${(min + i * step).toFixed(1)} – ${(min + (i + 1) * step).toFixed(1)}`,
    freq: 0,
    centro: min + (i + 0.5) * step,
  }));
  for (const v of a) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / step));
    buckets[idx].freq++;
  }
  return buckets;
}