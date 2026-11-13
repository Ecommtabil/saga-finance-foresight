import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { lerNumero, moeda, numero, pct, type ConfigVolatilidade, type SerieCalculada } from "@/lib/volatilidade/dados";
import { pisoSeguranca, probAbaixo, probEntre } from "@/lib/volatilidade/stats";
import { CurvasNormais, type Destaque } from "./Graficos";
import { Bolinha, VolCard } from "./ui";
import { SemDados } from "./AnaliseTab";

type Pergunta = "abaixo" | "entre" | "piso";
const campo = "border-vol-border bg-vol-surface text-vol-text";

export function CalculadoraTab({ series, config }: { series: SerieCalculada[]; config: ConfigVolatilidade }) {
  const [serieId, setSerieId] = useState(series[0]?.serie.id ?? "");
  const s = series.find(x => x.serie.id === serieId) ?? series[0];
  const [pergunta, setPergunta] = useState<Pergunta>("abaixo");
  const [x, setX] = useState("");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [conf, setConf] = useState(numero(config.confianca * 100, 1));
  const destaque = useMemo<Destaque | null>(() => {
    if (!s) return null;
    const { media: mu, desvio: sd } = s.stats;
    if (pergunta === "abaixo") { const v = lerNumero(x) ?? mu; return { serieId: s.serie.id, de: null, ate: v }; }
    if (pergunta === "entre") { const va = lerNumero(a) ?? mu - sd, vb = lerNumero(b) ?? mu + sd; return { serieId: s.serie.id, de: Math.min(va, vb), ate: Math.max(va, vb) }; }
    const c = Math.min(0.999, Math.max(0.5, (lerNumero(conf) ?? 95) / 100));
    return { serieId: s.serie.id, de: pisoSeguranca(c, mu, sd), ate: null };
  }, [s, pergunta, x, a, b, conf]);
  if (!s || !destaque) return <SemDados />;
  const { media: mu, desvio: sd } = s.stats;
  const nome = s.serie.nome.toLowerCase();
  const confNum = Math.min(0.999, Math.max(0.5, (lerNumero(conf) ?? 95) / 100));

  let resposta: string;
  if (pergunta === "abaixo") resposta = `Probabilidade de o ${nome} ficar abaixo de ${moeda(destaque.ate!)}: ${pct(probAbaixo(destaque.ate!, mu, sd))}.`;
  else if (pergunta === "entre") resposta = `Probabilidade de o ${nome} ficar entre ${moeda(destaque.de!)} e ${moeda(destaque.ate!)}: ${pct(probEntre(destaque.de!, destaque.ate!, mu, sd))}.`;
  else resposta = `Com ${pct(confNum)} de chance, o ${nome} mensal será de pelo menos ${moeda(destaque.de!)} (piso de segurança para orçamento e capital de giro).`;

  const opcoes: Array<[Pergunta, string]> = [
    ["abaixo", "Abaixo de R$ X"], ["entre", "Entre R$ A e R$ B"], ["piso", "Valor com N% de chance"],
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <VolCard titulo="Calculadora de probabilidade">
        <div className="space-y-4">
          <div>
            <p className="mb-1 text-xs font-medium uppercase text-vol-muted">Série</p>
            <Select value={s.serie.id} onValueChange={setSerieId}>
              <SelectTrigger aria-label="Série" className={campo}><SelectValue /></SelectTrigger>
              <SelectContent>{series.map(o => <SelectItem key={o.serie.id} value={o.serie.id}><span className="flex items-center gap-2"><Bolinha cor={o.serie.cor} />{o.serie.nome}</span></SelectItem>)}</SelectContent>
            </Select>
            <p className="mt-1 text-xs text-vol-muted">Média {moeda(mu)} · DP {moeda(sd)}</p>
          </div>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Pergunta">
            {opcoes.map(([id, rot]) => (
              <button key={id} type="button" role="radio" aria-checked={pergunta === id} onClick={() => setPergunta(id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${pergunta === id ? "border-vol-gold bg-vol-gold/10 font-medium text-vol-text" : "border-vol-border text-vol-muted hover:text-vol-text"}`}>{rot}</button>
            ))}
          </div>
          {pergunta === "abaixo" && <div><label className="text-xs text-vol-muted" htmlFor="calc-x">Qual a probabilidade de ficar abaixo de (R$)?</label><Input id="calc-x" className={campo} value={x} onChange={e => setX(e.target.value)} placeholder={numero(mu)} /></div>}
          {pergunta === "entre" && (
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs text-vol-muted" htmlFor="calc-a">De (R$)</label><Input id="calc-a" className={campo} value={a} onChange={e => setA(e.target.value)} placeholder={numero(mu - sd)} /></div>
              <div><label className="text-xs text-vol-muted" htmlFor="calc-b">Até (R$)</label><Input id="calc-b" className={campo} value={b} onChange={e => setB(e.target.value)} placeholder={numero(mu + sd)} /></div>
            </div>
          )}
          {pergunta === "piso" && <div><label className="text-xs text-vol-muted" htmlFor="calc-c">Chance de ser atingido (%)</label><Input id="calc-c" className={campo} value={conf} onChange={e => setConf(e.target.value)} /></div>}
          <div className="rounded-xl bg-vol-ink p-4 text-sm text-vol-on-ink" aria-live="polite">{resposta}</div>
          <p className="text-xs text-vol-muted">Cálculo pela distribuição normal com a média e o desvio padrão da série (CDF e inversa da normal).</p>
        </div>
      </VolCard>
      <VolCard titulo={`Área correspondente — ${s.serie.nome}`}>
        <CurvasNormais series={[s]} pontos={config.pontosCurva} normalizar={false} destaque={destaque} altura={380} />
      </VolCard>
    </div>
  );
}
