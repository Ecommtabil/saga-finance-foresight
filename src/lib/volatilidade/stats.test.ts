import { describe, expect, it } from "vitest";
import {
  cdfNormal, classificarCV, eixoCurva, estatisticas, faixasProbabilidade, histograma, inversaNormalPadrao,
  pisoSeguranca, pontosCurva, probEntre, foraDeBanda, LIMITES_CV_PADRAO,
} from "./stats";
import { calcularSeries, estudoExemplo, gradeDeTexto, importarGrade, lerMes, lerNumero, sugerirColunas, validarEstudo } from "./dados";

const exemplo = calcularSeries(estudoExemplo());
const fat = exemplo.find(s => s.serie.id === "faturamento")!;
const rec = exemplo.find(s => s.serie.id === "recebimento")!;

describe("critérios de aceite com os dados de exemplo", () => {
  it("Faturamento: média 516.958,25, DP 34.669,82, CV ≈ 6,7% (Baixa)", () => {
    expect(fat.stats.n).toBe(8);
    expect(fat.stats.media).toBeCloseTo(516958.25, 2);
    expect(fat.stats.desvio).toBeCloseTo(34669.82, 1);
    expect(fat.stats.cv * 100).toBeCloseTo(6.7, 1);
    expect(classificarCV(fat.stats.cv)).toBe("baixa");
  });
  it("Recebimento: média 533.879,50, DP 102.996,65, CV ≈ 19,3% (Moderada)", () => {
    expect(rec.stats.media).toBeCloseTo(533879.5, 2);
    expect(rec.stats.desvio).toBeCloseTo(102996.65, 1);
    expect(rec.stats.cv * 100).toBeCloseTo(19.3, 1);
    expect(classificarCV(rec.stats.cv)).toBe("moderada");
  });
  it("eixo da curva vai de R$ 224.889,56 a R$ 842.869,44", () => {
    const eixo = eixoCurva(exemplo.map(s => ({ id: s.serie.id, media: s.stats.media, desvio: s.stats.desvio })))!;
    expect(eixo.min).toBeCloseTo(224889.56, 0);
    expect(eixo.max).toBeCloseTo(842869.44, 0);
  });
});

