import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { parGap, type ConfigVolatilidade, type SerieCalculada } from "@/lib/volatilidade/dados";
import { CurvasNormais, GapFatRec, Histograma, SerieTemporal } from "./Graficos";
import { CardsSeries, TabelaComparativa, TabelaFaixas } from "./Paineis";
import { Bolinha, VolCard } from "./ui";

export function SemDados() {
  return (
    <VolCard>
      <p className="text-center text-sm text-vol-muted">Informe ao menos 3 meses com valores (e com variação) em uma série na aba <strong className="text-vol-text">Dados</strong> para ver a análise.</p>
    </VolCard>
  );
}

export function AnaliseTab({ series, config }: { series: SerieCalculada[]; config: ConfigVolatilidade }) {
  const [ocultas, setOcultas] = useState<string[]>([]);
  const [normalizar, setNormalizar] = useState(false);
  if (!series.length) return <SemDados />;
  const par = parGap(series.map(s => s.serie));
  const fat = par && series.find(s => s.serie.id === par.fat.id);
  const rec = par && series.find(s => s.serie.id === par.rec.id);
  return (
    <div className="space-y-6">
      <CardsSeries series={series} config={config} />
      <VolCard titulo="Tabela comparativa"><TabelaComparativa series={series} config={config} /></VolCard>
      <VolCard titulo="Curvas normais sobrepostas" acao={
        <label className="flex items-center gap-2 text-sm text-vol-text"><Switch checked={normalizar} onCheckedChange={setNormalizar} aria-label="Normalizar curvas" />Normalizar (altura máx. = 1)</label>
      }>
        <CurvasNormais series={series} pontos={config.pontosCurva} normalizar={normalizar} ocultas={ocultas}
          onAlternar={id => setOcultas(o => (o.includes(id) ? o.filter(x => x !== id) : [...o, id]))} />
        <p className="mt-2 text-xs text-vol-muted">Áreas sombreadas: ±1, ±2 e ±3 desvios padrão (opacidade decrescente). Linhas tracejadas: médias. Pontos sobre o eixo: valores reais dos meses.</p>
      </VolCard>
      {series.map(s => <TabelaFaixas key={s.serie.id} s={s} />)}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        {series.map(s => (
          <VolCard key={s.serie.id} titulo={<span className="flex items-center gap-2"><Bolinha cor={s.serie.cor} />Série temporal — {s.serie.nome}</span>}>
            <SerieTemporal s={s} />
            <p className="mt-2 text-xs text-vol-muted">Bandas ±1DP e ±2DP em torno da média; pontos vermelhos = meses fora de ±2DP.</p>
          </VolCard>
        ))}
        {series.map(s => (
          <VolCard key={`h-${s.serie.id}`} titulo={<span className="flex items-center gap-2"><Bolinha cor={s.serie.cor} />Histograma — {s.serie.nome}</span>}>
            <Histograma s={s} />
            <p className="mt-2 text-xs text-vol-muted">Barras: meses observados por faixa. Linha dourada: quantidade esperada pela curva normal teórica.</p>
          </VolCard>
        ))}
      </div>
      {fat && rec && (
        <VolCard titulo="Gap Faturamento × Recebimento">
          <GapFatRec fat={fat} rec={rec} />
          <p className="mt-2 text-xs text-vol-muted">Barras: recebimento − faturamento no mês (verde = recebeu mais que faturou). Linha: acumulado do período.</p>
        </VolCard>
      )}
    </div>
  );
}
