import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/saga/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrcamento } from "@/lib/orcamento/store";
import { baixarBlob, gerarModeloOrcamento, lerModeloOrcamento } from "@/lib/orcamento/template";
import { MESES, TIPO_LABEL, type TipoConta } from "@/lib/orcamento/types";
import { fmtNum } from "@/lib/saga/formatters";

export const Route = createFileRoute("/orcamento/dados")({ component: DadosPage });

function DadosPage() {
  const { orcamento, substituirLinhas, adicionarLinha, atualizarLinha, removerLinha } = useOrcamento();
  const fileRef = useRef<HTMLInputElement>(null);
  const [avisos, setAvisos] = useState<string[]>([]);

  if (!orcamento) return null;

  const importar = async (file: File) => {
    try {
      const r = await lerModeloOrcamento(file);
      substituirLinhas(r.linhas);
      setAvisos(r.avisos);
      const real = r.resumo.find((x) => x.aba === "Realizado")?.itens ?? 0;
      toast.success(`${r.linhas.length} contas importadas · ${real} com realizado.`);

    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler a planilha.");
    }
  };

  const editarValor = (
    id: string,
    campo: "orcado" | "realizado",
    mes: number,
    valor: string,
  ) => {
    const linha = orcamento.linhas.find((l) => l.id === id);
    if (!linha) return;
    if (campo === "orcado") {
      const arr = [...linha.orcado];
      arr[mes] = Number(valor.replace(",", ".")) || 0;
      atualizarLinha(id, { orcado: arr });
    } else {
      const arr = [...linha.realizado];
      arr[mes] = valor.trim() === "" ? null : Number(valor.replace(",", ".")) || 0;
      atualizarLinha(id, { realizado: arr });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Dados do orçamento"
        subtitulo="Importe a planilha modelo ou edite as contas diretamente na grade."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                baixarBlob(gerarModeloOrcamento(orcamento), `SAGA_Orcamento_${orcamento.ano}.xlsx`)
              }
            >
              <Download className="mr-2 h-4 w-4" /> Baixar planilha modelo
            </Button>
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Importar planilha
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void importar(f);
                e.target.value = "";
              }}
            />
          </div>
        }
      />

      {avisos.length > 0 && (
        <Card className="border-amber-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Avisos da importação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-xs text-muted-foreground">
            {avisos.map((a, i) => (
              <p key={i}>• {a}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {orcamento.linhas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma conta cadastrada. Baixe a planilha modelo, preencha o orçado e o realizado e
              faça o upload aqui.
            </p>
            <Button variant="outline" onClick={adicionarLinha}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar conta manualmente
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="orcado">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="orcado">Orçado</TabsTrigger>
              <TabsTrigger value="realizado">Realizado</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm" onClick={adicionarLinha}>
              <Plus className="mr-2 h-4 w-4" /> Nova conta
            </Button>
          </div>
          {(["orcado", "realizado"] as const).map((campo) => (
            <TabsContent key={campo} value={campo}>
              <div className="overflow-auto rounded-lg border bg-card">
                <table className="w-full text-xs">
                  <thead className="bg-muted/60">
                    <tr>
                      <th className="p-2 text-left">Grupo</th>
                      <th className="p-2 text-left">Conta</th>
                      <th className="p-2 text-left">Tipo</th>
                      {MESES.map((m) => (
                        <th key={m} className="p-2 text-right">
                          {m}
                        </th>
                      ))}
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {orcamento.linhas.map((l) => {
                      const total =
                        campo === "orcado"
                          ? l.orcado.reduce((s, v) => s + v, 0)
                          : l.realizado.reduce<number>((s, v) => s + (v ?? 0), 0);
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="p-1">
                            <Input
                              className="h-7 w-28 text-xs"
                              value={l.grupo}
                              onChange={(e) => atualizarLinha(l.id, { grupo: e.target.value })}
                            />
                          </td>
                          <td className="p-1">
                            <Input
                              className="h-7 w-40 text-xs"
                              value={l.conta}
                              onChange={(e) => atualizarLinha(l.id, { conta: e.target.value })}
                            />
                          </td>
                          <td className="p-1">
                            <Select
                              value={l.tipo}
                              onValueChange={(v) => atualizarLinha(l.id, { tipo: v as TipoConta })}
                            >
                              <SelectTrigger className="h-7 w-28 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(TIPO_LABEL).map(([k, v]) => (
                                  <SelectItem key={k} value={k}>
                                    {v}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          {MESES.map((m, i) => (
                            <td key={m} className="p-1">
                              <Input
                                className="h-7 w-20 text-right text-xs"
                                value={
                                  campo === "orcado"
                                    ? (l.orcado[i] ?? 0) || ""
                                    : (l.realizado[i] ?? "")
                                }
                                placeholder={campo === "realizado" ? "—" : "0"}
                                onChange={(e) => editarValor(l.id, campo, i, e.target.value)}
                              />
                            </td>
                          ))}
                          <td className="p-2 text-right font-medium tabular-nums">
                            {fmtNum(total)}
                          </td>
                          <td className="p-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => removerLinha(l.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}
