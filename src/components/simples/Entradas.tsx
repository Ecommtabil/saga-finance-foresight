import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, RotateCcw, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { Bloco } from "@/components/viabilidade/ui";
import { MES_CURTO, NOMES_MES, receitaAnexoMes, type Rbt12Mes } from "@/lib/simples/calculo";
import { AJUDA_COLUNA, COLUNAS_ANEXO, NOME_COLUNA, type AnexoId, type ColunaReceita } from "@/lib/simples/tabelas";
import type { EmpresaSimples } from "@/lib/simples/store";
import { brl, num2 } from "@/lib/simples/formato";
import { CampoMoeda, Th } from "./ui";

type Atualizar = (f: (e: EmpresaSimples) => EmpresaSimples) => void;
const avisoNegativo = () => toast.error("Valores negativos não são aceitos e foram ignorados.");

export function BlocoAnoAnterior({ empresa, atualizar }: { empresa: EmpresaSimples; atualizar: Atualizar }) {
  const total = empresa.anoAnterior.reduce((s, v) => s + v, 0);
  const colar = (inicio: number, m: (number | null)[][]) => {
    const valores = m.flat();
    let negativo = false;
    atualizar((e) => {
      const a = [...e.anoAnterior];
      valores.forEach((v, i) => {
        const idx = inicio + i;
        if (idx > 11 || v === null) return;
        if (v < 0) { negativo = true; return; }
        a[idx] = v;
      });
      return { ...e, anoAnterior: a };
    });
    if (negativo) avisoNegativo();
  };
  return (
    <Bloco titulo={`Receita bruta dos 12 meses do ano anterior (${empresa.ano - 1})`} acao={<span className="text-sm text-via-muted">Total: <strong className="tabular-nums text-via-ink">{brl(total)}</strong></span>}>
      <p className="mb-3 text-xs text-via-muted">Receita total da empresa (todos os anexos) em cada mês de {empresa.ano - 1}. Serve para calcular o RBT12 dos primeiros meses do ano. Dá para colar uma coluna ou linha do Excel a partir de qualquer mês.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {empresa.anoAnterior.map((v, i) => (
          <label key={i} className="space-y-1">
            <span className="text-[11px] font-medium text-via-muted">{MES_CURTO[i]}/{empresa.ano - 1}</span>
            <CampoMoeda compacto={false} rotulo={`Receita de ${NOMES_MES[i]} de ${empresa.ano - 1}`} valor={v}
              onChange={(n) => atualizar((e) => { const a = [...e.anoAnterior]; a[i] = n; return { ...e, anoAnterior: a }; })}
              onColarMatriz={(m) => colar(i, m)} />
          </label>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-via-border/70 bg-via-paper px-3 py-2.5">
        <label className="flex items-center gap-2 text-sm text-via-ink">
          <Checkbox checked={empresa.inicioAtividade} onCheckedChange={(c) => atualizar((e) => ({ ...e, inicioAtividade: c === true, mesInicio: e.mesInicio ?? `${e.ano}-01` }))} />
          Empresa em início de atividade
        </label>
        {empresa.inicioAtividade && (
          <label className="flex items-center gap-2 text-sm text-via-muted">
            Primeiro mês de atividade
            <input type="month" value={empresa.mesInicio ?? `${empresa.ano}-01`} max={`${empresa.ano}-12`}
              onChange={(ev) => atualizar((e) => ({ ...e, mesInicio: ev.target.value || null }))}
              className="h-8 rounded-md border border-via-border bg-via-input px-2 text-sm text-via-ink" />
          </label>
        )}
        <p className="text-xs text-via-muted">{empresa.inicioAtividade ? "RBT12 proporcional (LC 123, art. 18, §2º): média dos meses de atividade × 12; no 1º mês, a receita do próprio mês × 12." : "RBT12 = soma da receita dos 12 meses anteriores ao mês de apuração."}</p>
      </div>
    </Bloco>
  );
}

function CelulaRbt12({ empresa, mes, rbt, atualizar }: { empresa: EmpresaSimples; mes: number; rbt: Rbt12Mes; atualizar: Atualizar }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(rbt.valor);
  const manual = rbt.origem === "manual";
  const conf = empresa.conferenciaRbt12[`${empresa.ano}-${String(mes + 1).padStart(2, "0")}`];
  const divergente = conf && Math.abs(conf.valor - rbt.valor) > 1;
  const definir = (v: number | null) => atualizar((e) => { const r = [...e.rbt12Manual]; r[mes] = v; return { ...e, rbt12Manual: r }; });
  if (editando) {
    return (
      <div className="flex items-center justify-end gap-1">
        <CampoMoeda rotulo={`RBT12 manual de ${NOMES_MES[mes]}`} valor={valor} onChange={setValor} />
        <button type="button" aria-label="Confirmar RBT12 manual" onClick={() => { definir(valor); setEditando(false); }} className="rounded p-1 text-via-good hover:bg-via-paper"><Check className="h-4 w-4" /></button>
      </div>
    );
  }
  const origem = { calculado: "Calculado: soma dos 12 meses anteriores", manual: "Valor digitado manualmente", proporcional: `Proporcional: média de ${rbt.mesesAtividade} mês(es) de atividade × 12`, "primeiro-mes": "1º mês de atividade: receita do mês × 12", "sem-atividade": "Antes do início de atividade" }[rbt.origem];
  return (
    <div className="flex items-center justify-end gap-1">
      {divergente && (
        <Tooltip>
          <TooltipTrigger asChild><button type="button" aria-label="RBT12 diferente do PGDAS-D" className="text-[var(--sn-amarelo)]"><AlertTriangle className="h-3.5 w-3.5" /></button></TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs">RBT12 do PGDAS-D ({conf.arquivo}): {brl(conf.valor)}. Diferença de {brl(rbt.valor - conf.valor)}.</TooltipContent>
        </Tooltip>
      )}
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} className={`tabular-nums ${manual ? "font-semibold text-via-gold" : "text-via-ink"}`}>{manual && <Pencil className="mr-1 inline h-3 w-3" aria-label="Valor manual" />}{num2(rbt.valor)}</span>
        </TooltipTrigger>
        <TooltipContent className="text-xs">{origem}</TooltipContent>
      </Tooltip>
      {manual ? (
        <button type="button" aria-label={`Voltar ao RBT12 calculado de ${NOMES_MES[mes]}`} title="Voltar ao valor calculado" onClick={() => definir(null)} className="rounded p-1 text-via-muted hover:bg-via-paper hover:text-via-ink"><RotateCcw className="h-3.5 w-3.5" /></button>
      ) : (
        <button type="button" aria-label={`Editar manualmente o RBT12 de ${NOMES_MES[mes]}`} title="Editar manualmente" onClick={() => { setValor(rbt.valor); setEditando(true); }} className="rounded p-1 text-via-muted hover:bg-via-paper hover:text-via-ink"><Pencil className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

export function GradeAnexo({ empresa, anexo, rbt12, atualizar }: { empresa: EmpresaSimples; anexo: AnexoId; rbt12: Rbt12Mes[]; atualizar: Atualizar }) {
  const cols = COLUNAS_ANEXO[anexo];
  const definir = (mes: number, c: ColunaReceita, v: number) => atualizar((e) => {
    const g = [...(e.receitas[anexo] ?? [])];
    g[mes] = { ...(g[mes] ?? {}), [c]: v };
    return { ...e, receitas: { ...e.receitas, [anexo]: g } };
  });
  const colar = (mes0: number, col0: number, m: (number | null)[][]) => {
    let negativo = false;
    atualizar((e) => {
      const g = [...(e.receitas[anexo] ?? [])];
      m.forEach((linha, i) => linha.forEach((v, j) => {
        const mes = mes0 + i, c = cols[col0 + j];
        if (mes > 11 || !c || v === null) return;
        if (v < 0) { negativo = true; return; }
        g[mes] = { ...(g[mes] ?? {}), [c]: v };
      }));
      return { ...e, receitas: { ...e.receitas, [anexo]: g } };
    });
    if (negativo) avisoNegativo();
  };
  const totalCol = (c: ColunaReceita) => (empresa.receitas[anexo] ?? []).reduce((s, m) => s + (m?.[c] ?? 0), 0);
  return (
    <div className="sn-scroll">
      <table className="sn-table">
        <thead>
          <tr>
            <Th>Mês</Th>
            {cols.map((c) => <Th key={c} dica={AJUDA_COLUNA[c]}>{NOME_COLUNA[c]}</Th>)}
            <Th dica="Soma das colunas de receita deste anexo no mês.">Receita total</Th>
            <Th dica="Receita bruta da empresa toda nos 12 meses anteriores. Clique no lápis para digitar um valor manual.">RBT12</Th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 12 }, (_, mes) => (
            <tr key={mes}>
              <td>{MES_CURTO[mes]}/{String(empresa.ano).slice(2)}</td>
              {cols.map((c, j) => (
                <td key={c}>
                  <CampoMoeda rotulo={`${NOME_COLUNA[c]} de ${NOMES_MES[mes]}`} valor={empresa.receitas[anexo]?.[mes]?.[c] ?? 0}
                    onChange={(v) => definir(mes, c, v)} onColarMatriz={(m) => colar(mes, j, m)} />
                </td>
              ))}
              <td className="font-semibold text-via-ink">{num2(receitaAnexoMes(empresa, anexo, mes))}</td>
              <td><CelulaRbt12 empresa={empresa} mes={mes} rbt={rbt12[mes]} atualizar={atualizar} /></td>
            </tr>
          ))}
          <tr className="sn-total">
            <td>Totais</td>
            {cols.map((c) => <td key={c}>{num2(totalCol(c))}</td>)}
            <td>{num2(cols.reduce((s, c) => s + totalCol(c), 0))}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
