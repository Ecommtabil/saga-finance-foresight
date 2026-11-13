import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CONFIG_PADRAO, numero, type ConfigVolatilidade } from "@/lib/volatilidade/dados";
import { VolCard } from "./ui";

const campo = "border-vol-border bg-vol-surface text-vol-text";

function CampoNumero({ id, rotulo, valor, onChange, min, max, ajuda }: { id: string; rotulo: string; valor: number; onChange: (v: number) => void; min: number; max: number; ajuda?: string }) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-vol-text">{rotulo}</label>
      <Input id={id} type="number" min={min} max={max} step="any" className={`${campo} mt-1`} defaultValue={valor} key={valor}
        onBlur={e => { const n = Number(e.target.value); if (Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n))); }} />
      {ajuda && <p className="mt-1 text-xs text-vol-muted">{ajuda}</p>}
    </div>
  );
}

export function ConfiguracoesTab({ config, onChange }: { config: ConfigVolatilidade; onChange: (c: Partial<ConfigVolatilidade>) => void }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <VolCard titulo="Classificação da volatilidade (CV)">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero id="cfg-baixo" rotulo="Baixa até (%)" valor={Number(numero(config.cvBaixo * 100, 1).replace(",", "."))} min={0.1} max={100}
            onChange={v => onChange({ cvBaixo: v / 100, cvModerado: Math.max(config.cvModerado, v / 100) })} ajuda="Verde: CV menor ou igual a este limite." />
          <CampoNumero id="cfg-moderado" rotulo="Moderada até (%)" valor={Number(numero(config.cvModerado * 100, 1).replace(",", "."))} min={0.1} max={200}
            onChange={v => onChange({ cvModerado: Math.max(v / 100, config.cvBaixo) })} ajuda="Amarelo até este limite; vermelho acima (alta volatilidade)." />
        </div>
      </VolCard>
      <VolCard titulo="Cálculos e gráficos">
        <div className="grid gap-4 sm:grid-cols-2">
          <CampoNumero id="cfg-pontos" rotulo="Pontos da curva normal" valor={config.pontosCurva} min={20} max={1000} onChange={v => onChange({ pontosCurva: Math.round(v) })} ajuda="Padrão: 200." />
          <CampoNumero id="cfg-conf" rotulo="Confiança do piso de segurança (%)" valor={Number(numero(config.confianca * 100, 1).replace(",", "."))} min={50} max={99.9} onChange={v => onChange({ confianca: v / 100 })} ajuda="Usado na calculadora. Padrão: 95%." />
        </div>
        <div className="mt-5 space-y-3">
          <label className="flex items-center gap-3 text-sm text-vol-text"><Switch checked={config.mostrarMomentos} onCheckedChange={v => onChange({ mostrarMomentos: v })} aria-label="Mostrar assimetria e curtose" />Mostrar assimetria e curtose</label>
          <label className="flex items-center gap-3 text-sm text-vol-text"><Switch checked={config.escuro} onCheckedChange={v => onChange({ escuro: v })} aria-label="Modo escuro" />Modo escuro</label>
        </div>
      </VolCard>
      <div className="lg:col-span-2"><Button variant="outline" onClick={() => onChange(CONFIG_PADRAO)}><RotateCcw />Restaurar padrões</Button></div>
    </div>
  );
}
