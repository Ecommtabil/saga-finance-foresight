import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { faixasProbabilidade, REGRA_EMPIRICA } from "@/lib/volatilidade/stats";
import { moeda, moedaCompacta, numero, pct, type ConfigVolatilidade, type SerieCalculada } from "@/lib/volatilidade/dados";
import { Bolinha, Dica, SeloCV, VolCard } from "./ui";

const DICAS = {
  desvio: "Desvio padrão amostral (STDEV.S, divisor n−1): quanto, em média, os meses se afastam da média. É o nível de risco da série.",
  cv: "Coeficiente de variação = desvio padrão ÷ média. Permite comparar a volatilidade de séries de tamanhos diferentes.",
  assimetria: "Assimetria: 0 = simétrica. Positiva = alguns meses muito acima da média puxam a cauda para a direita; negativa = meses muito abaixo.",
  curtose: "Curtose (em excesso): 0 = igual à normal. Positiva = mais meses extremos que o esperado; negativa = valores mais concentrados/achatados.",
  normalidade: "Teste de Jarque-Bera: compara assimetria e curtose com as de uma normal. p-valor ≥ 5% indica distribuição aproximadamente normal.",
  moda: "Moda: valor que mais se repete. Em valores financeiros contínuos é comum não haver repetição.",
};

function SeloNormal({ s }: { s: SerieCalculada }) {
  if (s.stats.aproxNormal === null) return null;
  return s.stats.aproxNormal
    ? <span className="inline-flex items-center gap-1 text-xs text-vol-good"><CheckCircle2 className="h-3.5 w-3.5" />Distribuição aproximadamente normal</span>
    : <span className="inline-flex items-center gap-1 text-xs text-vol-bad"><AlertTriangle className="h-3.5 w-3.5" />Atenção: dados podem não seguir distribuição normal</span>;
}

