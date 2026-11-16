import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatarCnpj, type CabecalhoEstudo } from "@/lib/viabilidade/estado";

export function CabecalhoEstudoForm({ valor, onChange }: { valor: CabecalhoEstudo; onChange: (v: CabecalhoEstudo) => void }) {
  const set = (k: keyof CabecalhoEstudo, v: string) => onChange({ ...valor, [k]: v });
  const campos: Array<{ k: keyof CabecalhoEstudo; rotulo: string; placeholder?: string; type?: string; mask?: (s: string) => string; inputMode?: "numeric" }> = [
    { k: "cliente", rotulo: "Cliente", placeholder: "Razão social ou nome" },
    { k: "cnpj", rotulo: "CNPJ", placeholder: "00.000.000/0000-00", mask: formatarCnpj, inputMode: "numeric" },
    { k: "responsavel", rotulo: "Responsável técnico", placeholder: "Nome do consultor" },
    { k: "dataBase", rotulo: "Data-base", type: "date" },
  ];
  return (
    <div className="grid gap-3 rounded-xl border border-via-border bg-via-surface p-4 shadow-[var(--via-shadow)] sm:grid-cols-2 lg:grid-cols-4">
      {campos.map((c) => (
        <div key={c.k} className="space-y-1">
          <Label htmlFor={`via-cab-${c.k}`} className="text-xs font-medium text-via-muted">{c.rotulo}</Label>
          <Input id={`via-cab-${c.k}`} type={c.type ?? "text"} inputMode={c.inputMode} placeholder={c.placeholder} value={valor[c.k]}
            onChange={(e) => set(c.k, c.mask ? c.mask(e.target.value) : e.target.value)}
            className="h-9 border-via-border bg-via-surface text-via-ink" />
        </div>
      ))}
    </div>
  );
}
