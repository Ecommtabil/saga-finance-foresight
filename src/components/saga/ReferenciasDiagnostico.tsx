import { useState } from "react";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INDICADORES_DIAGNOSTICO, converterLimite, referenciasPadrao, textoReferencia, validarLimites,
  type IndicadorId, type ReferenciasDiagnostico,
} from "@/lib/saga/diagnostico-referencias";

function criarRascunho(referencias: ReferenciasDiagnostico) {
  return Object.fromEntries(INDICADORES_DIAGNOSTICO.map((i) => {
    const fator = i.percentual ? 100 : 1;
    return [i.id, {
      bom: String(Number((referencias[i.id].bom * fator).toFixed(8))).replace(".", ","),
      atencao: String(Number((referencias[i.id].atencao * fator).toFixed(8))).replace(".", ","),
    }];
  })) as Record<IndicadorId, { bom: string; atencao: string }>;
}

export function ReferenciasDiagnosticoEditor({ referencias, onSalvar }: {
  referencias: ReferenciasDiagnostico;
  onSalvar: (referencias: ReferenciasDiagnostico) => void;
}) {
  const [rascunho, setRascunho] = useState(() => criarRascunho(referencias));
  const [mensagem, setMensagem] = useState("");
  const proximas = referenciasPadrao();
  const erros: Partial<Record<IndicadorId, string>> = {};
  for (const i of INDICADORES_DIAGNOSTICO) {
    const limites = {
      bom: converterLimite(rascunho[i.id].bom, i.percentual),
      atencao: converterLimite(rascunho[i.id].atencao, i.percentual),
    };
    const erro = validarLimites(i.id, limites);
    if (erro) erros[i.id] = erro;
    else proximas[i.id] = limites;
  }
  const valido = Object.keys(erros).length === 0;

  return (
    <section className="space-y-4" aria-labelledby="referencias-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="referencias-titulo" className="text-base font-semibold">Referências dos indicadores</h2>
        <Button variant="outline" size="sm" onClick={() => {
          setRascunho(criarRascunho(referenciasPadrao()));
          setMensagem("");
        }}><RotateCcw className="mr-2 h-4 w-4" />Restaurar referências padrão</Button>
      </div>
      { ["Lucratividade", "Gestão", "Endividamento"].map((grupo) => (
        <div key={grupo}>
          <h3 className="border-b pb-2 text-sm font-semibold">{grupo}</h3>
          {INDICADORES_DIAGNOSTICO.filter((i) => i.grupo === grupo).map((i) => (
            <div key={i.id} className="grid gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_130px_130px]">
              <div className="min-w-0">
                <div className="text-sm font-medium">{i.titulo}</div>
                <div className="text-xs text-muted-foreground">{i.maiorMelhor ? "Quanto maior, melhor" : "Quanto menor, melhor"}</div>
                <p className="mt-1 text-xs text-muted-foreground">{textoReferencia(i.id, erros[i.id] ? referencias : proximas)}</p>
              </div>
              {(["atencao", "bom"] as const).map((campo) => (
                <label key={campo} className="space-y-1 text-xs text-muted-foreground">
                  <span>{campo === "bom" ? "Limite saudável" : "Limite de atenção"} ({i.percentual ? "%" : "x"})</span>
                  <Input inputMode="decimal" className="text-right tabular-nums" value={rascunho[i.id][campo]}
                    aria-label={`${i.titulo} — ${campo === "bom" ? "limite saudável" : "limite de atenção"}`}
                    aria-invalid={Boolean(erros[i.id])} aria-describedby={erros[i.id] ? `erro-${i.id}` : undefined}
                    onChange={(e) => {
                      const valor = e.target.value;
                      setRascunho((prev) => ({ ...prev, [i.id]: { ...prev[i.id], [campo]: valor } }));
                      setMensagem("");
                    }} />
                </label>
              ))}
              {erros[i.id] && <p id={`erro-${i.id}`} role="alert" className="text-xs text-destructive sm:col-span-3">{i.titulo}: {erros[i.id]}</p>}
            </div>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!valido} onClick={() => {
          onSalvar(proximas);
          setMensagem("Referências salvas neste projeto.");
        }}><Save className="mr-2 h-4 w-4" />Salvar referências</Button>
        <span role="status" className="text-sm text-muted-foreground">{mensagem}</span>
      </div>
    </section>
  );
}