export function CardsSeries({ series, config }: { series: SerieCalculada[]; config: ConfigVolatilidade }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {series.map(s => (
        <article key={s.serie.id} className="min-w-0 rounded-2xl border border-vol-border bg-vol-surface p-5 shadow-[var(--vol-shadow)]" style={{ borderTop: `4px solid ${s.serie.cor}` }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-semibold text-vol-text"><Bolinha cor={s.serie.cor} />{s.serie.nome}</h3>
            <SeloCV cv={s.stats.cv} config={config} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {[
              ["Média mensal", moeda(s.stats.media)],
              ["Desvio padrão", moeda(s.stats.desvio), DICAS.desvio],
              ["Coef. de variação", pct(s.stats.cv), DICAS.cv],
              ["Mediana", moeda(s.stats.mediana)],
              ["Mínimo", moeda(s.stats.minimo)],
              ["Máximo", moeda(s.stats.maximo)],
            ].map(([rot, val, dica]) => (
              <div key={rot} className="min-w-0">
                <dt className="flex items-center gap-1 text-xs text-vol-muted">{rot}{dica && <Dica texto={dica} />}</dt>
                <dd className="truncate text-sm font-semibold tabular-nums text-vol-text md:text-base">{val}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-col gap-1 border-t border-vol-border pt-3">
            <SeloNormal s={s} />
            {s.stats.n < 12 && <span className="inline-flex items-center gap-1 text-xs text-vol-warn"><AlertTriangle className="h-3.5 w-3.5" />Amostra pequena: resultados indicativos ({s.stats.n} meses)</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

export function TabelaComparativa({ series, config }: { series: SerieCalculada[]; config: ConfigVolatilidade }) {
  const linhas: Array<[string, (s: SerieCalculada) => string, string?]> = [
    ["N (meses)", s => String(s.stats.n)],
    ["Média", s => moeda(s.stats.media)],
    ["Mediana", s => moeda(s.stats.mediana)],
    ["Mínimo", s => moeda(s.stats.minimo)],
    ["Máximo", s => moeda(s.stats.maximo)],
    ["Amplitude", s => moeda(s.stats.amplitude)],
    ["Desvio padrão (nível de risco)", s => moeda(s.stats.desvio), DICAS.desvio],
    ["Coeficiente de variação", s => pct(s.stats.cv), DICAS.cv],
    ["Moda", s => (s.stats.moda ? s.stats.moda.map(moeda).join(" · ") : "Sem moda"), DICAS.moda],
    ...(config.mostrarMomentos ? [
      ["Assimetria", (s: SerieCalculada) => (s.stats.assimetria === null ? "—" : numero(s.stats.assimetria, 3)), DICAS.assimetria] as [string, (s: SerieCalculada) => string, string],
      ["Curtose (excesso)", (s: SerieCalculada) => (s.stats.curtose === null ? "—" : numero(s.stats.curtose, 3)), DICAS.curtose] as [string, (s: SerieCalculada) => string, string],
    ] : []),
    ["Normalidade (Jarque-Bera, p-valor)", s => (s.stats.pNormalidade === null ? "—" : `${pct(s.stats.pNormalidade)} · ${s.stats.aproxNormal ? "aprox. normal" : "pode não ser normal"}`), DICAS.normalidade],
    ["Tendência (% ao mês)", s => `${s.stats.tendenciaMensal >= 0 ? "+" : "−"}${pct(Math.abs(s.stats.tendenciaMensal))}`],
  ];
  return (
    <div className="overflow-x-auto">
      <table className="vol-table min-w-[520px]">
        <thead><tr><th>Indicador</th>{series.map(s => <th key={s.serie.id} className="num"><span className="inline-flex items-center gap-2"><Bolinha cor={s.serie.cor} />{s.serie.nome}</span></th>)}</tr></thead>
        <tbody className="text-vol-text">
          {linhas.map(([rot, f, dica]) => (
            <tr key={rot}><td><span className="inline-flex items-center gap-1">{rot}{dica && <Dica texto={dica} />}</span></td>{series.map(s => <td key={s.serie.id} className="num">{f(s)}</td>)}</tr>
          ))}
          <tr><td>Classificação</td>{series.map(s => <td key={s.serie.id} className="num"><SeloCV cv={s.stats.cv} config={config} /></td>)}</tr>
        </tbody>
      </table>
    </div>
  );
}

export function TabelaFaixas({ s }: { s: SerieCalculada }) {
  const nome = s.serie.nome.toLowerCase();
  const faixas = faixasProbabilidade(s.stats.media, s.stats.desvio);
  return (
    <VolCard titulo={<span className="flex items-center gap-2"><Bolinha cor={s.serie.cor} />Faixas de probabilidade — {s.serie.nome}</span>}>
      <div className="overflow-x-auto">
        <table className="vol-table min-w-[760px]">
          <thead><tr><th>Faixa</th><th className="num">Nível</th><th className="num">Limite inferior</th><th className="num">Limite superior</th><th className="num">Probabilidade</th><th className="num">Acumulada (≤ nível)</th><th>Interpretação</th></tr></thead>
          <tbody className="text-vol-text">
            {faixas.map(f => (
              <tr key={f.rotulo} className={f.k === 0 ? "bg-vol-gold/10 font-semibold" : ""}>
                <td>{f.rotulo}</td>
                <td className="num">{moeda(f.nivel)}</td>
                <td className="num">{moeda(f.inferior)}</td>
                <td className="num">{moeda(f.superior)}</td>
                <td className="num">{pct(f.probabilidade, 2)}</td>
                <td className="num">{pct(f.acumulada, 2)}</td>
                <td className="whitespace-normal text-xs text-vol-muted">
                  {f.k === 0
                    ? `Em ${pct(f.probabilidade, 0)} dos meses o ${nome} deve ficar entre ${moedaCompacta(f.inferior)} e ${moedaCompacta(f.superior)}.`
                    : `Em ${pct(f.probabilidade, f.probabilidade < 0.05 ? 1 : 0)} dos meses o ${nome} deve ficar entre ${moedaCompacta(f.inferior)} e ${moedaCompacta(f.superior)}${f.k > 0 ? " (acima da média)" : " (abaixo da média)"}.`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-vol-muted">
        Regra empírica da normal: ±1DP = {pct(REGRA_EMPIRICA.um, 2)}; entre 1 e 2DP = {pct(REGRA_EMPIRICA.umDois, 2)} de cada lado; entre 2 e 3DP = {pct(REGRA_EMPIRICA.doisTres, 2)} de cada lado; além de 3DP = {pct(REGRA_EMPIRICA.alemTres, 2)} de cada lado. A linha "Média" resume o intervalo central ±1DP. Calculado com a média ({moeda(s.stats.media)}) e o desvio padrão ({moeda(s.stats.desvio)}) desta série.
      </p>
    </VolCard>
  );
}
