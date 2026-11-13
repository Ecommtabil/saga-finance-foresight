import * as XLSX from "xlsx";
import { celulaAjustada, linhasFiltradas, mesTexto, moedaCompacta, pct, valorEfetivo, type ConfigVolatilidade, type Estudo, type SerieCalculada } from "./dados";
import { classificarCV, eixoCurva, faixasProbabilidade, pdfNormal } from "./stats";

const FMT_MOEDA = '"R$" #,##0.00';
const FMT_PCT = "0.0%";
const FMT_PCT2 = "0.00%";
type Celula = XLSX.CellObject;
const txt = (v: string): Celula => ({ t: "s", v });
const num = (v: number, z?: string): Celula => ({ t: "n", v, z });
const form = (f: string, v: number | string, z?: string): Celula => typeof v === "number" ? { t: "n", f, v, z } : { t: "s", f, v };
const col = XLSX.utils.encode_col;

function folha(linhas: (Celula | null)[][], larguras: number[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxC = 0;
  linhas.forEach((l, r) => l.forEach((c, ci) => { if (c) { ws[XLSX.utils.encode_cell({ r, c: ci })] = c; maxC = Math.max(maxC, ci); } }));
  ws["!ref"] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, linhas.length - 1), c: maxC } });
  ws["!cols"] = larguras.map(wch => ({ wch }));
  return ws;
}

