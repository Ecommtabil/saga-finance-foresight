import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ANEXOS, NOME_ANEXO, type AnexoId } from "@/lib/simples/tabelas";
import { mascaraCnpj } from "@/lib/simples/store";

export interface DadosCadastro { razaoSocial: string; cnpj: string; ano: number; anexos: AnexoId[] }

export function EmpresaForm({ aberto, onFechar, inicial, titulo, onSalvar }: {
  aberto: boolean; onFechar: () => void; inicial?: DadosCadastro; titulo: string; onSalvar: (d: DadosCadastro) => void;
}) {
  const vazio: DadosCadastro = { razaoSocial: "", cnpj: "", ano: new Date().getFullYear(), anexos: ["I"] };
  const [d, setD] = useState<DadosCadastro>(inicial ?? vazio);
  const [erro, setErro] = useState("");
  useEffect(() => { if (aberto) { setD(inicial ?? vazio); setErro(""); } }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps
  const alternar = (a: AnexoId) => setD((x) => ({ ...x, anexos: x.anexos.includes(a) ? x.anexos.filter((y) => y !== a) : ANEXOS.filter((y) => y === a || x.anexos.includes(y)) }));
  const salvar = () => {
    if (!d.razaoSocial.trim()) return setErro("Informe a razão social.");
    const dig = d.cnpj.replace(/\D/g, "");
    if (dig && dig.length !== 14) return setErro("CNPJ incompleto: são 14 dígitos.");
    if (!(d.ano >= 2018 && d.ano <= 2100)) return setErro("Ano-calendário inválido.");
    if (!d.anexos.length) return setErro("Selecione pelo menos um anexo.");
    onSalvar({ ...d, razaoSocial: d.razaoSocial.trim() });
  };
  return (
    <Dialog open={aberto} onOpenChange={(o) => !o && onFechar()}>
      <DialogContent className="via-tool max-w-lg font-[Inter,system-ui,sans-serif]">
        <DialogHeader>
          <DialogTitle className="text-via-ink">{titulo}</DialogTitle>
          <DialogDescription>Dados da empresa e anexos em que ela atua.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="sn-razao">Razão social</Label>
            <Input id="sn-razao" value={d.razaoSocial} onChange={(e) => setD({ ...d, razaoSocial: e.target.value })} placeholder="Ex.: Comercial Aurora Ltda." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="sn-cnpj">CNPJ</Label>
              <Input id="sn-cnpj" inputMode="numeric" value={d.cnpj} onChange={(e) => setD({ ...d, cnpj: mascaraCnpj(e.target.value) })} placeholder="00.000.000/0000-00" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="sn-ano">Ano-calendário</Label>
              <Input id="sn-ano" type="number" min={2018} max={2100} value={d.ano} onChange={(e) => setD({ ...d, ano: Number(e.target.value) })} />
            </div>
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Anexos em que a empresa atua</legend>
            <div className="flex flex-wrap gap-2">
              {ANEXOS.map((a) => {
                const on = d.anexos.includes(a);
                return (
                  <button key={a} type="button" role="checkbox" aria-checked={on} onClick={() => alternar(a)}
                    className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${on ? "border-via-ink bg-via-ink text-via-on-ink" : "border-via-border bg-via-surface text-via-muted hover:text-via-ink"}`}>
                    {NOME_ANEXO[a].replace("Anexo ", "")}
                  </button>
                );
              })}
            </div>
          </fieldset>
          {erro && <p role="alert" className="text-sm font-medium text-via-bad">{erro}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onFechar}>Cancelar</Button>
          <Button onClick={salvar} className="bg-via-ink text-via-on-ink hover:bg-via-ink/90">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
