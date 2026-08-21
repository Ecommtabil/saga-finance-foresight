import { Link, useRouterState } from "@tanstack/react-router";
import { AlertTriangle, Building2, Layers } from "lucide-react";
import { useSimpl } from "@/lib/simpl/store";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const ABAS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/modelagem-simplificada", label: "Dashboard", exact: true },
  { to: "/modelagem-simplificada/empresas", label: "Empresas & Cenários" },
  { to: "/modelagem-simplificada/importar", label: "Importar Planilha" },
  { to: "/modelagem-simplificada/premissas", label: "Premissas" },
  { to: "/modelagem-simplificada/receitas", label: "Receitas" },
  { to: "/modelagem-simplificada/pessoal", label: "Pessoal" },
  { to: "/modelagem-simplificada/opex", label: "OPEX" },
  { to: "/modelagem-simplificada/investimentos", label: "CAPEX" },
  { to: "/modelagem-simplificada/funding", label: "Funding" },
  { to: "/modelagem-simplificada/capital-giro", label: "Capital de Giro" },
  { to: "/modelagem-simplificada/demonstrativos", label: "Demonstrativos" },
  { to: "/modelagem-simplificada/valuation", label: "Valuation" },
];

export function SimplHeader() {
  const { empresas, empresa, cenario, selecionarEmpresa, selecionarCenario, avisos } = useSimpl();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-3">
        <div className="min-w-[220px] flex-1 space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" /> Cliente / Empresa
          </span>
          <Select value={empresa?.id ?? ""} onValueChange={selecionarEmpresa}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {empresas.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1 space-y-1">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Layers className="h-3.5 w-3.5" /> Cenário
          </span>
          <Select value={cenario?.id ?? ""} onValueChange={selecionarCenario}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {(empresa?.cenarios ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground">
          Regime:{" "}
          <span className="font-medium text-foreground">
            {empresa?.regime === "simples"
              ? `Simples Nacional (Anexo ${empresa.anexoSimples})`
              : empresa?.regime === "presumido"
                ? "Lucro Presumido"
                : "Lucro Real"}
          </span>
          {" · "}Horizonte:{" "}
          <span className="font-medium text-foreground">
            {cenario?.premissas.horizonteAnos ?? 0} anos
          </span>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {ABAS.map((a) => {
          const active = a.exact ? pathname === a.to : pathname.startsWith(a.to);
          return (
            <Link
              key={a.to}
              to={a.to as never}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {a.label}
            </Link>
          );
        })}
      </nav>

      {avisos.length > 0 && (
        <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/10 text-foreground">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-sm">Validações do modelo</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs">
              {avisos.slice(0, 5).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
