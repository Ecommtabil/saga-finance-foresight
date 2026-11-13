import { classificarCV, foraDeBanda, ROTULO_CLASSE, type LimitesCV } from "./stats";
import { mesTexto, moedaCompacta, numero, parGap, pct, serieValida, type SerieCalculada } from "./dados";

const RECOMENDACAO = {
  baixa: "série previsível: pode ser usada como base de orçamento com margem de segurança enxuta.",
  moderada: "recomenda-se trabalhar com cenários (pessimista/base/otimista) e manter reserva de caixa para cobrir ao menos 1 desvio padrão.",
  alta: "baixa previsibilidade: priorize reserva de capital de giro robusta, revise políticas comerciais/prazos e acompanhe mensalmente.",
} as const;

export function diagnosticoAutomatico(series: SerieCalculada[], limites: LimitesCV): string {
  const validas = series.filter(serieValida);
  if (!validas.length) return "Informe ao menos 3 meses com valores em uma série para gerar o diagnóstico.";
  const p: string[] = [];

  for (const s of validas) {
    const c = classificarCV(s.stats.cv, limites);
    p.push(`${s.serie.nome}: média de ${moedaCompacta(s.stats.media)} por mês, desvio padrão de ${moedaCompacta(s.stats.desvio)} e coeficiente de variação de ${pct(s.stats.cv)} (${ROTULO_CLASSE[c].toLowerCase()}) — ${RECOMENDACAO[c]}`);
  }

  if (validas.length >= 2) {
    const ord = [...validas].sort((a, b) => b.stats.cv - a.stats.cv);
    const mais = ord[0], menos = ord[ord.length - 1];
    if (menos.stats.cv > 0) {
      const razao = mais.stats.cv / menos.stats.cv;
      let frase = razao >= 1.2
        ? `O ${mais.serie.nome.toLowerCase()} é ${numero(razao, 1)}x mais volátil que o ${menos.serie.nome.toLowerCase()}`
        : `${mais.serie.nome} e ${menos.serie.nome} têm volatilidade semelhante (diferença de ${numero(razao, 1)}x)`;
      const par = parGap(validas.map(v => v.serie));
      if (razao >= 1.2 && par) {
        if (mais.serie.id === par.rec.id && menos.serie.id === par.fat.id) frase += ": o risco está no caixa/prazo de recebimento, não na geração de receita";
        if (mais.serie.id === par.fat.id && menos.serie.id === par.rec.id) frase += ": o risco está na geração de receita (vendas), enquanto o recebimento é mais estável";
      }
      p.push(`${frase}.`);
    }
  }

  const atipicos = validas.flatMap(s => {
    const idx = foraDeBanda(s.valores, s.stats.media, s.stats.desvio, 2);
    return idx.length ? [`${s.serie.nome}: ${idx.map(i => `${mesTexto(s.meses[i])} (${moedaCompacta(s.valores[i])})`).join(", ")}`] : [];
  });
  p.push(atipicos.length
    ? `Meses atípicos (fora de ±2 desvios padrão): ${atipicos.join("; ")}. Verifique eventos pontuais antes de usá-los como referência.`
    : "Nenhum mês ficou fora de ±2 desvios padrão: não há meses atípicos no período.");

  const tend = validas.map(s => {
    const t = s.stats.tendenciaMensal;
    const dir = Math.abs(t) < 0.005 ? "estável" : t > 0 ? "de crescimento" : "de queda";
    return `${s.serie.nome} com tendência ${dir} (${t >= 0 ? "+" : "−"}${pct(Math.abs(t))} ao mês, ${moedaCompacta(s.stats.inclinacao)}/mês)`;
  });
  p.push(`Tendência pela regressão linear: ${tend.join("; ")}.`);

  const pequenas = validas.filter(s => s.stats.n < 12).map(s => s.serie.nome);
  if (pequenas.length) p.push(`Amostra pequena (menos de 12 meses) em ${pequenas.join(", ")}: os resultados são indicativos e devem ser revistos com mais histórico.`);
  const naoNormais = validas.filter(s => s.stats.aproxNormal === false).map(s => s.serie.nome);
  if (naoNormais.length) p.push(`Atenção: ${naoNormais.join(", ")} pode não seguir distribuição normal (teste de Jarque-Bera); as faixas de probabilidade são aproximadas.`);

  return p.join("\n\n");
}
