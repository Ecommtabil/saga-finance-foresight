import { Fragment, useState } from "react";
import { Plus, RotateCcw, Trash2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanejamento } from "@/lib/pob/store";
import { MESES_POB, uid } from "@/lib/pob/types";
import {
  evolucaoEmprestimo,
  parametrosPadrao,
  type CapexItem,
  type EmprestimoItem,
  type ParametrosPOB,
} from "@/lib/pob/parametros";
import { fmtMoney, fmtNum } from "@/lib/saga/formatters";

type Tipo = "pct" | "moeda" | "num";
const SUFIXO: Record<Tipo, string> = { pct: "%", moeda: "R$", num: "" };

function Campo({
  label,
  valor,
  tipo,
  onChange,
  ajuda,
  erro,
  min = 0,
  max,
}: {
  label: string;
  valor: number;
  tipo: Tipo;
  onChange: (v: number) => void;
  ajuda?: string;
  erro?: string;
  min?: number;
  max?: number;
}) {
  const mx = max ?? (tipo === "pct" ? 100 : undefined);
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        {tipo === "moeda" && (
          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            R$
          </span>
        )}
        <Input
          type="number"
          step="any"
          min={min}
          max={mx}
          className={`h-9 tabular-nums ${tipo === "moeda" ? "pl-8" : ""} ${tipo === "pct" ? "pr-7" : ""} ${erro ? "border-destructive" : ""}`}
          value={Number.isFinite(valor) ? valor : 0}
          onChange={(e) => {
            let v = Number(e.target.value);
            if (!Number.isFinite(v)) v = 0;
            if (v < min) v = min;
            if (mx !== undefined && v > mx) v = mx;
            onChange(v);
          }}
        />
        {tipo === "pct" && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            {SUFIXO.pct}
          </span>
        )}
      </div>
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : ajuda ? (
        <p className="text-xs text-muted-foreground">{ajuda}</p>
      ) : null}
    </div>
  );
}

const Grade = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

