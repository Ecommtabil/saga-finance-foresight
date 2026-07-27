import { createRoot } from "react-dom/client";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
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
          <Bar dataKey="Receita" fill={C.navy} />
          <Bar dataKey="Lucro Líquido" fill={C.teal} />
        </BarChart>
      </div>

      <div data-chart="margens">
        <LineChart width={W} height={H} data={margensData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Line type="monotone" dataKey="M. Bruta" stroke={C.navy} strokeWidth={2.5} dot />
          <Line type="monotone" dataKey="M. EBITDA" stroke={C.teal} strokeWidth={2.5} dot />
          <Line type="monotone" dataKey="M. Líquida" stroke={C.orange} strokeWidth={2.5} dot />
        </LineChart>
      </div>

      <div data-chart="retornos">
        <LineChart width={W} height={H} data={retornosData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Line type="monotone" dataKey="ROE" stroke={C.navy} strokeWidth={2.5} dot />
          <Line type="monotone" dataKey="ROA" stroke={C.teal} strokeWidth={2.5} dot />
          <Line type="monotone" dataKey="ROIC" stroke={C.green} strokeWidth={2.5} dot />
        </LineChart>
      </div>

      <div data-chart="crescimento">
        <BarChart width={W} height={H} data={crescData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="ano" tick={AXIS_STYLE} />
          <YAxis tick={AXIS_STYLE} tickFormatter={(v: number) => `${v.toFixed(0)}%`} />
          <Tooltip />
          <Legend wrapperStyle={LEGEND_STYLE} />
          <Bar dataKey="Receita" fill={C.navy} />
          <Bar dataKey="Lucro" fill={C.orange} />
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