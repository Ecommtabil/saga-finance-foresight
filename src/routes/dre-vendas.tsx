import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload, AlertTriangle, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/saga/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useSaga } from "@/lib/saga/context";
import { fmtMoney, fmtNum, fmtPctTable, safeDiv } from "@/lib/saga/formatters";
import {
  CRESCIMENTO_PADRAO,
  GRUPOS_LABEL,
  baixarModeloDespesasFixas,
  baixarModeloVendas,
  alocarDespesas,
  contasDespesaFixaAlocadas,
  modoDespesasEfetivo,
  evolucaoDimensao,
  montarBase,
  montarDre,
  parseDespesasFixas,
  parseVendas,
  periodosDespesas,
  periodosDisponiveis,
  projetar,
  resumoPorDimensao,
  type DimensaoProduto,
  type DreVendasPeriodo,
  type GruposCrescimento,
  type LinhaDespesaFixa,
  type LinhaVenda,
  type ModoDespesas,
} from "@/lib/saga/dre-vendas";

const DIMENSOES: { key: DimensaoProduto; label: string }[] = [
  { key: "produto", label: "Produto" },
  { key: "sku", label: "SKU" },
  { key: "marketplace", label: "Marketplace" },
  { key: "estado", label: "Estado" },
  { key: "fornecedor", label: "Fornecedor" },
  { key: "empresa", label: "Empresa" },
];