export function PremissasEditor() {
  const { cenario, atualizar } = usePlanejamento();
  const [abertos, setAbertos] = useState<string[]>(["vendas"]);
  if (!cenario) return null;
  const p: ParametrosPOB = cenario.parametros ?? parametrosPadrao(cenario.ano);
  const moeda = cenario.moeda ?? "R$";

  const set = <K extends keyof ParametrosPOB>(k: K, v: ParametrosPOB[K]) =>
    atualizar({ parametros: { ...p, [k]: v } });
  const grp =
    <K extends "vendas" | "impostos" | "producao" | "compras" | "mod" | "cif" | "despesas">(k: K) =>
    (campo: keyof ParametrosPOB[K], v: number) =>
      set(k, { ...p[k], [campo]: v });

  const vendas = grp("vendas");
  const imp = grp("impostos");
  const prod = grp("producao");
  const comp = grp("compras");
  const mod = grp("mod");
  const cif = grp("cif");
  const desp = grp("despesas");

  const setCapex = (id: string, patch: Partial<CapexItem>) =>
    set("capex", p.capex.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const setEmp = (id: string, patch: Partial<EmprestimoItem>) =>
    set("emprestimos", p.emprestimos.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const encargosHora = (p.mod.salarioHora * p.mod.encargosPct) / 100;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Premissas do modelo</CardTitle>
          <CardDescription>
            Parâmetros editáveis do cenário “{cenario.nome}”. Valores de exemplo já vêm preenchidos; tudo é
            salvo automaticamente neste cenário.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => atualizar({ parametros: parametrosPadrao(cenario.ano) })}
        >
          <RotateCcw className="mr-2 h-4 w-4" /> Restaurar padrão
        </Button>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" value={abertos} onValueChange={setAbertos} className="space-y-2">
          <AccordionItem value="vendas" className="rounded-lg border px-4">
            <AccordionTrigger>Vendas</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Crescimento de volume projetado" tipo="pct" valor={p.vendas.crescVolume} onChange={(v) => vendas("crescVolume", v)} max={1000} />
                <Campo label="Crescimento de preço projetado" tipo="pct" valor={p.vendas.crescPreco} onChange={(v) => vendas("crescPreco", v)} max={1000} />
                <div />
                <Campo
                  label="% recebido no mesmo mês"
                  tipo="pct"
                  valor={p.vendas.recebeMesmoMes}
                  onChange={(v) => set("vendas", { ...p.vendas, recebeMesmoMes: v, recebeMesSeguinte: 100 - v })}
                  ajuda="O mês seguinte é ajustado para fechar 100%."
                />
                <Campo
                  label="% recebido no mês seguinte"
                  tipo="pct"
                  valor={p.vendas.recebeMesSeguinte}
                  onChange={(v) => set("vendas", { ...p.vendas, recebeMesSeguinte: v, recebeMesmoMes: 100 - v })}
                />
              </Grade>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="impostos" className="rounded-lg border px-4">
            <AccordionTrigger>Impostos</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Alíquota PIS" tipo="pct" valor={p.impostos.pis} onChange={(v) => imp("pis", v)} />
                <Campo label="Alíquota COFINS" tipo="pct" valor={p.impostos.cofins} onChange={(v) => imp("cofins", v)} />
                <Campo label="Alíquota ICMS" tipo="pct" valor={p.impostos.icms} onChange={(v) => imp("icms", v)} />
              </Grade>
              <p className="mt-3 text-xs text-muted-foreground">
                Carga total sobre a receita: {fmtNum(p.impostos.pis + p.impostos.cofins + p.impostos.icms)}%
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="producao" className="rounded-lg border px-4">
            <AccordionTrigger>Produção</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Capacidade produtiva mensal (un.)" tipo="num" valor={p.producao.capacidadeMensal} onChange={(v) => prod("capacidadeMensal", v)} />
                <Campo label="Estoque inicial de produto acabado (un.)" tipo="num" valor={p.producao.estoqueInicialPA} onChange={(v) => prod("estoqueInicialPA", v)} />
                <Campo label="Estoque final desejado de PA (% venda mês seguinte)" tipo="pct" valor={p.producao.estoqueFinalPAPct} onChange={(v) => prod("estoqueFinalPAPct", v)} />
                <Campo label="Estoque final de PA no fim do ano (un.)" tipo="num" valor={p.producao.estoqueFinalPAAno} onChange={(v) => prod("estoqueFinalPAAno", v)} />
                <Campo label="Matéria-prima por unidade de produto" tipo="num" valor={p.producao.mpPorUnidade} onChange={(v) => prod("mpPorUnidade", v)} />
                <Campo label="Estoque final desejado de MP (% necessidade mês seguinte)" tipo="pct" valor={p.producao.estoqueFinalMPPct} onChange={(v) => prod("estoqueFinalMPPct", v)} />
                <Campo label="Estoque inicial de matéria-prima (un.)" tipo="num" valor={p.producao.estoqueInicialMP} onChange={(v) => prod("estoqueInicialMP", v)} />
              </Grade>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="compras" className="rounded-lg border px-4">
            <AccordionTrigger>Compras de matéria-prima</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Custo unitário da matéria-prima" tipo="moeda" valor={p.compras.custoUnitarioMP} onChange={(v) => comp("custoUnitarioMP", v)} />
                <Campo
                  label="% pago no mesmo mês"
                  tipo="pct"
                  valor={p.compras.pagaMesmoMes}
                  onChange={(v) => set("compras", { ...p.compras, pagaMesmoMes: v, pagaMesSeguinte: 100 - v })}
                  ajuda="O mês seguinte é ajustado para fechar 100%."
                />
                <Campo
                  label="% pago no mês seguinte"
                  tipo="pct"
                  valor={p.compras.pagaMesSeguinte}
                  onChange={(v) => set("compras", { ...p.compras, pagaMesSeguinte: v, pagaMesmoMes: 100 - v })}
                />
              </Grade>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="mod" className="rounded-lg border px-4">
            <AccordionTrigger>Mão de obra direta (MOD)</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Horas de MOD por unidade" tipo="num" valor={p.mod.horasPorUnidade} onChange={(v) => mod("horasPorUnidade", v)} />
                <Campo label="Salário por hora de MOD" tipo="moeda" valor={p.mod.salarioHora} onChange={(v) => mod("salarioHora", v)} />
                <Campo
                  label="Encargos sobre a hora de MOD"
                  tipo="pct"
                  max={500}
                  valor={p.mod.encargosPct}
                  onChange={(v) => mod("encargosPct", v)}
                  ajuda={`Encargos por hora: ${fmtMoney(encargosHora, moeda)} · custo total/hora: ${fmtMoney(p.mod.salarioHora + encargosHora, moeda)}`}
                />
                <Campo
                  label="Horas trabalhadas por funcionário/mês"
                  tipo="num"
                  valor={p.mod.horasFuncionarioMes}
                  onChange={(v) => mod("horasFuncionarioMes", v)}
                  ajuda="Padrão: 40h × 4 semanas = 160h."
                />
              </Grade>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="cif" className="rounded-lg border px-4">
            <AccordionTrigger>Custos indiretos de fabricação (CIF)</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Materiais indiretos por hora de MOD" tipo="moeda" valor={p.cif.materiaisIndiretosHora} onChange={(v) => cif("materiaisIndiretosHora", v)} />
                <Campo label="Mão de obra indireta fixa (mês)" tipo="moeda" valor={p.cif.moiFixa} onChange={(v) => cif("moiFixa", v)} />
                <Campo label="Outros custos indiretos fixos (mês)" tipo="moeda" valor={p.cif.outrosFixos} onChange={(v) => cif("outrosFixos", v)} />
                <Campo label="Depreciação fabril (mês)" tipo="moeda" valor={p.cif.depreciacaoFabril} onChange={(v) => cif("depreciacaoFabril", v)} />
              </Grade>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="despesas" className="rounded-lg border px-4">
            <AccordionTrigger>Despesas operacionais</AccordionTrigger>
            <AccordionContent>
              <Grade>
                <Campo label="Salários administrativos (mês)" tipo="moeda" valor={p.despesas.salariosAdm} onChange={(v) => desp("salariosAdm", v)} />
                <Campo label="Aluguel do escritório (mês)" tipo="moeda" valor={p.despesas.aluguel} onChange={(v) => desp("aluguel", v)} />
                <Campo label="Energia elétrica do escritório (mês)" tipo="moeda" valor={p.despesas.energia} onChange={(v) => desp("energia", v)} />
                <Campo label="Material de escritório (mês)" tipo="moeda" valor={p.despesas.materialEscritorio} onChange={(v) => desp("materialEscritorio", v)} />
                <Campo label="Viagens e locomoção (mês)" tipo="moeda" valor={p.despesas.viagens} onChange={(v) => desp("viagens", v)} />
                <Campo label="Outras despesas fixas (mês)" tipo="moeda" valor={p.despesas.outrasFixas} onChange={(v) => desp("outrasFixas", v)} />
                <Campo label="Depreciação administrativa (mês)" tipo="moeda" valor={p.despesas.depreciacaoAdm} onChange={(v) => desp("depreciacaoAdm", v)} />
                <Campo label="Propaganda (% receita líquida)" tipo="pct" valor={p.despesas.propagandaPct} onChange={(v) => desp("propagandaPct", v)} />
                <Campo label="Comissão de vendas (% receita líquida)" tipo="pct" valor={p.despesas.comissaoPct} onChange={(v) => desp("comissaoPct", v)} />
              </Grade>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="capex" className="rounded-lg border px-4">
            <AccordionTrigger>Investimentos (CAPEX)</AccordionTrigger>
            <AccordionContent>
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left">Nome do bem</th>
                      <th className="p-2 text-right">Valor (R$)</th>
                      <th className="p-2 text-left">Mês de aquisição</th>
                      <th className="p-2 text-right">Vida útil (meses)</th>
                      <th className="p-2 text-right">Meses p/ pagamento</th>
                      <th className="p-2 text-right">Depreciação mensal</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {p.capex.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-1"><Input className="h-8 text-xs" value={c.nome} maxLength={80} onChange={(e) => setCapex(c.id, { nome: e.target.value })} /></td>
                        <td className="p-1"><Input type="number" min={0} className="h-8 w-28 text-right text-xs" value={c.valor} onChange={(e) => setCapex(c.id, { valor: Math.max(0, Number(e.target.value) || 0) })} /></td>
                        <td className="p-1">
                          <Select value={String(c.mes)} onValueChange={(v) => setCapex(c.id, { mes: Number(v) })}>
                            <SelectTrigger className="h-8 w-24 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{MESES_POB.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="p-1"><Input type="number" min={1} className="h-8 w-24 text-right text-xs" value={c.vidaUtilMeses} onChange={(e) => setCapex(c.id, { vidaUtilMeses: Math.max(1, Math.round(Number(e.target.value) || 1)) })} /></td>
                        <td className="p-1">
                          <Input type="number" min={0} className="h-8 w-24 text-right text-xs" value={c.mesesPagamento} onChange={(e) => setCapex(c.id, { mesesPagamento: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                          {c.mesesPagamento === 0 && <span className="text-[10px] text-muted-foreground">à vista</span>}
                        </td>
                        <td className="p-2 text-right font-medium tabular-nums">{fmtMoney(c.valor / Math.max(1, c.vidaUtilMeses), moeda)}</td>
                        <td className="p-1"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => set("capex", p.capex.filter((x) => x.id !== c.id))}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => set("capex", [...p.capex, { id: uid(), nome: "Novo bem", valor: 0, mes: 1, vidaUtilMeses: 60, mesesPagamento: 0 }])}>
                <Plus className="mr-2 h-4 w-4" /> Adicionar bem
              </Button>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="emprestimos" className="rounded-lg border px-4">
            <AccordionTrigger>Empréstimos</AccordionTrigger>
            <AccordionContent className="space-y-4">
              {p.emprestimos.map((e) => {
                const ev = evolucaoEmprestimo(e);
                return (
                  <div key={e.id} className="space-y-3 rounded-md border p-3">
                    <div className="flex items-center gap-2">
                      <Input className="h-8 max-w-xs text-sm font-medium" value={e.nome} maxLength={60} onChange={(x) => setEmp(e.id, { nome: x.target.value })} />
                      <Select value={e.tipo} onValueChange={(v) => setEmp(e.id, { tipo: v as EmprestimoItem["tipo"] })}>
                        <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="existente">Existente</SelectItem>
                          <SelectItem value="novo">Novo</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => set("emprestimos", p.emprestimos.filter((x) => x.id !== e.id))}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <Campo label={e.tipo === "novo" ? "Valor do novo empréstimo" : "Saldo devedor inicial"} tipo="moeda" valor={e.valor} onChange={(v) => setEmp(e.id, { valor: v })} />
                      <div className="space-y-1">
                        <Label className="text-xs">Data de início</Label>
                        <Input type="month" className="h-9" value={e.dataInicio} onChange={(x) => setEmp(e.id, { dataInicio: x.target.value })} />
                      </div>
                      {e.tipo === "novo" ? (
                        <div className="space-y-1">
                          <Label className="text-xs">Mês de contratação</Label>
                          <Select value={String(e.mesContratacao)} onValueChange={(v) => setEmp(e.id, { mesContratacao: Number(v) })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>{MESES_POB.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      ) : <div className="hidden lg:block" />}
                      <Campo label="Juros mensal" tipo="pct" valor={e.jurosMensalPct} onChange={(v) => setEmp(e.id, { jurosMensalPct: v })} />
                      <div className="space-y-1">
                        <Label className="text-xs">Amortização</Label>
                        <div className="flex gap-1">
                          <Select value={e.modoAmortizacao} onValueChange={(v) => setEmp(e.id, { modoAmortizacao: v as EmprestimoItem["modoAmortizacao"] })}>
                            <SelectTrigger className="h-9 w-24 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="valor">R$/mês</SelectItem>
                              <SelectItem value="parcelas">Parcelas</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input type="number" min={0} className="h-9 text-right" value={e.amortizacao} onChange={(x) => setEmp(e.id, { amortizacao: Math.max(0, Number(x.target.value) || 0) })} />
                        </div>
                      </div>
                    </div>
                    <div className="overflow-auto">
                      <table className="w-full text-xs tabular-nums">
                        <thead className="bg-muted/60">
                          <tr>
                            <th className="p-1.5 text-left">Conta</th>
                            {MESES_POB.map((m) => <th key={m} className="p-1.5 text-right">{m}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {([["Saldo inicial", "saldoInicial"], ["Juros", "juros"], ["Amortização", "amortizacao"], ["Saldo final", "saldoFinal"]] as const).map(([rot, k]) => (
                            <Fragment key={k}>
                              <tr className="border-t">
                                <td className="p-1.5 font-medium">{rot}</td>
                                {ev.map((l) => <td key={l.mes} className="p-1.5 text-right">{fmtNum(l[k])}</td>)}
                              </tr>
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  set("emprestimos", [
                    ...p.emprestimos,
                    { id: uid(), nome: `Empréstimo ${p.emprestimos.length + 1}`, tipo: "novo", valor: 0, dataInicio: `${cenario.ano}-01`, mesContratacao: 1, jurosMensalPct: 1.5, modoAmortizacao: "parcelas", amortizacao: 12 },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Adicionar empréstimo
              </Button>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
