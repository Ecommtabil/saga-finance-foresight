import type {
  ConfigForecast,
  LinhaOrcamento,
  MetodoForecast,
  Orcamento,
  TipoConta,
} from "./types";
import { MESES } from "./types";

const soma = (a: number[]) => a.reduce((s, v) => s + v, 0);

/** Sinal do resultado: receita acima do orçado é bom; custo/despesa acima é ruim. */
export function favoravel(tipo: TipoConta, variacao: number): boolean {
  if (variacao === 0) return true;
  return tipo === "receita" || tipo === "outros" ? variacao > 0 : variacao < 0;
}

/** Último mês (0-based) com algum realizado lançado. -1 se nenhum. */
export function ultimoMesRealizado(linhas: LinhaOrcamento[]): number {
  let ultimo = -1;
  for (const l of linhas) {
    for (let m = 0; m < 12; m++) {
      if (l.realizado[m] != null && ultimo < m) ultimo = m;
    }
  }
  return ultimo;
}

export interface VarianciaLinha {
  linha: LinhaOrcamento;
  orcado: number[];
  realizado: (number | null)[];
  variacao: (number | null)[];
  variacaoPct: (number | null)[];
  orcadoYtd: number;
  realizadoYtd: number;
  varYtd: number;
  varYtdPct: number | null;
  orcadoAno: number;
  favoravelYtd: boolean;
}

export interface AnaliseVariancia {
  ateMes: number; // 0-based
  linhas: VarianciaLinha[];
  totais: {
    receitaOrc: number;
    receitaReal: number;
    custoOrc: number;
    custoReal: number;
    despesaOrc: number;
    despesaReal: number;
    resultadoOrc: number;
    resultadoReal: number;
  };
  porMes: {
    mes: string;
    receitaOrc: number;
    receitaReal: number | null;
    resultadoOrc: number;
    resultadoReal: number | null;
  }[];
}

export function analisarVariancia(orc: Orcamento, ateMes?: number): AnaliseVariancia {
  const limite = ateMes ?? Math.max(ultimoMesRealizado(orc.linhas), 0);
  const linhas: VarianciaLinha[] = orc.linhas.map((linha) => {
    const variacao = linha.orcado.map((o, m) => {
      const r = linha.realizado[m];
      return r == null ? null : r - o;
    });
    const variacaoPct = linha.orcado.map((o, m) => {
      const r = linha.realizado[m];
      if (r == null || !o) return null;
      return (r - o) / Math.abs(o);
    });
    const idx = Array.from({ length: limite + 1 }, (_, i) => i);
    const orcadoYtd = soma(idx.map((m) => linha.orcado[m] ?? 0));
    const realizadoYtd = soma(idx.map((m) => linha.realizado[m] ?? 0));
    const varYtd = realizadoYtd - orcadoYtd;
    return {
      linha,
      orcado: linha.orcado,
      realizado: linha.realizado,
      variacao,
      variacaoPct,
      orcadoYtd,
      realizadoYtd,
      varYtd,
      varYtdPct: orcadoYtd ? varYtd / Math.abs(orcadoYtd) : null,
      orcadoAno: soma(linha.orcado),
      favoravelYtd: favoravel(linha.tipo, varYtd),
    };
  });

  const porTipo = (tipo: TipoConta, campo: "orcadoYtd" | "realizadoYtd") =>
    soma(linhas.filter((l) => l.linha.tipo === tipo).map((l) => l[campo]));

  const receitaOrc = porTipo("receita", "orcadoYtd");
  const receitaReal = porTipo("receita", "realizadoYtd");
  const custoOrc = porTipo("custo", "orcadoYtd");
  const custoReal = porTipo("custo", "realizadoYtd");
  const despesaOrc = porTipo("despesa", "orcadoYtd");
  const despesaReal = porTipo("despesa", "realizadoYtd");

  const porMes = MESES.map((mes, m) => {
    const recOrc = soma(
      orc.linhas.filter((l) => l.tipo === "receita").map((l) => l.orcado[m] ?? 0),
    );
    const temReal = orc.linhas.some((l) => l.realizado[m] != null);
    const recReal = soma(
      orc.linhas.filter((l) => l.tipo === "receita").map((l) => l.realizado[m] ?? 0),
    );
    const resOrc = soma(
      orc.linhas.map((l) => (l.tipo === "receita" ? 1 : -1) * (l.orcado[m] ?? 0)),
    );
    const resReal = soma(
      orc.linhas.map((l) => (l.tipo === "receita" ? 1 : -1) * (l.realizado[m] ?? 0)),
    );
    return {
      mes,
      receitaOrc: recOrc,
      receitaReal: temReal ? recReal : null,
      resultadoOrc: resOrc,
      resultadoReal: temReal ? resReal : null,
    };
  });

  return {
    ateMes: limite,
    linhas,
    totais: {
      receitaOrc,
      receitaReal,
      custoOrc,
      custoReal,
      despesaOrc,
      despesaReal,
      resultadoOrc: receitaOrc - custoOrc - despesaOrc,
      resultadoReal: receitaReal - custoReal - despesaReal,
    },
    porMes,
  };
}