describe("estatística descritiva", () => {
  it("usa desvio amostral (n−1) e mediana correta", () => {
    const s = estatisticas([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.desvio).toBeCloseTo(2.13809, 4);
    expect(s.mediana).toBe(4.5);
    expect(s.amplitude).toBe(7);
  });
  it("moda só existe com valor repetido", () => {
    expect(estatisticas([1, 2, 3]).moda).toBeNull();
    expect(estatisticas([1, 2, 2, 3]).moda).toEqual([2]);
  });
  it("assimetria e curtose iguais às do Excel (SKEW/KURT)", () => {
    const s = estatisticas([3, 4, 5, 2, 3, 4, 5, 6, 4, 7]);
    expect(s.assimetria!).toBeCloseTo(0.359543, 5);
    expect(s.curtose!).toBeCloseTo(-0.151799, 5);
  });
  it("classificação do CV respeita limites configuráveis", () => {
    expect(classificarCV(0.1)).toBe("baixa");
    expect(classificarCV(0.15)).toBe("moderada");
    expect(classificarCV(0.21)).toBe("alta");
    expect(classificarCV(0.15, { ...LIMITES_CV_PADRAO, moderado: 0.12 })).toBe("alta");
  });
  it("tendência pela regressão linear", () => {
    const s = estatisticas([100, 110, 120, 130]);
    expect(s.inclinacao).toBeCloseTo(10, 8);
    expect(s.tendenciaMensal).toBeCloseTo(10 / 115, 8);
  });
});

describe("distribuição normal", () => {
  it("CDF e inversa conferem com NORM.S.DIST / NORM.S.INV", () => {
    expect(cdfNormal(1.96)).toBeCloseTo(0.975002, 6);
    expect(cdfNormal(-1)).toBeCloseTo(0.158655, 6);
    expect(inversaNormalPadrao(0.95)).toBeCloseTo(1.644854, 5);
    expect(probEntre(-1, 1, 0, 1)).toBeCloseTo(0.682689, 6);
  });
  it("piso de segurança com 95% de chance = média − 1,645·DP", () => {
    expect(pisoSeguranca(0.95, 1000, 100)).toBeCloseTo(1000 - 164.4854, 3);
  });
});

describe("faixas de probabilidade", () => {
  it("cada série usa a própria média e DP, com rótulos na ordem correta", () => {
    const f = faixasProbabilidade(fat.stats.media, fat.stats.desvio);
    const r = faixasProbabilidade(rec.stats.media, rec.stats.desvio);
    expect(f.map(x => x.rotulo)).toEqual(["+3DP", "+2DP", "+1DP", "Média", "−1DP", "−2DP", "−3DP"]);
    expect(f[0].nivel).toBeCloseTo(fat.stats.media + 3 * fat.stats.desvio, 6);
    expect(r[6].nivel).toBeCloseTo(rec.stats.media - 3 * rec.stats.desvio, 6);
    expect(f[3].inferior).toBeCloseTo(fat.stats.media - fat.stats.desvio, 6);
    expect(f[3].superior).toBeCloseTo(fat.stats.media + fat.stats.desvio, 6);
  });
  it("probabilidades da regra empírica fecham 100%", () => {
    const f = faixasProbabilidade(0, 1);
    expect(f[3].probabilidade).toBe(0.6827);
    expect(f[1].probabilidade).toBe(0.1359);
    expect(f[0].probabilidade).toBe(0.0214);
    const lados = f.filter(x => x.k !== 0).reduce((s, x) => s + x.probabilidade, 0);
    expect(lados + 2 * 0.0013).toBeCloseTo(1, 3);
    expect(f[6].acumulada).toBe(0.0013);
    expect(f[0].acumulada).toBe(0.9987);
  });
});

describe("curva, histograma e outliers", () => {
  it("gera N pontos configuráveis e normaliza a altura máxima em 1", () => {
    const pts = pontosCurva([{ id: "a", media: 0, desvio: 1 }], 201, true);
    expect(pts).toHaveLength(201);
    expect(pts[100].a).toBeCloseTo(1, 8);
  });
  it("histograma conta todos os valores", () => {
    const h = histograma(rec.valores, rec.stats.media, rec.stats.desvio);
    expect(h.reduce((s, c) => s + c.contagem, 0)).toBe(8);
  });
  it("identifica meses fora de ±2DP", () => {
    expect(foraDeBanda([10, 10, 10, 10, 10, 10, 10, 50], 15, 14.14)).toEqual([7]);
  });
});

describe("leitura de dados", () => {
  it("interpreta meses em vários formatos", () => {
    expect(lerMes("jan/22")).toBe("2022-01");
    expect(lerMes("Março/2023")).toBe("2023-03");
    expect(lerMes("02/2022")).toBe("2022-02");
    expect(lerMes("2022-11")).toBe("2022-11");
    expect(lerMes("15/07/2022")).toBe("2022-07");
  });
  it("interpreta números no padrão brasileiro", () => {
    expect(lerNumero("476.288,42")).toBe(476288.42);
    expect(lerNumero("485.190")).toBe(485190);
    expect(lerNumero("R$ 1.234.567,89")).toBe(1234567.89);
    expect(lerNumero("−50.000")).toBe(-50000);
    expect(lerNumero("(1.000)")).toBe(-1000);
    expect(lerNumero("abc")).toBeNull();
  });
  it("importa texto colado, ordena meses e aponta problemas", () => {
    const g = gradeDeTexto("Mês\tFaturamento\tRecebimento\nmar/22\t3\t1\njan/22\t1\tx\nfev/22\t2\t-5\njan/22\t9\t9");
    const sug = sugerirColunas(g);
    expect(sug).toEqual({ colunaMes: 0, colunasSeries: [1, 2] });
    let id = 0;
    const r = importarGrade(g, sug.colunaMes, sug.colunasSeries, () => `s${++id}`);
    expect(r.linhas.map(l => l.mes)).toEqual(["2022-01", "2022-02", "2022-03"]);
    expect(r.avisos.some(a => a.includes("não numérico"))).toBe(true);
    expect(r.avisos.some(a => a.includes("duplicado"))).toBe(true);
    expect(r.avisos.some(a => a.includes("negativo"))).toBe(true);
  });
  it("exige mínimo de 3 meses por série e respeita o filtro de período", () => {
    const e = { ...estudoExemplo(), filtro: { inicio: "2022-03", fim: "2022-04" } };
    expect(validarEstudo(e).some(v => v.nivel === "erro" && v.texto.includes("3 meses"))).toBe(true);
    expect(calcularSeries(e)[0].stats.n).toBe(2);
  });
  it("ajuste manual altera o valor usado nos cálculos", () => {
    const e = estudoExemplo();
    e.linhas[0].valores.faturamento = { valor: 476288.42, ajuste: -50000, obs: "estorno" };
    expect(calcularSeries(e)[0].valores[0]).toBeCloseTo(426288.42, 2);
  });
});
