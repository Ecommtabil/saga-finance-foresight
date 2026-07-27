import { createRoot } from "react-dom/client";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  Tooltip,
} from "recharts";
import type { DadosImportados } from "./types";
import {
  margens,
  indicadoresRentabilidade,
  crescimento,
} from "./calculations";

export type GraficoPNG = { titulo: string; legenda: string; dataUrl: string };

// Paleta hex fixa (equivalente ao tema navy do SAGA) — necessária porque
// CSS vars não sobrevivem à serialização do SVG para PNG.
const C = {
  navy: "#2A3566",
  periwinkle: "#A9B8E0",
  teal: "#7FA3C7",
  coral: "#C85450",
  mauve: "#9B87C4",
  // aliases used below
  orange: "#C85450",
  green: "#7FA3C7",
  purple: "#9B87C4",
};

const W = 900;
const H = 420;
const AXIS_STYLE = { fontSize: 12, fill: "#475569" };
const LEGEND_STYLE = { fontSize: 13, paddingTop: 8 };

function ChartsMount({
  dados,
  onReady,
}: {
  dados: DadosImportados;
  onReady: () => void;
}) {
  const m = margens(dados);
  const r = indicadoresRentabilidade(dados);
  const g = crescimento(dados);
  const anos = dados.anos;

  const dreData = anos.map((a, i) => ({
    ano: a,
    Receita: dados.dre.receitaLiquida[i],
    "Lucro Líquido": dados.dre.lucroLiquido[i],
  }));
  const margensData = anos.map((a, i) => ({
    ano: a,
    "M. Bruta": m.bruta[i] * 100,
    "M. EBITDA": m.ebitda[i] * 100,
    "M. Líquida": m.liquida[i] * 100,
  }));
  const retornosData = anos.map((a, i) => ({
    ano: a,
    ROE: r.roe[i] * 100,
    ROA: r.roa[i] * 100,
    ROIC: r.roic[i] * 100,
  }));
  const crescData = anos.map((a, i) => ({
    ano: a,
    Receita: (g.receitaYoY[i] ?? 0) * 100,
    Lucro: (g.lucroYoY[i] ?? 0) * 100,
  }));

  // aviso de "pronto" após o próximo frame — os SVGs já existem no DOM.
  requestAnimationFrame(() => requestAnimationFrame(onReady));

  return (
    <div style={{ background: "#fff", padding: 8 }}>
      <div data-chart="dre">
        <BarChart
          width={W}
          height={H}
          data={dreData}
          margin={{ top: 16, right: 24, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => v.toLocaleString("pt-BR")} />
          <Tooltip />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="Receita" fill={C.navy} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Lucro Líquido" fill={C.periwinkle} radius={[4, 4, 0, 0]} />
        </BarChart>
      </div>

      <div data-chart="margens">
        <AreaChart width={W} height={H} data={margensData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="g-m-bruta" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.navy} stopOpacity={0.25} /><stop offset="100%" stopColor={C.navy} stopOpacity={0} /></linearGradient>
            <linearGradient id="g-m-ebitda" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.periwinkle} stopOpacity={0.25} /><stop offset="100%" stopColor={C.periwinkle} stopOpacity={0} /></linearGradient>
            <linearGradient id="g-m-liq" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.coral} stopOpacity={0.25} /><stop offset="100%" stopColor={C.coral} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickMargin={4} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip />
          <Legend iconType="plainline" wrapperStyle={LEGEND_STYLE} />
          <Area type="monotone" dataKey="M. Bruta" stroke={C.navy} strokeWidth={2.5} strokeLinecap="round" fill="url(#g-m-bruta)" dot={{ r: 3, fill: C.navy, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="M. EBITDA" stroke={C.periwinkle} strokeWidth={2.5} strokeLinecap="round" fill="url(#g-m-ebitda)" dot={{ r: 3, fill: C.periwinkle, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="M. Líquida" stroke={C.coral} strokeWidth={2.5} strokeLinecap="round" fill="url(#g-m-liq)" dot={{ r: 3, fill: C.coral, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </div>

      <div data-chart="retornos">
        <AreaChart width={W} height={H} data={retornosData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="g-r-roe" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.navy} stopOpacity={0.25} /><stop offset="100%" stopColor={C.navy} stopOpacity={0} /></linearGradient>
            <linearGradient id="g-r-roa" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.periwinkle} stopOpacity={0.25} /><stop offset="100%" stopColor={C.periwinkle} stopOpacity={0} /></linearGradient>
            <linearGradient id="g-r-roic" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.coral} stopOpacity={0.25} /><stop offset="100%" stopColor={C.coral} stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tick={AXIS_STYLE} tickLine={false} axisLine={false} tickMargin={4} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip />
          <Legend iconType="plainline" wrapperStyle={LEGEND_STYLE} />
          <Area type="monotone" dataKey="ROE" stroke={C.navy} strokeWidth={2.5} strokeLinecap="round" fill="url(#g-r-roe)" dot={{ r: 3, fill: C.navy, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="ROA" stroke={C.periwinkle} strokeWidth={2.5} strokeLinecap="round" fill="url(#g-r-roa)" dot={{ r: 3, fill: C.periwinkle, strokeWidth: 0 }} activeDot={{ r: 5 }} />
          <Area type="monotone" dataKey="ROIC" stroke={C.coral} strokeWidth={2.5} strokeLinecap="round" fill="url(#g-r-roic)" dot={{ r: 3, fill: C.coral, strokeWidth: 0 }} activeDot={{ r: 5 }} />
        </AreaChart>
      </div>

      <div data-chart="crescimento">
        <BarChart width={W} height={H} data={crescData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="Receita" fill={C.navy} radius={[4, 4, 0, 0]} />
          <Bar dataKey="Lucro" fill={C.periwinkle} radius={[4, 4, 0, 0]} />
        </BarChart>
      </div>
    </div>
  );
}

async function svgToPng(svg: SVGSVGElement, scale = 2): Promise<string> {
  const w = svg.width.baseVal.value || W;
  const h = svg.height.baseVal.value || H;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  const source = new XMLSerializer().serializeToString(clone);
  const url =
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("falha ao carregar SVG"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

const META: Record<string, { titulo: string; legenda: string }> = {
  dre: {
    titulo: "Receita Líquida vs Lucro Líquido",
    legenda:
      "Comparação anual entre receita líquida (barra escura) e lucro líquido (barra clara) nos últimos 5 anos.",
  },
  margens: {
    titulo: "Evolução das Margens",
    legenda:
      "Margem Bruta, EBITDA e Líquida (%) — mostra a eficiência operacional em cada nível da DRE.",
  },
  retornos: {
    titulo: "Retornos sobre Capital",
    legenda:
      "ROE, ROA e ROIC (%) — retorno gerado pelo patrimônio, ativo total e capital investido.",
  },
  crescimento: {
    titulo: "Crescimento Ano a Ano (YoY)",
    legenda:
      "Variação percentual anual de Receita e Lucro. Barras negativas indicam retração.",
  },
};

export async function renderizarGraficosParaPDF(
  dados: DadosImportados,
): Promise<GraficoPNG[]> {
  if (typeof document === "undefined") return [];
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;left:-99999px;top:0;width:960px;pointer-events:none;opacity:0;";
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    await new Promise<void>((resolve) => {
      root.render(<ChartsMount dados={dados} onReady={resolve} />);
    });
    // margem extra para o layout final se estabilizar
    await new Promise((r) => setTimeout(r, 50));
    const nodes = Array.from(
      host.querySelectorAll<HTMLDivElement>("div[data-chart]"),
    );
    const out: GraficoPNG[] = [];
    for (const node of nodes) {
      const key = node.dataset.chart!;
      const svg = node.querySelector("svg") as SVGSVGElement | null;
      if (!svg) continue;
      const dataUrl = await svgToPng(svg, 2);
      out.push({ ...META[key], dataUrl });
    }
    return out;
  } finally {
    root.unmount();
    host.remove();
  }
}