export function montarPlanilhaVolatilidade(estudo: Estudo, series: SerieCalculada[], config: ConfigVolatilidade): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const linhas = linhasFiltradas(estudo);
  const n = linhas.length;
  const ultima = n + 1;

  // Dados
  const dados: (Celula | null)[][] = [[txt("Mês"), ...series.map(s => txt(s.serie.nome)), txt("Observações de ajuste")]];
  for (const l of linhas) {
    const obs = series.flatMap(s => {
      const c = l.valores[s.serie.id];
      return celulaAjustada(c) ? [`${s.serie.nome}: ajuste ${(c!.ajuste ?? 0).toLocaleString("pt-BR")}${c!.obs ? ` (${c!.obs})` : ""}`] : [];
    }).join("; ");
    dados.push([txt(mesTexto(l.mes)), ...series.map(s => { const v = valorEfetivo(l.valores[s.serie.id]); return v === null ? null : num(v, FMT_MOEDA); }), obs ? txt(obs) : null]);
  }
  XLSX.utils.book_append_sheet(wb, folha(dados, [12, ...series.map(() => 18), 50]), "Dados");

  // Estatísticas (fórmulas nativas sobre a aba Dados)
  const faixa = (i: number) => `Dados!${col(i + 1)}2:${col(i + 1)}${ultima}`;
  const E = "'Estatísticas'";
  const est: (Celula | null)[][] = [
    [txt("Indicador"), ...series.map(s => txt(s.serie.nome))],
    [txt("N (meses)"), ...series.map((s, i) => form(`COUNT(${faixa(i)})`, s.stats.n, "0"))],
    [txt("Média"), ...series.map((s, i) => form(`AVERAGE(${faixa(i)})`, s.stats.media, FMT_MOEDA))],
    [txt("Mediana"), ...series.map((s, i) => form(`MEDIAN(${faixa(i)})`, s.stats.mediana, FMT_MOEDA))],
    [txt("Mínimo"), ...series.map((s, i) => form(`MIN(${faixa(i)})`, s.stats.minimo, FMT_MOEDA))],
    [txt("Máximo"), ...series.map((s, i) => form(`MAX(${faixa(i)})`, s.stats.maximo, FMT_MOEDA))],
    [txt("Amplitude"), ...series.map((s, i) => form(`${col(i + 1)}6-${col(i + 1)}5`, s.stats.amplitude, FMT_MOEDA))],
    [txt("Desvio padrão amostral (nível de risco)"), ...series.map((s, i) => form(`_xlfn.STDEV.S(${faixa(i)})`, s.stats.desvio, FMT_MOEDA))],
    [txt("Coeficiente de variação"), ...series.map((s, i) => form(`${col(i + 1)}8/${col(i + 1)}3`, s.stats.cv, FMT_PCT))],
    [txt("Assimetria"), ...series.map((s, i) => s.stats.assimetria === null ? txt("—") : form(`SKEW(${faixa(i)})`, s.stats.assimetria, "0.000"))],
    [txt("Curtose (excesso)"), ...series.map((s, i) => s.stats.curtose === null ? txt("—") : form(`KURT(${faixa(i)})`, s.stats.curtose, "0.000"))],
    [txt("Classificação"), ...series.map((s, i) => {
      const c = classificarCV(s.stats.cv, { baixo: config.cvBaixo, moderado: config.cvModerado });
      return form(`IF(${col(i + 1)}9<=${config.cvBaixo},"Baixa",IF(${col(i + 1)}9<=${config.cvModerado},"Moderada","Alta"))`, c === "baixa" ? "Baixa" : c === "moderada" ? "Moderada" : "Alta");
    })],
  ];
  XLSX.utils.book_append_sheet(wb, folha(est, [40, ...series.map(() => 20)]), "Estatísticas");

  // Faixas
  const fx: (Celula | null)[][] = [];
  series.forEach((s, i) => {
    const c = col(i + 1);
    const mu = `${E}!$${c}$3`, sd = `${E}!$${c}$8`;
    fx.push([txt(s.serie.nome)]);
    fx.push(["Faixa", "Desvios (k)", "Nível (média + k·DP)", "Limite inferior", "Limite superior", "Probabilidade da faixa", "Prob. acumulada (≤ nível)", "Interpretação"].map(txt));
    for (const f of faixasProbabilidade(s.stats.media, s.stats.desvio)) {
      const r = fx.length + 1;
      const inf = f.k === 0 ? `${mu}-${sd}` : f.k > 0 ? `${mu}+(B${r}-1)*${sd}` : `C${r}`;
      const sup = f.k === 0 ? `${mu}+${sd}` : f.k > 0 ? `C${r}` : `${mu}+(B${r}+1)*${sd}`;
      fx.push([
        txt(f.rotulo), num(f.k, "0"), form(`${mu}+B${r}*${sd}`, f.nivel, FMT_MOEDA),
        form(inf, f.inferior, FMT_MOEDA), form(sup, f.superior, FMT_MOEDA), num(f.probabilidade, FMT_PCT2),
        form(`_xlfn.NORM.DIST(C${r},${mu},${sd},TRUE)`, f.acumulada, FMT_PCT2),
        txt(`${pct(f.probabilidade, 2)} dos meses entre ${moedaCompacta(f.inferior)} e ${moedaCompacta(f.superior)}`),
      ]);
    }
    fx.push([txt("Além de ±3DP: 0,13% de cada lado (regra empírica).")]);
    fx.push([]);
  });
  XLSX.utils.book_append_sheet(wb, folha(fx, [14, 11, 20, 18, 18, 16, 18, 52]), "Faixas");

  // Curva (X e densidade via NORM.DIST)
  const params = series.filter(s => s.stats.desvio > 0);
  const eixo = eixoCurva(params.map(s => ({ id: s.serie.id, media: s.stats.media, desvio: s.stats.desvio })));
  const curva: (Celula | null)[][] = [[txt("X (R$)"), ...params.map(s => txt(`Densidade — ${s.serie.nome}`))]];
  if (eixo) {
    const pts = Math.max(2, Math.round(config.pontosCurva));
    const passo = (eixo.max - eixo.min) / (pts - 1);
    for (let k = 0; k < pts; k++) {
      const r = k + 2;
      const x = eixo.min + k * passo;
      curva.push([num(x, FMT_MOEDA), ...params.map(s => {
        const c = col(series.indexOf(s) + 1);
        return form(`_xlfn.NORM.DIST($A${r},${E}!$${c}$3,${E}!$${c}$8,FALSE)`, pdfNormal(x, s.stats.media, s.stats.desvio), "0.000E+00");
      })]);
    }
  }
  XLSX.utils.book_append_sheet(wb, folha(curva, [18, ...params.map(() => 26)]), "Curva");
  return wb;
}

export function exportarExcelVolatilidade(estudo: Estudo, series: SerieCalculada[], config: ConfigVolatilidade, nome: string) {
  XLSX.writeFile(montarPlanilhaVolatilidade(estudo, series, config), nome, { compression: true });
}