/** Regressão linear simples sobre os pontos realizados (y = a + b*x). */
function tendencia(valores: { x: number; y: number }[]): (x: number) => number {
  const n = valores.length;
  if (n === 0) return () => 0;
  if (n === 1) return () => valores[0].y;
  const mx = soma(valores.map((v) => v.x)) / n;
  const my = soma(valores.map((v) => v.y)) / n;
  const den = soma(valores.map((v) => (v.x - mx) ** 2));
  const b = den ? soma(valores.map((v) => (v.x - mx) * (v.y - my))) / den : 0;
  const a = my - b * mx;
  return (x) => a + b * x;
}

/** Projeta os 12 meses de uma linha: realizado onde existe, previsto no restante. */
export function preverLinha(
  linha: LinhaOrcamento,
  metodo: MetodoForecast,
  ajustePct: number,
): { valores: number[]; previstoDe: number } {
  const pontos = linha.realizado
    .map((r, m) => (r == null ? null : { x: m, y: r }))
    .filter((p): p is { x: number; y: number } => p != null);
  const previstoDe = pontos.length ? Math.max(...pontos.map((p) => p.x)) + 1 : 0;
  const media = pontos.length ? soma(pontos.map((p) => p.y)) / pontos.length : 0;
  const fn = tendencia(pontos);

  const orcRealizadoPeriodo = soma(pontos.map((p) => linha.orcado[p.x] ?? 0));
  const realizadoPeriodo = soma(pontos.map((p) => p.y));
  const fator =
    orcRealizadoPeriodo !== 0 ? realizadoPeriodo / orcRealizadoPeriodo : 1;

  const valores = linha.orcado.map((orcado, m) => {
    const real = linha.realizado[m];
    if (real != null) return real;
    let base: number;
    switch (metodo) {
      case "orcado":
        base = orcado;
        break;
      case "runrate":
        base = pontos.length ? media : orcado;
        break;
      case "tendencia":
        base = pontos.length ? fn(m) : orcado;
        break;
      case "sazonal":
      default:
        base = pontos.length ? orcado * fator : orcado;
        break;
    }
    return base * (1 + ajustePct / 100);
  });

  return { valores, previstoDe };
}

export interface ForecastLinha {
  linha: LinhaOrcamento;
  valores: number[];
  totalForecast: number;
  totalOrcado: number;
  desvio: number;
  desvioPct: number | null;
}

export interface Forecast {
  previstoDe: number;
  linhas: ForecastLinha[];
  porMes: { mes: string; orcado: number; forecast: number; realizado: number | null }[];
  totais: {
    receita: number;
    custo: number;
    despesa: number;
    resultado: number;
    receitaOrc: number;
    resultadoOrc: number;
  };
}