export const Route = createFileRoute("/dre-vendas")({
  head: () => ({
    meta: [
      { title: "DRE — Vendas | SAGA" },
      {
        name: "description",
        content:
          "Importe vendas, comissões, fretes, custos e despesas fixas, informe a carga tributária e projete o DRE dos próximos períodos.",
      },
      { property: "og:title", content: "DRE — Vendas | SAGA" },
      {
        property: "og:description",
        content: "DRE gerencial de vendas com base histórica selecionável e projeção por grupo de contas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DreVendasPage,
});

type LinhaDre = {
  label: string;
  get: (d: DreVendasPeriodo) => number;
  bold?: boolean;
  indent?: boolean;
  negativo?: boolean;
};

const LINHAS: LinhaDre[] = [
  { label: "Receita Bruta de Vendas", get: (d) => d.receitaBruta, bold: true },
  { label: "(-) Devoluções e Descontos", get: (d) => -d.devolucoes, indent: true },
  { label: "(-) Impostos sobre Vendas", get: (d) => -d.impostos, indent: true },
  { label: "(+) Outras Receitas", get: (d) => d.outrasReceitas, indent: true },
  { label: "= Receita Líquida", get: (d) => d.receitaLiquida, bold: true },
  { label: "(-) Custos (CMV/CSP)", get: (d) => -d.custos, indent: true },
  { label: "= Lucro Bruto", get: (d) => d.lucroBruto, bold: true },
  { label: "(-) Comissões sobre Vendas", get: (d) => -d.comissoes, indent: true },
  { label: "(-) Fretes sobre Vendas", get: (d) => -d.fretes, indent: true },
  { label: "= Margem de Contribuição", get: (d) => d.margemContribuicao, bold: true },
  { label: "(-) Despesas Fixas", get: (d) => -d.despesasFixas, indent: true },
  { label: "= Resultado Operacional", get: (d) => d.resultadoOperacional, bold: true },
];

type ColunaDre = { key: string; label: string; dado: DreVendasPeriodo; projetado?: boolean };

function DreTabela({
  colunas,
  detalhe,
}: {
  colunas: ColunaDre[];
  detalhe?: { conta: string; valores: Record<string, number> }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="min-w-56">Conta</TableHead>
          {colunas.map((c) => (
            <TableHead key={c.key} className="text-right">
              {c.label}
              {c.projetado && (
                <TrendingUp className="ml-1 inline h-3 w-3 text-muted-foreground" />
              )}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {LINHAS.map((l) => (
          <Fragment key={l.label}>
            <TableRow>
              <TableCell
                className={`${l.bold ? "font-semibold" : ""} ${l.indent ? "pl-6" : ""}`}
              >
                {l.label}
              </TableCell>
              {colunas.map((c) => (
                <TableCell
                  key={c.key}
                  className={`text-right tabular-nums ${l.bold ? "font-semibold" : ""}`}
                >
                  {fmtNum(l.get(c.dado))}
                </TableCell>
              ))}
            </TableRow>
            {l.label === "(-) Despesas Fixas" &&
              detalhe?.map((f) => (
                <TableRow key={`fx-${f.conta}`} className="text-muted-foreground">
                  <TableCell className="pl-10 text-xs">{f.conta}</TableCell>
                  {colunas.map((c) => (
                    <TableCell key={c.key} className="text-right text-xs tabular-nums">
                      {fmtNum(-(f.valores[c.key] ?? 0))}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
          </Fragment>
        ))}
        <TableRow>
          <TableCell className="text-xs text-muted-foreground">
            % Resultado sobre Receita Líquida
          </TableCell>
          {colunas.map((c) => (
            <TableCell
              key={c.key}
              className="text-right text-xs tabular-nums text-muted-foreground"
            >
              {fmtPctTable(safeDiv(c.dado.resultadoOperacional, c.dado.receitaLiquida))}
            </TableCell>
          ))}
        </TableRow>
      </TableBody>
    </Table>
  );
}

function DreVendasPage() {
  const { empresa } = useSaga();
  const moeda = empresa?.moeda ?? "R$";

  const [vendas, setVendas] = useState<LinhaVenda[]>([]);
  const [despesas, setDespesas] = useState<LinhaDespesaFixa[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [modoBase, setModoBase] = useState<"soma" | "media">("soma");
  const [cargaStr, setCargaStr] = useState("12,0");
  const [qtdProj, setQtdProj] = useState(6);
  const [rotuloProj, setRotuloProj] = useState("P");
  const [crescimento, setCrescimento] = useState<GruposCrescimento>(CRESCIMENTO_PADRAO);
  const [detalharFixas, setDetalharFixas] = useState(true);
  const [modoDespesas, setModoDespesas] = useState<ModoDespesas>("auto");
  const [dimensao, setDimensao] = useState<DimensaoProduto>("produto");
  const [foco, setFoco] = useState<string | null>(null);

  const carga = useMemo(() => {
    const n = Number(cargaStr.replace(",", "."));
    return isFinite(n) ? n / 100 : 0;
  }, [cargaStr]);

  const periodos = useMemo(() => periodosDisponiveis(vendas), [vendas]);

  const despesasAloc = useMemo(
    () => alocarDespesas(despesas, selecionados, modoDespesas),
    [despesas, selecionados, modoDespesas],
  );

  const modoAplicado = useMemo(
    () => modoDespesasEfetivo(despesas, selecionados, modoDespesas),
    [despesas, selecionados, modoDespesas],
  );

  const fixasPorConta = useMemo(
    () => contasDespesaFixaAlocadas(despesas, selecionados, modoDespesas),
    [despesas, selecionados, modoDespesas],
  );

  const totalFixasBase = useMemo(
    () => fixasPorConta.reduce((a, f) => a + f.total, 0) || 1,
    [fixasPorConta],
  );

  const despesasForaDaBase = useMemo(() => {
    if (!despesas.length || !selecionados.length || modoAplicado !== "periodo")
      return [] as string[];
    return periodosDespesas(despesas).filter((p) => !selecionados.includes(p));
  }, [despesas, selecionados, modoAplicado]);

  const ranking = useMemo(
    () => resumoPorDimensao(vendas, selecionados, dimensao, carga),
    [vendas, selecionados, dimensao, carga],
  );

  const serieFoco = useMemo(
    () => (foco ? evolucaoDimensao(vendas, dimensao, foco) : []),
    [vendas, dimensao, foco],
  );

  async function onVendas(file?: File | null) {
    if (!file) return;
    try {
      const linhas = await parseVendas(file);
      setVendas(linhas);
      setSelecionados(periodosDisponiveis(linhas));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler a planilha de vendas.");
    }
  }

  async function onDespesas(file?: File | null) {
    if (!file) return;
    try {
      setDespesas(await parseDespesasFixas(file));
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao ler a planilha de despesas fixas.");
    }
  }

  const historico = useMemo(
    () => selecionados.map((p) => montarDre(p, vendas, despesasAloc, carga)),
    [selecionados, vendas, despesasAloc, carga],
  );

  const base = useMemo(
    () =>
      selecionados.length
        ? montarBase(
            selecionados,
            vendas,
            despesasAloc,
            carga,
            modoBase,
            modoBase === "soma" ? "Base (soma)" : "Base (média)",
          )
        : null,
    [selecionados, vendas, despesasAloc, carga, modoBase],
  );

  const projecao = useMemo(
    () =>
      base ? projetar(base, crescimento, carga, qtdProj, (i) => `${rotuloProj}${i}`) : [],
    [base, crescimento, carga, qtdProj, rotuloProj],
  );

  const colunas: DreVendasPeriodo[] = base ? [base, ...projecao] : [];
  const grafico = [...historico, ...projecao].map((d) => ({
    periodo: d.periodo,
    receita: d.receitaBruta,
    resultado: d.resultadoOperacional,
  }));

  const temDados = vendas.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="DRE — Vendas"
        subtitulo="Importe as vendas e as despesas fixas, defina a carga tributária e projete os próximos períodos por grupo de contas."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={baixarModeloVendas}>
              <Download className="mr-2 h-4 w-4" /> Modelo de Vendas
            </Button>
            <Button variant="outline" size="sm" onClick={baixarModeloDespesasFixas}>
              <Download className="mr-2 h-4 w-4" /> Modelo de Despesas Fixas
            </Button>
          </div>
        }
      />

      {erro && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro na importação</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">1. Planilha de vendas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="f-vendas" className="text-xs text-muted-foreground">
              Vendas, comissões, fretes e custos por período
            </Label>
            <Input
              id="f-vendas"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => onVendas(e.target.files?.[0])}
            />
            {vendas.length > 0 && (
              <Badge variant="secondary">
                <Upload className="mr-1 h-3 w-3" /> {vendas.length} linhas · {periodos.length} períodos
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">2. Despesas fixas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="f-desp" className="text-xs text-muted-foreground">
              Relação de despesas fixas por período
            </Label>
            <Input
              id="f-desp"
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => onDespesas(e.target.files?.[0])}
            />
            {despesas.length > 0 && (
              <Badge variant="secondary">{despesas.length} lançamentos</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">3. Carga tributária</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label htmlFor="carga" className="text-xs text-muted-foreground">
              % sobre a receita líquida de devoluções
            </Label>
            <Input
              id="carga"
              inputMode="decimal"
              value={cargaStr}
              onChange={(e) => setCargaStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Aplicada: {fmtPctTable(carga)}
            </p>
          </CardContent>
        </Card>
      </div>

      {!temDados ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Baixe as planilhas modelo, preencha no Excel e faça o upload para montar o DRE de
            vendas.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="drebase">
          <TabsList>
            <TabsTrigger value="drebase">DRE Base</TabsTrigger>
            <TabsTrigger value="proj">Projeções</TabsTrigger>
            <TabsTrigger value="produtos">Vendas por Produto</TabsTrigger>
            <TabsTrigger value="base">Base de Períodos</TabsTrigger>
            <TabsTrigger value="cresc">Crescimento</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Dimensão de análise</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-3">
                <Select
                  value={dimensao}
                  onValueChange={(v) => {
                    setDimensao(v as DimensaoProduto);
                    setFoco(null);
                  }}
                >
                  <SelectTrigger className="h-9 w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIMENSOES.map((d) => (
                      <SelectItem key={d.key} value={d.key}>
                        {d.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">
                  {ranking.length} itens · períodos da base selecionada
                </span>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Top 10 por Receita Bruta</CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={ranking.slice(0, 10).map((r) => ({
                        nome: r.chave.length > 18 ? `${r.chave.slice(0, 18)}…` : r.chave,
                        chave: r.chave,
                        receita: r.receitaBruta,
                        margem: r.margemContribuicao,
                      }))}
                      layout="vertical"
                      margin={{ left: 8, right: 16 }}
                    >
                      <CartesianGrid horizontal={false} strokeOpacity={0.2} />
                      <XAxis type="number" tickFormatter={(v: number) => fmtNum(v)} fontSize={11} />
                      <YAxis type="category" dataKey="nome" width={130} fontSize={11} />
                      <RTooltip formatter={(v: number, n: string) => [fmtMoney(v, moeda), n]} />
                      <Bar
                        dataKey="receita"
                        name="Receita Bruta"
                        fill="hsl(var(--primary))"
                        radius={[0, 6, 6, 0]}
                        onClick={(d: { chave?: string }) => setFoco(d?.chave ?? null)}
                      />
                      <Bar
                        dataKey="margem"
                        name="Margem de Contribuição"
                        fill="hsl(var(--chart-2))"
                        radius={[0, 6, 6, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {foco ? `Evolução — ${foco}` : "Clique em uma barra para ver a evolução"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="h-80">
                  {serieFoco.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={serieFoco} margin={{ left: 8, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeOpacity={0.2} />
                        <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis
                          tickFormatter={(v: number) => fmtNum(v)}
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          width={80}
                        />
                        <RTooltip formatter={(v: number, n: string) => [fmtMoney(v, moeda), n]} />
                        <Area
                          type="monotone"
                          dataKey="receita"
                          name="Receita Bruta"
                          stroke="hsl(var(--primary))"
                          fill="url(#gProd)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Selecione um item no gráfico ao lado.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Detalhamento por {DIMENSOES.find((d) => d.key === dimensao)?.label}</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-48">Item</TableHead>
                      <TableHead className="text-right">Unid.</TableHead>
                      <TableHead className="text-right">Receita Bruta</TableHead>
                      <TableHead className="text-right">Part. %</TableHead>
                      <TableHead className="text-right">Ticket Médio</TableHead>
                      <TableHead className="text-right">Custos</TableHead>
                      <TableHead className="text-right">Comissões</TableHead>
                      <TableHead className="text-right">Fretes</TableHead>
                      <TableHead className="text-right">MC</TableHead>
                      <TableHead className="text-right">MC %</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ranking.map((r) => (
                      <TableRow
                        key={r.chave}
                        className="cursor-pointer"
                        onClick={() => setFoco(r.chave)}
                      >
                        <TableCell>{r.chave}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.unidades)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.receitaBruta)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPctTable(r.participacao)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(r.ticketMedio)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-r.custos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-r.comissoes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-r.fretes)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtNum(r.margemContribuicao)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPctTable(r.margemPct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="base" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Períodos considerados na base</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelecionados(periodos)}
                  >
                    Selecionar todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelecionados([])}>
                    Limpar
                  </Button>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Consolidação</Label>
                    <Select
                      value={modoBase}
                      onValueChange={(v) => setModoBase(v as "soma" | "media")}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="soma">Soma dos períodos</SelectItem>
                        <SelectItem value="media">Média dos períodos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {periodos.map((p) => (
                    <label
                      key={p}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={selecionados.includes(p)}
                        onCheckedChange={(c) =>
                          setSelecionados((prev) =>
                            c ? [...prev, p].sort() : prev.filter((x) => x !== p),
                          )
                        }
                      />
                      {p}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Histórico importado</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Receita Bruta</TableHead>
                      <TableHead className="text-right">Custos</TableHead>
                      <TableHead className="text-right">Comissões</TableHead>
                      <TableHead className="text-right">Fretes</TableHead>
                      <TableHead className="text-right">Desp. Fixas</TableHead>
                      <TableHead className="text-right">Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((d) => (
                      <TableRow key={d.periodo}>
                        <TableCell>{d.periodo}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(d.receitaBruta)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-d.custos)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-d.comissoes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-d.fretes)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(-d.despesasFixas)}</TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {fmtNum(d.resultadoOperacional)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="cresc" className="mt-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Indicadores de crescimento por grupo de contas (% por período)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {GRUPOS_LABEL.map((g) => (
                    <div key={g.key} className="space-y-1">
                      <Label className="text-xs">{g.label}</Label>
                      <Input
                        inputMode="decimal"
                        value={String((crescimento[g.key] * 100).toFixed(2)).replace(".", ",")}
                        onChange={(e) => {
                          const n = Number(e.target.value.replace(",", "."));
                          setCrescimento((prev) => ({
                            ...prev,
                            [g.key]: isFinite(n) ? n / 100 : 0,
                          }));
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Quantidade de períodos projetados</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={qtdProj}
                      onChange={(e) =>
                        setQtdProj(Math.max(1, Math.min(24, Number(e.target.value) || 1)))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Prefixo dos períodos projetados</Label>
                    <Input value={rotuloProj} onChange={(e) => setRotuloProj(e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dre" className="mt-4 space-y-6">
            {!base ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Selecione ao menos um período</AlertTitle>
                <AlertDescription>
                  Use a aba "Base de Períodos" para escolher o intervalo que servirá de base.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Receita Bruta (base)</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold tabular-nums">
                      {fmtMoney(base.receitaBruta, moeda)}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Margem de Contribuição</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold tabular-nums">
                      {fmtPctTable(safeDiv(base.margemContribuicao, base.receitaLiquida))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Resultado Operacional</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold tabular-nums">
                      {fmtMoney(base.resultadoOperacional, moeda)}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      DRE gerencial — base e projeção ({moeda})
                    </CardTitle>
                  </CardHeader>
                  {despesas.length > 0 && (
                    <CardContent className="flex flex-wrap items-center gap-3 pb-2 pt-0">
                      <label className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={detalharFixas}
                          onCheckedChange={(c) => setDetalharFixas(Boolean(c))}
                        />
                        Detalhar contas de despesas fixas
                      </label>
                      <Badge variant="secondary">
                        Despesas fixas na base: {fmtMoney(base.despesasFixas, moeda)}
                      </Badge>
                      {despesasForaDaBase.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {despesasForaDaBase.length} período(s) de despesas fora da base
                          selecionada ({despesasForaDaBase.join(", ")})
                        </span>
                      )}
                    </CardContent>
                  )}
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-56">Conta</TableHead>
                          {colunas.map((c) => (
                            <TableHead key={c.periodo} className="text-right">
                              {c.periodo}
                              {c.projetado && (
                                <TrendingUp className="ml-1 inline h-3 w-3 text-muted-foreground" />
                              )}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {LINHAS.map((l) => (
                          <Fragment key={l.label}>
                          <TableRow>
                            <TableCell
                              className={`${l.bold ? "font-semibold" : ""} ${l.indent ? "pl-6" : ""}`}
                            >
                              {l.label}
                            </TableCell>
                            {colunas.map((c) => (
                              <TableCell
                                key={c.periodo}
                                className={`text-right tabular-nums ${l.bold ? "font-semibold" : ""}`}
                              >
                                {fmtNum(l.get(c))}
                              </TableCell>
                            ))}
                          </TableRow>
                          {l.label === "(-) Despesas Fixas" &&
                            detalharFixas &&
                            fixasPorConta.map((f) => {
                              const parte = base.despesasFixas
                                ? (f.total / totalFixasBase) * base.despesasFixas
                                : 0;
                              return (
                                <TableRow key={`fx-${f.conta}`} className="text-muted-foreground">
                                  <TableCell className="pl-10 text-xs">{f.conta}</TableCell>
                                  {colunas.map((c) => (
                                    <TableCell
                                      key={c.periodo}
                                      className="text-right text-xs tabular-nums"
                                    >
                                      {fmtNum(
                                        -(base.despesasFixas
                                          ? (parte / base.despesasFixas) * c.despesasFixas
                                          : 0),
                                      )}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              );
                            })}
                          </Fragment>
                        ))}
                        <TableRow>
                          <TableCell className="text-xs text-muted-foreground">
                            % Resultado sobre Receita Líquida
                          </TableCell>
                          {colunas.map((c) => (
                            <TableCell
                              key={c.periodo}
                              className="text-right text-xs tabular-nums text-muted-foreground"
                            >
                              {fmtPctTable(safeDiv(c.resultadoOperacional, c.receitaLiquida))}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Receita e resultado ao longo dos períodos</CardTitle>
                  </CardHeader>
                  <CardContent className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={grafico} margin={{ left: 8, right: 8, top: 8 }}>
                        <defs>
                          <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} strokeOpacity={0.2} />
                        <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                        <YAxis
                          tickFormatter={(v: number) => fmtNum(v)}
                          tickLine={false}
                          axisLine={false}
                          fontSize={12}
                          width={80}
                        />
                        <RTooltip
                          formatter={(v: number, n: string) => [fmtMoney(v, moeda), n]}
                          contentStyle={{ borderRadius: 12 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="receita"
                          name="Receita Bruta"
                          stroke="hsl(var(--primary))"
                          fill="url(#gRec)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="resultado"
                          name="Resultado Operacional"
                          stroke="hsl(var(--chart-2))"
                          fill="url(#gRes)"
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
