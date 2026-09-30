import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import * as XLSX from "xlsx";
import { Download, RefreshCw, RotateCw, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/saga/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useOrcamento } from "@/lib/orcamento/store";
import { baixarBlob } from "@/lib/orcamento/template";
import { MESES, TIPO_LABEL, type TipoConta } from "@/lib/orcamento/types";
import { fmtNum } from "@/lib/saga/formatters";

export const Route = createFileRoute("/orcamento/rolling")({
  head: () => ({
    meta: [
      { title: "Rolling Forecast — Janela rotativa de 12 meses | SAGA" },
      {
        name: "description",
        content:
          "Rolling forecast a partir do Base Zero: projete ou importe os próximos 12 meses e role a janela a cada mês fechado.",
      },
      { property: "og:title", content: "Rolling Forecast — Janela rotativa de 12 meses | SAGA" },
      {
        property: "og:description",
        content: "Previsão contínua de 12 meses que se renova a cada fechamento mensal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RollingPage,
});

interface LinhaRolling {
  id: string;
  grupo: string;
  conta: string;
  tipo: TipoConta;
  valores: number[]; // 12 posições da janela
}
interface Fechado {
  rotulo: string;
  previsto: number;
  realizado: number;
}
interface EstadoRolling {
  inicioMes: number; // 0-11
  inicioAno: number;
  linhas: LinhaRolling[];
  historico: Fechado[];
  crescimento: Record<TipoConta, number>;
}

const rotulo = (mes: number, ano: number, i: number) => {
  const m = (mes + i) % 12;
  const a = ano + Math.floor((mes + i) / 12);
  return `${MESES[m]}/${String(a).slice(2)}`;
};
const sinal = (t: TipoConta) => (t === "receita" ? 1 : -1);
const resultado = (linhas: LinhaRolling[], i: number) =>
  linhas.reduce((s, l) => s + sinal(l.tipo) * (l.valores[i] ?? 0), 0);

function RollingPage() {
  const { orcamento, orcamentos } = useOrcamento();
  const fileRef = useRef<HTMLInputElement>(null);
  const [estado, setEstado] = usePersistedState<EstadoRolling | null>(
    `saga.orcamento.rolling.${orcamento?.id ?? "x"}`,
    null,
  );
  const [cresc, setCresc] = useState<Record<TipoConta, number>>({
    receita: 10,
    custo: 8,
    despesa: 5,
    outros: 0,
  });
  const [inicio, setInicio] = useState(0);

  if (!orcamento) return null;

  /** Valor do Base Zero para um mês absoluto (busca o orçamento do ano correspondente). */
  const valorBase = (conta: string, grupo: string, mes: number, ano: number, g: number) => {
    const doAno = orcamentos.find((o) => o.ano === ano) ?? null;
    const l = doAno?.linhas.find((x) => x.conta === conta && x.grupo === grupo);
    if (l) return l.orcado[mes] ?? 0;
    const lb = orcamento.linhas.find((x) => x.conta === conta && x.grupo === grupo);
    const anos = ano - orcamento.ano;
    return Math.round((lb?.orcado[mes] ?? 0) * Math.pow(1 + g / 100, anos) * 100) / 100;
  };

  const gerarDoBaseZero = () => {
    if (orcamento.linhas.length === 0) return toast.error("Cadastre o Base Zero primeiro.");
    const linhas: LinhaRolling[] = orcamento.linhas.map((l) => ({
      id: l.id,
      grupo: l.grupo,
      conta: l.conta,
      tipo: l.tipo,
      valores: Array.from({ length: 12 }, (_, i) => {
        const m = (inicio + i) % 12;
        const a = orcamento.ano + Math.floor((inicio + i) / 12);
        return valorBase(l.conta, l.grupo, m, a, cresc[l.tipo]);
      }),
    }));
    setEstado({ inicioMes: inicio, inicioAno: orcamento.ano, linhas, historico: [], crescimento: cresc });
    toast.success("Janela de 12 meses gerada a partir do Base Zero.");
  };

  const rolar = () => {
    if (!estado) return;
    const { inicioMes, inicioAno, linhas } = estado;
    const lbAno = orcamentos.find((o) => o.ano === inicioAno);
    const real = linhas.reduce((s, l) => {
      const lb = lbAno?.linhas.find((x) => x.conta === l.conta && x.grupo === l.grupo);
      const r = lb?.realizado[inicioMes];
      return s + sinal(l.tipo) * (r ?? l.valores[0]);
    }, 0);
    const fechado: Fechado = {
      rotulo: rotulo(inicioMes, inicioAno, 0),
      previsto: resultado(linhas, 0),
      realizado: real,
    };
    const novoMes = inicioMes;
    const novoAnoMes = inicioAno + 1;
    const novas = linhas.map((l) => ({
      ...l,
      // mês que sai é reposto 12 meses à frente: mesmo mês do ano seguinte × crescimento
      valores: [
        ...l.valores.slice(1),
        Math.round(l.valores[0] * (1 + (estado.crescimento[l.tipo] ?? 0) / 100) * 100) / 100,
      ],
    }));
    void novoMes;
    void novoAnoMes;
    setEstado({
      ...estado,
      inicioMes: (inicioMes + 1) % 12,
      inicioAno: inicioMes === 11 ? inicioAno + 1 : inicioAno,
      linhas: novas,
      historico: [...estado.historico, fechado],
    });
    toast.success(`${fechado.rotulo} fechado. Novo mês adicionado ao fim da janela.`);
  };

  const exportar = () => {
    if (!estado) return;
    const cab = ["Grupo", "Conta", "Tipo", ...Array.from({ length: 12 }, (_, i) => rotulo(estado.inicioMes, estado.inicioAno, i))];
    const rows = estado.linhas.map((l) => [l.grupo, l.conta, TIPO_LABEL[l.tipo], ...l.valores]);
    const ws = XLSX.utils.aoa_to_sheet([cab, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rolling");
    const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
    baixarBlob(new Blob([out]), `SAGA_Rolling_${cab[3].replace("/", "-")}.xlsx`);
  };

  const importar = async (f: File) => {
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1 });
      const tipoDe = (s: string): TipoConta => {
        const n = s.toLowerCase();
        return n.startsWith("rec") ? "receita" : n.startsWith("cus") ? "custo" : n.startsWith("out") ? "outros" : "despesa";
      };
      const linhas: LinhaRolling[] = rows
        .slice(1)
        .filter((r) => r && r[1])
        .map((r, k) => ({
          id: `imp${k}`,
          grupo: String(r[0] ?? "Geral"),
          conta: String(r[1]),
          tipo: tipoDe(String(r[2] ?? "")),
          valores: Array.from({ length: 12 }, (_, i) => Number(String(r[3 + i] ?? 0).replace(",", ".")) || 0),
        }));
      if (!linhas.length) throw new Error("Nenhuma conta encontrada.");
      setEstado({
        inicioMes: estado?.inicioMes ?? inicio,
        inicioAno: estado?.inicioAno ?? orcamento.ano,
        linhas,
        historico: estado?.historico ?? [],
        crescimento: cresc,
      });
      toast.success(`${linhas.length} contas importadas na janela.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler planilha.");
    }
  };

  const editar = (id: string, i: number, v: string) =>
    estado &&
    setEstado({
      ...estado,
      linhas: estado.linhas.map((l) =>
        l.id === id ? { ...l, valores: l.valores.map((x, k) => (k === i ? Number(v.replace(",", ".")) || 0 : x)) } : l,
      ),
    });

  const colunas = estado ? Array.from({ length: 12 }, (_, i) => rotulo(estado.inicioMes, estado.inicioAno, i)) : [];
  const grafico = estado
    ? [
        ...estado.historico.map((h) => ({ mes: h.rotulo, Realizado: h.realizado, Previsto: h.previsto })),
        ...colunas.map((c, i) => ({ mes: c, Forecast: resultado(estado.linhas, i) })),
      ]
    : [];
  const totalJanela = estado ? colunas.reduce((s, _, i) => s + resultado(estado.linhas, i), 0) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Rolling Forecast"
        subtitulo="Parte do Base Zero, projeta ou importa os próximos 12 meses e rola a janela a cada mês fechado."
      />

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">1. Montar a janela de 12 meses</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Mês inicial ({orcamento.ano})</span>
            <select
              className="h-9 rounded-md border bg-background px-2 text-sm"
              value={inicio}
              onChange={(e) => setInicio(Number(e.target.value))}
            >
              {MESES.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
          </div>
          {(Object.keys(TIPO_LABEL) as TipoConta[]).map((t) => (
            <div key={t} className="w-28 space-y-1">
              <span className="text-xs font-medium text-muted-foreground">{TIPO_LABEL[t]} (% a.a.)</span>
              <Input className="h-9" type="number" value={cresc[t]} onChange={(e) => setCresc({ ...cresc, [t]: Number(e.target.value) || 0 })} />
            </div>
          ))}
          <Button size="sm" className="h-9" onClick={gerarDoBaseZero}>
            <Wand2 className="mr-2 h-4 w-4" /> Projetar do Base Zero
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Importar 12 meses
          </Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importar(f); e.target.value = ""; }} />
          {estado && (
            <Button size="sm" variant="outline" className="h-9" onClick={exportar}>
              <Download className="mr-2 h-4 w-4" /> Exportar / modelo
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            Meses que passam do ano do Base Zero usam o orçamento do ano seguinte, se existir; senão aplicam o crescimento informado.
            Planilha de importação: Grupo, Conta, Tipo e 12 colunas de meses.
          </p>
        </CardContent>
      </Card>

      {estado && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">2. Janela atual: {colunas[0]} a {colunas[11]}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" onClick={rolar}>
                  <RotateCw className="mr-2 h-4 w-4" /> Fechar {colunas[0]} e rolar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEstado(null)}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Reiniciar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Ao rolar, o primeiro mês é fechado com o realizado do Base Zero (ou o previsto, se não houver) e um novo mês é
                adicionado ao final, sempre mantendo 12 meses à frente. Resultado previsto da janela: <b>{fmtNum(totalJanela)}</b>
              </p>
              <div className="overflow-auto rounded-lg border bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left">Conta</th>
                      <th className="p-2 text-left">Tipo</th>
                      {colunas.map((c) => <th key={c} className="p-2 text-right">{c}</th>)}
                      <th className="p-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estado.linhas.map((l) => (
                      <tr key={l.id} className="border-t">
                        <td className="p-2 whitespace-nowrap">{l.grupo} · {l.conta}</td>
                        <td className="p-2">{TIPO_LABEL[l.tipo]}</td>
                        {l.valores.map((v, i) => (
                          <td key={i} className="p-1">
                            <Input className="h-7 w-20 text-right text-xs" value={v || ""} placeholder="0" onChange={(e) => editar(l.id, i, e.target.value)} />
                          </td>
                        ))}
                        <td className="p-2 text-right font-medium tabular-nums">{fmtNum(l.valores.reduce((s, v) => s + v, 0))}</td>
                      </tr>
                    ))}
                    <tr className="border-t bg-muted/40 font-semibold">
                      <td className="p-2" colSpan={2}>Resultado</td>
                      {colunas.map((c, i) => <td key={c} className="p-2 text-right tabular-nums">{fmtNum(resultado(estado.linhas, i))}</td>)}
                      <td className="p-2 text-right tabular-nums">{fmtNum(totalJanela)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Meses fechados × janela futura</CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={grafico}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={(v) => fmtNum(v)} />
                  <Tooltip formatter={(v: number) => fmtNum(v)} />
                  <Legend />
                  <Line dataKey="Realizado" stroke="var(--chart-1)" strokeWidth={2} />
                  <Line dataKey="Previsto" stroke="var(--chart-3)" strokeDasharray="4 4" />
                  <Line dataKey="Forecast" stroke="var(--chart-2)" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {estado.historico.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Histórico de fechamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-xs">
                  <thead><tr className="text-muted-foreground"><th className="text-left">Mês</th><th className="text-right">Previsto</th><th className="text-right">Realizado</th><th className="text-right">Desvio</th></tr></thead>
                  <tbody>
                    {estado.historico.map((h) => (
                      <tr key={h.rotulo} className="border-t">
                        <td className="py-1">{h.rotulo}</td>
                        <td className="text-right tabular-nums">{fmtNum(h.previsto)}</td>
                        <td className="text-right tabular-nums">{fmtNum(h.realizado)}</td>
                        <td className="text-right tabular-nums">{fmtNum(h.realizado - h.previsto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
