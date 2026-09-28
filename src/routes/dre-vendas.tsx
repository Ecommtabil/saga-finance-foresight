import { usePersistedState } from "@/hooks/use-persisted-state";
import { Fragment, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Upload, AlertTriangle, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/saga/PageHeader";
import { InfoTooltip } from "@/components/saga/InfoTooltip";
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
  Cell,
  ComposedChart,
  Line,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
  ZAxis,
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
  analisarMargens,
  GLOSSARIO_MARGENS,
  type DimensaoProduto,
  type DreVendasPeriodo,
  type GruposCrescimento,
  type LinhaDespesaFixa,
  type LinhaVenda,
  type ResumoProduto,
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
        {(
          [
            ["Margem Bruta %", "margemBruta", (d: DreVendasPeriodo) => safeDiv(d.lucroBruto, d.receitaLiquida)],
            ["Margem de Contribuição %", "margemContribuicao", (d: DreVendasPeriodo) => safeDiv(d.margemContribuicao, d.receitaLiquida)],
            ["Margem Operacional %", "margemOperacional", (d: DreVendasPeriodo) => safeDiv(d.resultadoOperacional, d.receitaLiquida)],
            ["Margem Líquida % (s/ Receita Bruta)", "margemLiquida", (d: DreVendasPeriodo) => safeDiv(d.resultadoOperacional, d.receitaBruta)],
          ] as [string, string, (d: DreVendasPeriodo) => number][]
        ).map(([label, chave, get]) => (
          <TableRow key={label} className="bg-muted/30">
            <TableCell className="text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {label}
                <InfoTooltip text={GLOSSARIO_MARGENS[chave]} />
              </span>
            </TableCell>
            {colunas.map((c) => (
              <TableCell key={c.key} className="text-right text-xs tabular-nums">
                {fmtPctTable(get(c.dado))}
              </TableCell>
            ))}
          </TableRow>
        ))}
        <TableRow className="bg-muted/30">
          <TableCell className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              Ponto de Equilíbrio (receita bruta)
              <InfoTooltip text={GLOSSARIO_MARGENS.pontoEquilibrio} />
            </span>
          </TableCell>
          {colunas.map((c) => (
            <TableCell key={c.key} className="text-right text-xs tabular-nums">
              {fmtNum(analisarMargens(c.dado).peReceitaBruta)}
            </TableCell>
          ))}
        </TableRow>
        <TableRow className="bg-muted/30">
          <TableCell className="text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              Unidades no Ponto de Equilíbrio
              <InfoTooltip text={GLOSSARIO_MARGENS.peUnidades} />
            </span>
          </TableCell>
          {colunas.map((c) => (
            <TableCell key={c.key} className="text-right text-xs tabular-nums">
              {fmtNum(analisarMargens(c.dado).peUnidades)}
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

  const [vendas, setVendas] = usePersistedState<LinhaVenda[]>("saga.dre-vendas.vendas", []);
  const [despesas, setDespesas] = usePersistedState<LinhaDespesaFixa[]>("saga.dre-vendas.despesas", []);
  const [erro, setErro] = useState<string | null>(null);

  const [selecionados, setSelecionados] = usePersistedState<string[]>("saga.dre-vendas.selecionados", []);
  const [modoBase, setModoBase] = usePersistedState<"soma" | "media">("saga.dre-vendas.modoBase", "soma");
  const [cargaStr, setCargaStr] = usePersistedState("saga.dre-vendas.cargaStr", "12,0");
  const [qtdProj, setQtdProj] = usePersistedState("saga.dre-vendas.qtdProj", 6);
  const [rotuloProj, setRotuloProj] = usePersistedState("saga.dre-vendas.rotuloProj", "P");
  const [crescimento, setCrescimento] = usePersistedState<GruposCrescimento>("saga.dre-vendas.crescimento", CRESCIMENTO_PADRAO);
  const [detalharFixas, setDetalharFixas] = usePersistedState("saga.dre-vendas.detalharFixas", true);
  const [modoDespesas, setModoDespesas] = usePersistedState<ModoDespesas>("saga.dre-vendas.modoDespesas", "auto");
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

  const colunasBase: ColunaDre[] = base
    ? [
        ...historico.map((d) => ({ key: d.periodo, label: d.periodo, dado: d })),
        { key: "__base", label: base.periodo, dado: base },
      ]
    : [];

  const detalheBase = fixasPorConta.map((f) => ({
    conta: f.conta,
    valores: {
      ...f.porPeriodo,
      __base: modoBase === "media" && selecionados.length ? f.total / selecionados.length : f.total,
    } as Record<string, number>,
  }));

  const colunasProj: ColunaDre[] = base
    ? [
        { key: "__base", label: base.periodo, dado: base },
        ...projecao.map((d) => ({ key: d.periodo, label: d.periodo, dado: d, projetado: true })),
      ]
    : [];

  const detalheProj = base
    ? fixasPorConta.map((f) => {
        const parteBase = detalheBase.find((d) => d.conta === f.conta)?.valores.__base ?? 0;
        const peso = base.despesasFixas ? parteBase / base.despesasFixas : 0;
        const valores: Record<string, number> = { __base: parteBase };
        for (const d of projecao) valores[d.periodo] = d.despesasFixas * peso;
        return { conta: f.conta, valores };
      })
    : [];

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
            <TabsTrigger value="margens">Margens & Ponto de Equilíbrio</TabsTrigger>
            <TabsTrigger value="proj">Projeções</TabsTrigger>
            <TabsTrigger value="produtos">Vendas por Produto</TabsTrigger>
            <TabsTrigger value="base">Base de Períodos</TabsTrigger>
            <TabsTrigger value="cresc">Crescimento</TabsTrigger>
          </TabsList>

          <TabsContent value="produtos" className="mt-4">
            <ProdutosDashboard
              ranking={ranking}
              dimensao={dimensao}
              onDimensao={(d) => {
                setDimensao(d);
                setFoco(null);
              }}
              foco={foco}
              onFoco={setFoco}
              serie={serieFoco}
              moeda={moeda}
            />
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

          <TabsContent value="drebase" className="mt-4 space-y-6">
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
                <div className="grid gap-4 md:grid-cols-4">
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
                      <CardTitle className="text-sm">Despesas Fixas</CardTitle>
                    </CardHeader>
                    <CardContent className="text-2xl font-semibold tabular-nums">
                      {fmtMoney(base.despesasFixas, moeda)}
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
                      Despesas fixas — integração ao DRE
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center gap-3">
                    {despesas.length === 0 ? (
                      <span className="text-xs text-muted-foreground">
                        Nenhuma planilha de despesas fixas importada. O DRE está sendo montado
                        apenas com a base de vendas.
                      </span>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Alocação</Label>
                          <Select
                            value={modoDespesas}
                            onValueChange={(v) => setModoDespesas(v as ModoDespesas)}
                          >
                            <SelectTrigger className="h-8 w-64">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="auto">
                                Automático (casa competências)
                              </SelectItem>
                              <SelectItem value="periodo">Por competência (AAAA-MM)</SelectItem>
                              <SelectItem value="media">Média mensal em cada período</SelectItem>
                              <SelectItem value="total">Total rateado entre os períodos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Badge variant="secondary">
                          Aplicado: {modoAplicado === "periodo"
                            ? "por competência"
                            : modoAplicado === "media"
                              ? "média mensal"
                              : "total rateado"}
                        </Badge>
                        <Badge variant="secondary">
                          Total na base: {fmtMoney(base.despesasFixas, moeda)}
                        </Badge>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={detalharFixas}
                            onCheckedChange={(c) => setDetalharFixas(Boolean(c))}
                          />
                          Detalhar contas
                        </label>
                        {despesasForaDaBase.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {despesasForaDaBase.length} período(s) de despesas fora da base
                            ({despesasForaDaBase.join(", ")})
                          </span>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      DRE base — vendas por período + despesas fixas ({moeda})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <DreTabela
                      colunas={colunasBase}
                      detalhe={detalharFixas ? detalheBase : undefined}
                    />
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="margens" className="mt-4 space-y-6">
            {!base ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Selecione ao menos um período</AlertTitle>
                <AlertDescription>
                  Use a aba "Base de Períodos" para escolher o intervalo que servirá de base.
                </AlertDescription>
              </Alert>
            ) : (
              <MargensPanel colunas={colunasBase} moeda={moeda} />
            )}
          </TabsContent>

          <TabsContent value="proj" className="mt-4 space-y-6">
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
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      DRE projetado — base e {qtdProj} período(s) ({moeda})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <DreTabela
                      colunas={colunasProj}
                      detalhe={detalharFixas && despesas.length > 0 ? detalheProj : undefined}
                    />
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
                            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
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
                          stroke="var(--primary)"
                          fill="url(#gRec)"
                          strokeWidth={2}
                        />
                        <Area
                          type="monotone"
                          dataKey="resultado"
                          name="Resultado Operacional"
                          stroke="var(--chart-2)"
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

function MetricaCard({
  titulo,
  valor,
  ajuda,
  detalhe,
}: {
  titulo: string;
  valor: string;
  ajuda: string;
  detalhe?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-1 text-sm">
          {titulo}
          <InfoTooltip text={ajuda} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{valor}</div>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  );
}

function MargensPanel({ colunas, moeda }: { colunas: ColunaDre[]; moeda: string }) {
  const ultima = colunas[colunas.length - 1];
  const d = ultima.dado;
  const m = analisarMargens(d);
  const cobertura = safeDiv(d.receitaBruta, m.peReceitaBruta);
  const faltamUnidades = m.peUnidades - d.unidades;

  const dados = colunas.map((c) => {
    const a = analisarMargens(c.dado);
    return {
      periodo: c.label,
      receita: c.dado.receitaBruta,
      pe: a.peReceitaBruta,
      unidades: c.dado.unidades,
      peUnidades: a.peUnidades,
      bruta: a.margemBruta * 100,
      contrib: a.margemContribuicao * 100,
      operacional: a.margemOperacional * 100,
      liquida: a.margemLiquida * 100,
      analise: a,
      dre: c.dado,
      key: c.key,
    };
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricaCard
          titulo="Margem Bruta"
          valor={fmtPctTable(m.margemBruta)}
          ajuda={GLOSSARIO_MARGENS.margemBruta}
          detalhe={`Lucro Bruto ${fmtMoney(d.lucroBruto, moeda)} ÷ Receita Líquida ${fmtMoney(d.receitaLiquida, moeda)}`}
        />
        <MetricaCard
          titulo="Margem de Contribuição"
          valor={fmtPctTable(m.margemContribuicao)}
          ajuda={GLOSSARIO_MARGENS.margemContribuicao}
          detalhe={`${fmtMoney(m.mcUnitaria, moeda)} por unidade`}
        />
        <MetricaCard
          titulo="Margem Operacional"
          valor={fmtPctTable(m.margemOperacional)}
          ajuda={GLOSSARIO_MARGENS.margemOperacional}
          detalhe={`Resultado Operacional ${fmtMoney(d.resultadoOperacional, moeda)}`}
        />
        <MetricaCard
          titulo="Margem Líquida"
          valor={fmtPctTable(m.margemLiquida)}
          ajuda={GLOSSARIO_MARGENS.margemLiquida}
          detalhe={`Sobre a Receita Bruta ${fmtMoney(d.receitaBruta, moeda)}`}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricaCard
          titulo="Ponto de Equilíbrio"
          valor={fmtMoney(m.peReceitaBruta, moeda)}
          ajuda={GLOSSARIO_MARGENS.pontoEquilibrio}
          detalhe={`Receita líquida equivalente: ${fmtMoney(m.peReceitaLiquida, moeda)}`}
        />
        <MetricaCard
          titulo="Unidades no Equilíbrio"
          valor={fmtNum(m.peUnidades)}
          ajuda={GLOSSARIO_MARGENS.peUnidades}
          detalhe={
            faltamUnidades > 0
              ? `Faltam ${fmtNum(faltamUnidades)} unidades para o equilíbrio`
              : `Excedente de ${fmtNum(-faltamUnidades)} unidades acima do equilíbrio`
          }
        />
        <MetricaCard
          titulo="Margem de Segurança"
          valor={fmtPctTable(m.margemSeguranca)}
          ajuda={GLOSSARIO_MARGENS.margemSeguranca}
          detalhe={`As vendas cobrem ${fmtNum(cobertura * 100)}% do ponto de equilíbrio`}
        />
        <MetricaCard
          titulo="Alavancagem Operacional"
          valor={m.alavancagemOperacional ? `${fmtNum(m.alavancagemOperacional, 2)}x` : "—"}
          ajuda={GLOSSARIO_MARGENS.alavancagem}
          detalhe={
            m.alavancagemOperacional
              ? `+10% de receita ≈ ${fmtNum(m.alavancagemOperacional * 10, 1)}% no resultado`
              : "Sem resultado positivo para calcular"
          }
        />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Como o ponto de equilíbrio é montado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-muted-foreground">
            Período analisado: <strong>{ultima.label}</strong>
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-lg border p-3 text-xs leading-relaxed">
              <p className="mb-1 font-semibold">Por faturamento</p>
              Despesas Fixas {fmtMoney(d.despesasFixas, moeda)} ÷ Margem de Contribuição{" "}
              {fmtPctTable(m.margemContribuicao)} ={" "}
              <strong>{fmtMoney(m.peReceitaLiquida, moeda)}</strong> de receita líquida
              (equivalente a {fmtMoney(m.peReceitaBruta, moeda)} de receita bruta).
            </div>
            <div className="rounded-lg border p-3 text-xs leading-relaxed">
              <p className="mb-1 font-semibold">Por unidades</p>
              Preço médio {fmtMoney(m.precoMedio, moeda)} − custo variável unitário{" "}
              {fmtMoney(m.custoVariavelUnitario, moeda)} = MC unitária{" "}
              {fmtMoney(m.mcUnitaria, moeda)}. Despesas Fixas ÷ MC unitária ={" "}
              <strong>{fmtNum(m.peUnidades)} unidades</strong> (vendidas:{" "}
              {fmtNum(d.unidades)}).
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Receita x Ponto de Equilíbrio ({moeda})</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dados} margin={{ left: 8, right: 8, top: 8 }}>
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
                <Legend />
                <Bar dataKey="receita" name="Receita Bruta" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="pe" name="Ponto de Equilíbrio" fill="var(--chart-3)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Evolução das margens (%)</CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gMB" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gMO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.2} />
                <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => `${fmtNum(v, 1)}%`}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={60}
                />
                <RTooltip
                  formatter={(v: number, n: string) => [`${fmtNum(v, 1)}%`, n]}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Legend />
                <Area type="monotone" dataKey="bruta" name="Bruta" stroke="var(--primary)" fill="url(#gMB)" strokeWidth={2} />
                <Area type="monotone" dataKey="contrib" name="Contribuição" stroke="var(--chart-4)" fill="transparent" strokeWidth={2} />
                <Area type="monotone" dataKey="operacional" name="Operacional" stroke="var(--chart-2)" fill="url(#gMO)" strokeWidth={2} />
                <Area type="monotone" dataKey="liquida" name="Líquida" stroke="var(--chart-3)" fill="transparent" strokeWidth={2} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento por período</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">M. Bruta</TableHead>
                <TableHead className="text-right">M. Contribuição</TableHead>
                <TableHead className="text-right">M. Operacional</TableHead>
                <TableHead className="text-right">M. Líquida</TableHead>
                <TableHead className="text-right">PE Receita</TableHead>
                <TableHead className="text-right">PE Unidades</TableHead>
                <TableHead className="text-right">Unid. vendidas</TableHead>
                <TableHead className="text-right">M. Segurança</TableHead>
                <TableHead>Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dados.map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="font-medium">{r.periodo}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPctTable(r.analise.margemBruta)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPctTable(r.analise.margemContribuicao)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPctTable(r.analise.margemOperacional)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPctTable(r.analise.margemLiquida)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.pe)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.peUnidades)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.unidades)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtPctTable(r.analise.margemSeguranca)}</TableCell>
                  <TableCell>
                    <Badge variant={r.dre.resultadoOperacional >= 0 ? "secondary" : "destructive"}>
                      {r.dre.resultadoOperacional >= 0 ? "Acima do equilíbrio" : "Abaixo do equilíbrio"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

const PALETA = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function KpiCard({
  titulo,
  valor,
  sub,
  cor,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  cor: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <span
        className="absolute inset-y-0 left-0 w-1.5"
        style={{ background: cor }}
        aria-hidden
      />
      <CardHeader className="pb-1 pl-5">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="pl-5">
        <div className="text-2xl font-semibold tabular-nums">{valor}</div>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function ProdutosDashboard({
  ranking,
  dimensao,
  onDimensao,
  foco,
  onFoco,
  serie,
  moeda,
}: {
  ranking: ResumoProduto[];
  dimensao: DimensaoProduto;
  onDimensao: (d: DimensaoProduto) => void;
  foco: string | null;
  onFoco: (v: string | null) => void;
  serie: { periodo: string; receita: number; unidades: number }[];
  moeda: string;
}) {
  const label = DIMENSOES.find((d) => d.key === dimensao)?.label ?? "Item";

  const totalReceita = ranking.reduce((a, r) => a + r.receitaBruta, 0);
  const totalMc = ranking.reduce((a, r) => a + r.margemContribuicao, 0);
  const totalUnid = ranking.reduce((a, r) => a + r.unidades, 0);
  const mcPct = safeDiv(totalMc, ranking.reduce((a, r) => a + r.receitaLiquida, 0));

  // Curva ABC (Pareto)
  let acum = 0;
  const abc = ranking.map((r, i) => {
    acum += r.receitaBruta;
    const acumPct = safeDiv(acum, totalReceita);
    const classe = acumPct <= 0.8 ? "A" : acumPct <= 0.95 ? "B" : "C";
    return { ...r, ordem: i + 1, acumPct, classe };
  });
  const qtdA = abc.filter((r) => r.classe === "A").length;
  const top = abc[0];

  const top10 = abc.slice(0, 10).map((r) => ({
    nome: r.chave.length > 20 ? `${r.chave.slice(0, 20)}…` : r.chave,
    chave: r.chave,
    receita: r.receitaBruta,
    margem: r.margemContribuicao,
    mcPct: r.margemPct,
  }));

  const pareto = abc.slice(0, 12).map((r) => ({
    nome: r.chave.length > 12 ? `${r.chave.slice(0, 12)}…` : r.chave,
    receita: r.receitaBruta,
    acum: r.acumPct * 100,
  }));

  const top5 = abc.slice(0, 5).map((r, i) => ({
    nome: r.chave,
    valor: r.receitaBruta,
    cor: PALETA[i % PALETA.length],
  }));
  const resto = totalReceita - top5.reduce((a, r) => a + r.valor, 0);
  const donut = resto > 0 ? [...top5, { nome: "Demais itens", valor: resto, cor: "var(--muted-foreground)" }] : top5;

  const dispersao = abc.map((r) => ({
    nome: r.chave,
    receita: r.receitaBruta,
    mc: r.margemPct * 100,
    unidades: Math.max(r.unidades, 1),
    classe: r.classe,
  }));

  const corClasse = (c: string) =>
    c === "A" ? "var(--chart-1)" : c === "B" ? "var(--chart-4)" : "var(--chart-3)";

  const serieFoco = serie.map((s) => ({ ...s, ticket: safeDiv(s.receita, s.unidades) }));

  if (!ranking.length) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Sem itens para analisar</AlertTitle>
        <AlertDescription>
          Selecione períodos na aba "Base de Períodos" para popular o dashboard.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <Label className="text-xs font-semibold uppercase tracking-wide">Analisar por</Label>
          <Select value={dimensao} onValueChange={(v) => onDimensao(v as DimensaoProduto)}>
            <SelectTrigger className="h-9 w-48 bg-background">
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
          <Badge variant="secondary">{ranking.length} itens</Badge>
          {foco && (
            <Badge
              variant="outline"
              className="cursor-pointer"
              onClick={() => onFoco(null)}
            >
              Foco: {foco} ✕
            </Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            Clique em qualquer item para ver a evolução no tempo
          </span>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          titulo="Receita Bruta"
          valor={fmtMoney(totalReceita, moeda)}
          sub={`${fmtNum(totalUnid)} unidades vendidas`}
          cor="var(--chart-1)"
        />
        <KpiCard
          titulo="Margem de Contribuição"
          valor={fmtMoney(totalMc, moeda)}
          sub={`${fmtPctTable(mcPct)} da receita líquida`}
          cor="var(--chart-2)"
        />
        <KpiCard
          titulo="Ticket Médio"
          valor={fmtMoney(safeDiv(totalReceita, totalUnid), moeda)}
          sub={`${label.toLowerCase()} · média ponderada`}
          cor="var(--chart-4)"
        />
        <KpiCard
          titulo={`Top ${label}`}
          valor={fmtPctTable(top?.participacao ?? 0)}
          sub={top?.chave}
          cor="var(--chart-3)"
        />
        <KpiCard
          titulo="Concentração ABC"
          valor={`${qtdA} itens = 80%`}
          sub={`${fmtPctTable(safeDiv(qtdA, ranking.length))} do portfólio gera 80% da receita`}
          cor="var(--chart-5)"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Top 10 — Receita e Margem de Contribuição</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ left: 8, right: 24 }} barGap={2}>
                <defs>
                  <linearGradient id="gBarRec" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.85} />
                    <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.95} />
                  </linearGradient>
                </defs>
                <CartesianGrid horizontal={false} strokeOpacity={0.15} />
                <XAxis type="number" tickFormatter={(v: number) => fmtNum(v)} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis type="category" dataKey="nome" width={140} fontSize={11} tickLine={false} axisLine={false} />
                <RTooltip
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(v: number, n: string) => [fmtMoney(v, moeda), n]}
                />
                <Legend />
                <Bar
                  dataKey="receita"
                  name="Receita Bruta"
                  fill="url(#gBarRec)"
                  radius={[0, 6, 6, 0]}
                  onClick={(d: { chave?: string }) => onFoco(d?.chave ?? null)}
                  cursor="pointer"
                />
                <Bar
                  dataKey="margem"
                  name="Margem de Contribuição"
                  radius={[0, 6, 6, 0]}
                  onClick={(d: { chave?: string }) => onFoco(d?.chave ?? null)}
                  cursor="pointer"
                >
                  {top10.map((r) => (
                    <Cell
                      key={r.chave}
                      fill={r.mcPct >= 0.3 ? "var(--chart-4)" : r.mcPct >= 0 ? "var(--chart-5)" : "var(--destructive)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Concentração da receita</CardTitle>
          </CardHeader>
          <CardContent className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donut}
                  dataKey="valor"
                  nameKey="nome"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                  onClick={(d: { nome?: string }) => onFoco(d?.nome ?? null)}
                >
                  {donut.map((d) => (
                    <Cell key={d.nome} fill={d.cor} stroke="var(--background)" strokeWidth={2} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(v: number, n: string) => [
                    `${fmtMoney(v, moeda)} (${fmtPctTable(safeDiv(v, totalReceita))})`,
                    n,
                  ]}
                />
                <Legend verticalAlign="bottom" height={72} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-sm">
              Curva ABC (Pareto)
              <InfoTooltip text="As barras mostram a receita de cada item e a linha o acumulado. Itens até 80% do acumulado são classe A (prioritários), até 95% classe B e o restante classe C." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={pareto} margin={{ left: 8, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="nome" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                <YAxis yAxisId="l" tickFormatter={(v: number) => fmtNum(v)} fontSize={11} tickLine={false} axisLine={false} width={80} />
                <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} fontSize={11} tickLine={false} axisLine={false} width={45} />
                <RTooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(v: number, n: string) =>
                    n === "Acumulado" ? [`${fmtNum(v, 1)}%`, n] : [fmtMoney(v, moeda), n]
                  }
                />
                <Legend />
                <Bar yAxisId="l" dataKey="receita" name="Receita" radius={[6, 6, 0, 0]}>
                  {pareto.map((p, i) => (
                    <Cell key={p.nome} fill={PALETA[i % PALETA.length]} fillOpacity={0.9} />
                  ))}
                </Bar>
                <Line
                  yAxisId="r"
                  type="monotone"
                  dataKey="acum"
                  name="Acumulado"
                  stroke="var(--chart-3)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-1 text-sm">
              Receita x Margem — onde está o lucro
              <InfoTooltip text="Cada bolha é um item: eixo horizontal a receita, vertical a margem de contribuição %, e o tamanho as unidades vendidas. Bolhas no canto superior direito são as estrelas do portfólio." />
            </CardTitle>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                <CartesianGrid strokeOpacity={0.15} />
                <XAxis
                  type="number"
                  dataKey="receita"
                  name="Receita"
                  tickFormatter={(v: number) => fmtNum(v)}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={80}
                />
                <YAxis
                  type="number"
                  dataKey="mc"
                  name="MC %"
                  tickFormatter={(v: number) => `${fmtNum(v, 0)}%`}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                />
                <ZAxis type="number" dataKey="unidades" range={[50, 500]} />
                <RTooltip
                  contentStyle={{ borderRadius: 12 }}
                  cursor={{ strokeDasharray: "3 3" }}
                  formatter={(v: number, n: string) =>
                    n === "MC %" ? [`${fmtNum(v, 1)}%`, n] : [fmtNum(v), n]
                  }
                  labelFormatter={() => ""}
                />
                <Scatter
                  data={dispersao}
                  name="Itens"
                  onClick={(d: { nome?: string }) => onFoco(d?.nome ?? null)}
                  cursor="pointer"
                >
                  {dispersao.map((d) => (
                    <Cell key={d.nome} fill={corClasse(d.classe)} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {foco ? `Evolução — ${foco}` : "Evolução no tempo"}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-80">
          {serieFoco.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={serieFoco} margin={{ left: 8, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeOpacity={0.15} />
                <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis yAxisId="l" tickFormatter={(v: number) => fmtNum(v)} tickLine={false} axisLine={false} fontSize={11} width={80} />
                <YAxis yAxisId="r" orientation="right" tickFormatter={(v: number) => fmtNum(v)} tickLine={false} axisLine={false} fontSize={11} width={55} />
                <RTooltip
                  contentStyle={{ borderRadius: 12 }}
                  formatter={(v: number, n: string) =>
                    n === "Unidades" ? [fmtNum(v), n] : [fmtMoney(v, moeda), n]
                  }
                />
                <Legend />
                <Area
                  yAxisId="l"
                  type="monotone"
                  dataKey="receita"
                  name="Receita Bruta"
                  stroke="var(--chart-1)"
                  fill="url(#gProd)"
                  strokeWidth={2.5}
                />
                <Bar yAxisId="r" dataKey="unidades" name="Unidades" fill="var(--chart-2)" radius={[6, 6, 0, 0]} barSize={18} />
                <Line yAxisId="l" type="monotone" dataKey="ticket" name="Ticket Médio" stroke="var(--chart-3)" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Clique em um item nos gráficos ou na tabela para ver a evolução mensal.
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento por {label}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 text-center">ABC</TableHead>
                <TableHead className="min-w-48">Item</TableHead>
                <TableHead className="text-right">Unid.</TableHead>
                <TableHead className="text-right">Receita Bruta</TableHead>
                <TableHead className="min-w-32">Part. %</TableHead>
                <TableHead className="text-right">Ticket Médio</TableHead>
                <TableHead className="text-right">Custos</TableHead>
                <TableHead className="text-right">Comissões</TableHead>
                <TableHead className="text-right">Fretes</TableHead>
                <TableHead className="text-right">MC</TableHead>
                <TableHead className="text-right">MC %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {abc.map((r) => (
                <TableRow
                  key={r.chave}
                  className={`cursor-pointer ${foco === r.chave ? "bg-primary/5" : ""}`}
                  onClick={() => onFoco(r.chave)}
                >
                  <TableCell className="text-center">
                    <span
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-background"
                      style={{ background: corClasse(r.classe) }}
                    >
                      {r.classe}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">{r.chave}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.unidades)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.receitaBruta)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-full max-w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(r.participacao * 100, 100)}%`,
                            background: "var(--chart-1)",
                          }}
                        />
                      </div>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {fmtPctTable(r.participacao)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(r.ticketMedio)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(-r.custos)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(-r.comissoes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtNum(-r.fretes)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {fmtNum(r.margemContribuicao)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Badge
                      variant={r.margemPct >= 0.3 ? "secondary" : r.margemPct >= 0 ? "outline" : "destructive"}
                    >
                      {fmtPctTable(r.margemPct)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
