import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Upload, ArrowDownUp, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/saga/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSaga } from "@/lib/saga/context";
import { fmtMoney, fmtNum } from "@/lib/saga/formatters";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AJUSTES_ZERO,
  CATEGORIAS,
  lerOFX,
  montarDFC,
  reverterParaLucro,
  type AjustesReversos,
  type CategoriaDFC,
  type TransacaoOFX,
} from "@/lib/saga/ofx";

export const Route = createFileRoute("/fluxo-reverso")({
  head: () => ({
    meta: [
      { title: "Fluxo de Caixa Reverso — SAGA" },
      {
        name: "description",
        content:
          "Importe o extrato OFX, classifique as movimentações no modelo DFC e percorra o caminho inverso do fluxo indireto até o lucro líquido.",
      },
      { property: "og:title", content: "Fluxo de Caixa Invertido (Reverso) — SAGA" },
      {
        property: "og:description",
        content: "Do extrato bancário ao lucro líquido: DFC classificada e ponte reversa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FluxoReversoPage,
});

const AJUSTES_LABELS: { key: keyof AjustesReversos; label: string; hint: string }[] = [
  { key: "depreciacao", label: "Depreciação e amortização", hint: "Despesa não-caixa somada no indireto" },
  { key: "outrosNaoCaixa", label: "Outros itens não-caixa", hint: "Provisões, equivalência, impairment" },
  { key: "varContasReceber", label: "Variação de contas a receber", hint: "Aumento do saldo = valor positivo" },
  { key: "varEstoques", label: "Variação de estoques", hint: "Aumento do saldo = valor positivo" },
  { key: "varFornecedores", label: "Variação de fornecedores", hint: "Aumento do saldo = valor positivo" },
  { key: "varOutrosPassivos", label: "Variação de outros passivos", hint: "Salários, impostos a pagar" },
  { key: "jurosFinanceiros", label: "Resultado financeiro reclassificado", hint: "Juros tratados como financiamento" },
];

function FluxoReversoPage() {
  const { dados, empresa } = useSaga();
  const moeda = empresa?.moeda ?? "R$";
  const inputRef = useRef<HTMLInputElement>(null);
  const [txs, setTxs] = useState<TransacaoOFX[] | null>(null);
  const [arquivo, setArquivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ajustes, setAjustes] = useState<AjustesReversos>(() => {
    if (!dados) return AJUSTES_ZERO;
    const i = dados.anos.length - 1;
    const b = dados.balanco;
    const d = (arr?: number[]) => (arr && i > 0 ? arr[i] - arr[i - 1] : 0);
    return {
      ...AJUSTES_ZERO,
      depreciacao: Math.abs(dados.dre.depreciacao[i] ?? 0),
      varContasReceber: d(b?.contasReceber),
      varEstoques: d(b?.estoques),
      varFornecedores: d(b?.fornecedores),
      jurosFinanceiros: dados.dre.resultadoFinanceiro[i] ?? 0,
    };
  });

  const dfc = useMemo(() => (txs ? montarDFC(txs) : null), [txs]);
  const ponte = useMemo(
    () => (dfc ? reverterParaLucro(dfc.operacional, ajustes) : null),
    [dfc, ajustes],
  );
  const cascata = useMemo(() => {
    if (!ponte) return [];
    const passos = ponte.linhas.map((l, i) => ({
      nome: l.label.replace(/^\([^)]*\)\s*/, ""),
      base: i === 0 ? 0 : l.acumulado - l.valor > l.acumulado ? l.acumulado : l.acumulado - l.valor,
      delta: i === 0 ? l.valor : Math.abs(l.valor),
      valor: l.valor,
      acumulado: l.acumulado,
      tipo: i === 0 ? "inicio" : l.valor >= 0 ? "aumenta" : "reduz",
    }));
    return [
      ...passos,
      {
        nome: "Lucro Líquido",
        base: 0,
        delta: ponte.lucroLiquido,
        valor: ponte.lucroLiquido,
        acumulado: ponte.lucroLiquido,
        tipo: "fim",
      },
    ];
  }, [ponte]);
  const llContabil = dados ? dados.dre.lucroLiquido[dados.anos.length - 1] : null;

  async function onFile(file: File) {
    setErro(null);
    try {
      const texto = await file.text();
      setTxs(lerOFX(texto));
      setArquivo(file.name);
    } catch (e) {
      setTxs(null);
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo OFX.");
    }
  }

  function mudarCategoria(id: string, categoria: CategoriaDFC) {
    setTxs((prev) => prev?.map((t) => (t.id === id ? { ...t, categoria } : t)) ?? prev);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Fluxo de Caixa Invertido (Reverso)"
        subtitulo="Importe o extrato OFX, classifique no modelo DFC e refaça o caminho inverso do método indireto até o lucro líquido."
        action={
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".ofx,.OFX,text/plain"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <Button onClick={() => inputRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" />
              {txs ? "Trocar OFX" : "Importar OFX"}
            </Button>
          </div>
        }
      />

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro na leitura do OFX</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      {!txs || !dfc || !ponte ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-lg border border-dashed bg-muted/30 p-10 text-center">
          <ArrowDownUp className="h-12 w-12 text-muted-foreground" />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Nenhum extrato importado</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Exporte o extrato bancário no formato OFX e faça o upload. O SAGA classifica
              cada lançamento no modelo da DFC, apura o caixa operacional e reconstrói o
              lucro líquido invertendo o método indireto.
            </p>
          </div>
          <Button onClick={() => inputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Importar OFX
          </Button>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { t: "Caixa Operacional", v: dfc.operacional },
              { t: "Caixa de Investimento", v: dfc.investimento },
              { t: "Caixa de Financiamento", v: dfc.financiamento },
              { t: "Variação de Caixa", v: dfc.variacaoCaixa },
            ].map((k) => (
              <Card key={k.t}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{k.t}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${k.v < 0 ? "text-destructive" : ""}`}>
                    {fmtMoney(k.v, moeda)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="ponte">
            <TabsList>
              <TabsTrigger value="ponte">Ponte Reversa → Lucro</TabsTrigger>
              <TabsTrigger value="dfc">DFC Classificada</TabsTrigger>
              <TabsTrigger value="lancamentos">Lançamentos ({txs.length})</TabsTrigger>
              <TabsTrigger value="ajustes">Ajustes</TabsTrigger>
            </TabsList>

            <TabsContent value="ponte" className="mt-4 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Do caixa operacional ao lucro líquido</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Etapa</TableHead>
                        <TableHead className="w-40 text-right">Efeito no lucro</TableHead>
                        <TableHead className="w-44 text-right">Saldo acumulado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ponte.linhas.map((l) => (
                        <TableRow key={l.label}>
                          <TableCell className={l.bold ? "font-semibold" : "pl-6"}>
                            <span className={l.bold ? "" : "font-medium"}>{l.label}</span>
                            <p className="mt-0.5 max-w-xl text-xs font-normal text-muted-foreground">
                              {l.explicacao}
                            </p>
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${l.bold ? "font-semibold" : ""} ${
                              l.valor < 0 ? "text-destructive" : ""
                            }`}
                          >
                            {fmtMoney(l.valor, moeda)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {fmtMoney(l.acumulado, moeda)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">= Lucro Líquido reconstruído</TableCell>
                        <TableCell />
                        <TableCell className="text-right text-lg font-semibold tabular-nums">
                          {fmtMoney(ponte.lucroLiquido, moeda)}
                        </TableCell>
                      </TableRow>
                      {llContabil !== null && (
                        <>
                          <TableRow>
                            <TableCell className="pl-6 text-muted-foreground">
                              Lucro Líquido da DRE (último ano)
                            </TableCell>
                            <TableCell />
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {fmtMoney(llContabil, moeda)}
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell className="pl-6 font-medium">Diferença a conciliar</TableCell>
                            <TableCell />
                            <TableCell className="text-right font-medium tabular-nums">
                              {fmtMoney(ponte.lucroLiquido - llContabil, moeda)}
                            </TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Lógica invertida do método indireto: partindo do caixa gerado nas operações,
                    removem-se os itens não-caixa e desfazem-se as variações de capital de giro
                    para reencontrar o resultado por competência.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Cascata: como cada variação patrimonial move o resultado
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-[380px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={cascata} margin={{ top: 8, right: 8, bottom: 60, left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="nome"
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={70}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtNum(Number(v), 0)} />
                      <RTooltip
                        formatter={(_v, _n, p) => [
                          fmtMoney(p.payload.valor, moeda),
                          p.payload.tipo === "fim" ? "Lucro líquido" : "Efeito",
                        ]}
                        labelFormatter={(l) => String(l)}
                      />
                      <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
                      <Bar dataKey="delta" stackId="w" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                        {cascata.map((c, i) => (
                          <Cell
                            key={i}
                            fill={
                              c.tipo === "inicio" || c.tipo === "fim"
                                ? "var(--primary)"
                                : c.valor >= 0
                                  ? "var(--chart-2)"
                                  : "var(--destructive)"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Barras verdes aumentam o lucro em relação ao caixa; barras vermelhas reduzem.
                    Exemplo: uma variação negativa de clientes a receber significa que a empresa
                    recebeu mais do que vendeu no período — o caixa entrou, mas o lucro é menor.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dfc" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Demonstração do Fluxo de Caixa — {arquivo}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Grupo / Categoria</TableHead>
                        <TableHead className="text-right">Lançamentos</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {["Operacional", "Investimento", "Financiamento", "Sem classificação"].flatMap(
                        (grupo) => {
                          const itens = dfc.porCategoria.filter((c) => c.grupo === grupo);
                          if (!itens.length) return [];
                          const total = itens.reduce((a, b) => a + b.total, 0);
                          return [
                            ...itens.map((c) => (
                              <TableRow key={c.categoria}>
                                <TableCell className="pl-6">{c.label}</TableCell>
                                <TableCell className="text-right tabular-nums">{c.qtd}</TableCell>
                                <TableCell
                                  className={`text-right tabular-nums ${c.total < 0 ? "text-destructive" : ""}`}
                                >
                                  {fmtMoney(c.total, moeda)}
                                </TableCell>
                              </TableRow>
                            )),
                            <TableRow key={`${grupo}-total`} className="bg-muted/40">
                              <TableCell className="font-semibold">= Caixa {grupo}</TableCell>
                              <TableCell />
                              <TableCell className="text-right font-semibold tabular-nums">
                                {fmtMoney(total, moeda)}
                              </TableCell>
                            </TableRow>,
                          ];
                        },
                      )}
                      <TableRow className="border-t-2">
                        <TableCell className="font-semibold">= Variação líquida de caixa</TableCell>
                        <TableCell />
                        <TableCell className="text-right font-semibold tabular-nums">
                          {fmtMoney(dfc.variacaoCaixa, moeda)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lancamentos" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Classificação dos lançamentos{" "}
                    <Badge variant="secondary" className="ml-2">
                      ajustável
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-[60vh] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-28">Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-64">Categoria DFC</TableHead>
                        <TableHead className="w-36 text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {txs.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="tabular-nums">
                            {t.data ? t.data.split("-").reverse().join("/") : "—"}
                          </TableCell>
                          <TableCell className="max-w-[24rem] truncate" title={t.descricao}>
                            {t.descricao}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={t.categoria}
                              onValueChange={(v) => mudarCategoria(t.id, v as CategoriaDFC)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIAS.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {c.grupo} · {c.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell
                            className={`text-right tabular-nums ${t.valor < 0 ? "text-destructive" : ""}`}
                          >
                            {fmtMoney(t.valor, moeda)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ajustes" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ajustes da ponte reversa</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {AJUSTES_LABELS.map((a) => (
                    <AjusteInput
                      key={a.key}
                      id={a.key}
                      label={a.label}
                      hint={a.hint}
                      value={ajustes[a.key]}
                      onChange={(v) => setAjustes((p) => ({ ...p, [a.key]: v }))}
                    />
                  ))}
                  {!dados && (
                    <p className="text-xs text-muted-foreground sm:col-span-2">
                      Importe a planilha modelo para pré-preencher estes ajustes com os dados
                      contábeis.
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}