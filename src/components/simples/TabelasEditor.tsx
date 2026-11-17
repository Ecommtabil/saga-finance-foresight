import { useState } from "react";
import { toast } from "sonner";
import { Copy, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bloco } from "@/components/viabilidade/ui";
import { useSimples } from "@/lib/simples/store";
import { ANEXOS, LIMITES_FAIXA, NOME_ANEXO, TRIBUTOS_ANEXO, somaPartilha, tabelaParaAno, tabelasPadrao, type AnexoId, type TabelasSimples, type Tributo } from "@/lib/simples/tabelas";
import { lerValor } from "@/lib/simples/importacao";
import { CaixaAlerta, Th } from "./ui";

const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

function CampoNumero({ valor, onChange, rotulo, largura = "w-20" }: { valor: number; onChange: (v: number) => void; rotulo: string; largura?: string }) {
  const [texto, setTexto] = useState<string | null>(null);
  return (
    <input aria-label={rotulo} inputMode="decimal" value={texto ?? fmt(valor)}
      onFocus={() => setTexto(fmt(valor))}
      onChange={(e) => { setTexto(e.target.value); const v = lerValor(e.target.value); if (v !== null && v >= 0) onChange(v); }}
      onBlur={() => setTexto(null)}
      className={`h-7 ${largura} rounded border border-via-border bg-via-input px-1.5 text-right text-xs tabular-nums text-via-ink outline-none focus:border-via-gold`} />
  );
}