export function gerarForecast(orc: Orcamento, config?: Partial<ConfigForecast>): Forecast {
  const cfg = { ...orc.config, ...config };
  const linhas: ForecastLinha[] = orc.linhas.map((linha) => {
    const { valores } = preverLinha(linha, cfg.metodo, cfg.ajustePct);
    const totalForecast = soma(valores);
    const totalOrcado = soma(linha.orcado);
    return {
      linha,
      valores,
      totalForecast,
      totalOrcado,
      desvio: totalForecast - totalOrcado,
      desvioPct: totalOrcado ? (totalForecast - totalOrcado) / Math.abs(totalOrcado) : null,
    };
  });

  const previstoDe = ultimoMesRealizado(orc.linhas) + 1;
  const porTipo = (tipo: TipoConta) =>
    soma(linhas.filter((l) => l.linha.tipo === tipo).map((l) => l.totalForecast));

  const receita = porTipo("receita");
  const custo = porTipo("custo");
  const despesa = porTipo("despesa");
  const receitaOrc = soma(
    orc.linhas.filter((l) => l.tipo === "receita").map((l) => soma(l.orcado)),
  );
  const resultadoOrc = soma(
    orc.linhas.map((l) => (l.tipo === "receita" ? 1 : -1) * soma(l.orcado)),
  );

  const porMes = MESES.map((mes, m) => ({
    mes,
    orcado: soma(orc.linhas.map((l) => (l.tipo === "receita" ? 1 : -1) * (l.orcado[m] ?? 0))),
    forecast: soma(
      linhas.map((l) => (l.linha.tipo === "receita" ? 1 : -1) * (l.valores[m] ?? 0)),
    ),
    realizado: orc.linhas.some((l) => l.realizado[m] != null)
      ? soma(
          orc.linhas.map((l) => (l.tipo === "receita" ? 1 : -1) * (l.realizado[m] ?? 0)),
        )
      : null,
  }));

  return {
    previstoDe,
    linhas,
    porMes,
    totais: {
      receita,
      custo,
      despesa,
      resultado: receita - custo - despesa,
      receitaOrc,
      resultadoOrc,
    },
  };
}

export interface PontoRolling {
  rotulo: string;
  ano: number;
  mesIdx: number;
  receita: number;
  custo: number;
  despesa: number;
  resultado: number;
  origem: "realizado" | "forecast" | "rolling";
}

export interface RollingForecast {
  pontos: PontoRolling[];
  totais: { receita: number; custo: number; despesa: number; resultado: number };
  ancora: string;
}

/**
 * Rolling forecast: janela contínua de N meses a partir do mês seguinte
 * ao último realizado, atravessando a virada de ano com crescimento aplicado.
 */
export function gerarRolling(orc: Orcamento, config?: Partial<ConfigForecast>): RollingForecast {
  const cfg = { ...orc.config, ...config };
  const fc = gerarForecast(orc, cfg);
  const inicio = Math.max(fc.previstoDe, 0);
  const janela = Math.max(1, Math.min(36, cfg.janelaRolling));
  const cresc = cfg.crescimentoRollingPct / 100;

  const valorMes = (tipo: TipoConta, m: number) =>
    soma(fc.linhas.filter((l) => l.linha.tipo === tipo).map((l) => l.valores[m] ?? 0));

  const pontos: PontoRolling[] = [];
  for (let i = 0; i < janela; i++) {
    const abs = inicio + i;
    const mesIdx = abs % 12;
    const voltas = Math.floor(abs / 12);
    const ano = orc.ano + voltas;
    const fator = (1 + cresc) ** voltas;
    const receita = valorMes("receita", mesIdx) * fator;
    const custo = valorMes("custo", mesIdx) * fator;
    const despesa = valorMes("despesa", mesIdx) * fator;
    pontos.push({
      rotulo: `${MESES[mesIdx]}/${String(ano).slice(2)}`,
      ano,
      mesIdx,
      receita,
      custo,
      despesa,
      resultado: receita - custo - despesa,
      origem: voltas > 0 ? "rolling" : "forecast",
    });
  }

  return {
    pontos,
    totais: {
      receita: soma(pontos.map((p) => p.receita)),
      custo: soma(pontos.map((p) => p.custo)),
      despesa: soma(pontos.map((p) => p.despesa)),
      resultado: soma(pontos.map((p) => p.resultado)),
    },
    ancora:
      inicio === 0
        ? `${MESES[0]}/${orc.ano}`
        : `${MESES[(inicio - 1) % 12]}/${orc.ano} (último realizado)`,
  };
}