export function TabelasEditor({ anoEmpresa, anexosEmpresa }: { anoEmpresa: number; anexosEmpresa: AnexoId[] }) {
  const { tabelasPorAno, definirTabelas, excluirTabelas } = useSimples();
  const vigente = tabelaParaAno(tabelasPorAno, anoEmpresa);
  const anos = Object.keys(tabelasPorAno).map(Number).sort((a, b) => b - a);
  const [ano, setAno] = useState<number>(vigente.ano);
  const anoValido = tabelasPorAno[String(ano)] ? ano : vigente.ano;
  const tabelas: TabelasSimples = tabelasPorAno[String(anoValido)] ?? vigente.tabelas;
  const [anexo, setAnexo] = useState<AnexoId>(anexosEmpresa[0] ?? "I");

  const alterar = (a: AnexoId, faixa: number, f: (x: TabelasSimples[AnexoId][number]) => TabelasSimples[AnexoId][number]) => {
    const nova: TabelasSimples = JSON.parse(JSON.stringify(tabelas));
    nova[a][faixa] = f(nova[a][faixa]);
    definirTabelas(anoValido, nova);
  };
  const criarVersao = () => {
    const proximo = Math.max(...anos, anoEmpresa) + (anos.includes(anoEmpresa) ? 1 : 0);
    const alvo = anos.includes(anoEmpresa) ? proximo : anoEmpresa;
    definirTabelas(alvo, tabelas);
    setAno(alvo);
    toast.success(`Versão ${alvo} criada a partir de ${anoValido}.`);
  };
  const trib = TRIBUTOS_ANEXO[anexo];
  const invalidas = ANEXOS.flatMap((a) => tabelas[a].map((f, i) => ({ a, i, s: somaPartilha(f) })).filter((x) => Math.abs(x.s - 100) > 0.005));

  return (
    <div className="space-y-6">
      <Bloco titulo="Tabelas do Simples Nacional" acao={
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(anoValido)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="h-9 w-36" aria-label="Versão da tabela"><SelectValue /></SelectTrigger>
            <SelectContent>{anos.map((a) => <SelectItem key={a} value={String(a)}>Versão {a}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={criarVersao}><Copy className="h-4 w-4" />Nova versão</Button>
          <Button variant="outline" size="sm" onClick={() => { definirTabelas(anoValido, tabelasPadrao()); toast.success("Valores da LC 123/2006 restaurados."); }}><RotateCcw className="h-4 w-4" />Restaurar LC 123</Button>
          {anos.length > 1 && <Button variant="outline" size="sm" onClick={() => { excluirTabelas(anoValido); setAno(vigente.ano); }}><Trash2 className="h-4 w-4" />Excluir versão</Button>}
        </div>
      }>
        <p className="text-sm text-via-muted">
          Cada versão vale a partir do seu ano. Esta empresa (ano {anoEmpresa}) usa a <strong className="text-via-ink">versão {vigente.ano}</strong>. As alterações são salvas na hora e recalculam todas as empresas que usam a versão.
        </p>
        {invalidas.length > 0 && (
          <div className="mt-3 space-y-1">
            {invalidas.map((x) => <CaixaAlerta key={`${x.a}${x.i}`} nivel="aviso">Anexo {x.a}, faixa {x.i + 1}: a partilha soma {fmt(x.s)}% (deveria ser 100%).</CaixaAlerta>)}
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-1" role="tablist" aria-label="Anexo da tabela">
          {ANEXOS.map((a) => (
            <button key={a} type="button" role="tab" aria-selected={anexo === a} onClick={() => setAnexo(a)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium ${anexo === a ? "bg-via-ink text-via-on-ink" : "bg-via-paper text-via-muted hover:text-via-ink"}`}>
              {NOME_ANEXO[a]}
            </button>
          ))}
        </div>
        <div className="sn-scroll mt-3">
          <table className="sn-table">
            <thead>
              <tr>
                <Th>Faixa</Th>
                <Th dica="Receita bruta em 12 meses (RBT12) até este valor.">RBT12 até</Th>
                <Th dica="Alíquota nominal da faixa, em %.">Alíquota (%)</Th>
                <Th dica="Parcela a deduzir da faixa, em R$.">Dedução (R$)</Th>
                {trib.map((t) => <Th key={t} dica={`Percentual de repartição do ${t} na faixa.`}>{t} (%)</Th>)}
                <Th dica="A partilha de cada faixa deve somar 100%.">Soma</Th>
              </tr>
            </thead>
            <tbody>
              {tabelas[anexo].map((f, i) => {
                const s = somaPartilha(f);
                return (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td className="text-via-muted">{LIMITES_FAIXA[i].toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td><CampoNumero rotulo={`Alíquota faixa ${i + 1}`} valor={f.aliquota} onChange={(v) => alterar(anexo, i, (x) => ({ ...x, aliquota: v }))} /></td>
                    <td><CampoNumero largura="w-28" rotulo={`Dedução faixa ${i + 1}`} valor={f.deducao} onChange={(v) => alterar(anexo, i, (x) => ({ ...x, deducao: v }))} /></td>
                    {trib.map((t: Tributo) => (
                      <td key={t}>
                        <CampoNumero rotulo={`${t} faixa ${i + 1}`} valor={f.partilha[t] ?? 0} onChange={(v) => alterar(anexo, i, (x) => ({ ...x, partilha: { ...x.partilha, [t]: v } }))} />
                        {t === "ISS" && i === 4 && <sup className="ml-0.5 text-via-gold" title="Teto do ISS de 5% efetivo">*</sup>}
                      </td>
                    ))}
                    <td className={Math.abs(s - 100) > 0.005 ? "font-bold text-[var(--sn-vermelho)]" : "text-via-good"}>{fmt(s)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-via-muted">
          {anexo === "III" || anexo === "IV" || anexo === "V" ? "(*) Teto do ISS de 5% efetivo: o excedente vai, de forma proporcional, para os tributos federais da mesma faixa. " : ""}
          Na faixa 6, {anexo === "I" || anexo === "II" ? "o ICMS" : "o ISS"} é recolhido fora do DAS.{anexo === "IV" ? " No Anexo IV a CPP não está no DAS (GPS/DCTFWeb)." : ""}
        </p>
      </Bloco>
    </div>
  );
}
