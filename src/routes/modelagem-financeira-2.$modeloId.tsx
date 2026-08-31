import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check, Plus, Save, Trash2, Wand2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, NumInput, PctInput } from "@/components/simpl/fields";
import { useMF2 } from "@/lib/mf2/store";
import { uid, zeros5 } from "@/lib/mf2/defaults";
import {
  MAX_CARGOS,
  MAX_DIVIDAS,
  MAX_LINHAS,
  MAX_SGA,
  MOEDAS,
  REGIMES,
  TIPOS_NEGOCIO,
  selicReal,
  somaSazonalidade,
  totalMensalCargo,
  type Ativo,
  type LinhaAnual,
  type ModeloMF2,
  type Serie5,
  type TipoAtivo,
} from "@/lib/mf2/types";
import { SGA_SUGERIDAS, SUGESTOES_NEGOCIO, progressoPreenchimento, projetarReceita } from "@/lib/mf2/calc";
import { fmtNum, fmtPct } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-financeira-2/$modeloId")({
  head: () => ({
    meta: [
      { title: "Premissas do Modelo — Modelagem Simplificada 2" },
      {
        name: "description",
        content:
          "Formulário multi-seção de premissas: receita, custos, tributação, capital de giro, ativos e dívidas.",
      },
      { property: "og:title", content: "Premissas do Modelo — Modelagem Simplificada 2" },
      {
        property: "og:description",
        content: "Estrutura completa de premissas do modelo financeiro de 5 anos.",
      },
    ],
  }),
  component: PremissasModelo,
});

const ANOS = [1, 2, 3, 4, 5];
const CATEGORIAS_ATIVO: TipoAtivo[] = ["Imobilizado", "Intangível", "Investimentos"];

function PremissasModelo() {
  const { modeloId } = Route.useParams();
  const { obterModelo, atualizarModelo, pronto } = useMF2();
  const modelo = obterModelo(modeloId);

  const receita = useMemo(() => (modelo ? projetarReceita(modelo) : null), [modelo]);

  if (!pronto) return null;

  if (!modelo) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
          <p className="font-medium">Modelo não encontrado</p>
          <Button asChild size="sm" variant="outline">
            <Link to="/modelagem-financeira-2">Voltar aos modelos</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const set = (patch: Partial<ModeloMF2>) => atualizarModelo(modelo.id, patch);
  const soma = somaSazonalidade(modelo.sazonalidade);
  const sazOk = Math.abs(soma - 1) < 0.0001;
  const progresso = progressoPreenchimento(modelo);
  const sug = SUGESTOES_NEGOCIO[modelo.tipoNegocio];
  const moeda = modelo.unidadeMonetaria;

  /* ---------- helpers de listas ---------- */
  type ChaveLinha =
    | "custosVariaveisPercentual"
    | "custosVariaveisUnitarios"
    | "custosFixos"
    | "despesasFixasSga"
    | "despesasVariaveisSga";

  const addLinha = (chave: ChaveLinha, descricao = "") =>
    set({ [chave]: [...modelo[chave], { id: uid(), descricao, valores: zeros5() }] } as Partial<ModeloMF2>);

  const setLinha = (chave: ChaveLinha, id: string, patch: Partial<LinhaAnual>) =>
    set({
      [chave]: modelo[chave].map((l) => (l.id === id ? { ...l, ...patch } : l)),
    } as Partial<ModeloMF2>);

  const delLinha = (chave: ChaveLinha, id: string) =>
    set({ [chave]: modelo[chave].filter((l) => l.id !== id) } as Partial<ModeloMF2>);

  const TabelaLinhas = ({
    chave,
    titulo,
    ajuda,
    max,
    percentual,
    sugestoes,
  }: {
    chave: ChaveLinha;
    titulo: string;
    ajuda: string;
    max: number;
    percentual?: boolean;
    sugestoes?: string[];
  }) => {
    const linhas = modelo[chave];
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
            <span>
              {titulo}{" "}
              <Badge variant="outline" className="ml-1 align-middle">
                {linhas.length}/{max}
              </Badge>
            </span>
            <div className="flex gap-2">
              {sugestoes && linhas.length === 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set({
                      [chave]: sugestoes.slice(0, max).map((d) => ({
                        id: uid(),
                        descricao: d,
                        valores: zeros5(),
                      })),
                    } as Partial<ModeloMF2>)
                  }
                >
                  <Wand2 className="mr-1.5 h-4 w-4" /> Usar nomes sugeridos
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={linhas.length >= max}
                onClick={() => addLinha(chave)}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Linha
              </Button>
            </div>
          </CardTitle>
          <p className="text-xs text-muted-foreground">{ajuda}</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {linhas.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">Nenhuma linha cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Descrição</TableHead>
                  {ANOS.map((a) => (
                    <TableHead key={a} className="text-right">
                      Ano {a}
                    </TableHead>
                  ))}
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="p-1">
                      <Input
                        className="h-8"
                        value={l.descricao}
                        placeholder="Descrição"
                        onChange={(e) => setLinha(chave, l.id, { descricao: e.target.value })}
                      />
                    </TableCell>
                    {l.valores.map((v, i) => (
                      <TableCell key={i} className="p-1">
                        {percentual ? (
                          <PctInput
                            value={v}
                            onChange={(nv) => {
                              const arr = [...l.valores] as Serie5;
                              arr[i] = nv;
                              setLinha(chave, l.id, { valores: arr });
                            }}
                          />
                        ) : (
                          <NumInput
                            value={v}
                            onChange={(nv) => {
                              const arr = [...l.valores] as Serie5;
                              arr[i] = nv;
                              setLinha(chave, l.id, { valores: arr });
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="p-1 text-right">
                      <Button size="icon" variant="ghost" onClick={() => delLinha(chave, l.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    );
  };

  /* ---------- ativos ---------- */
  const ativoDe = (tipo: TipoAtivo): Ativo =>
    modelo.ativos.find((a) => a.tipo === tipo) ?? {
      id: uid(),
      tipo,
      investimentoPorAno: zeros5(),
      taxaDepreciacaoAnual: 0,
    };

  const setAtivo = (tipo: TipoAtivo, patch: Partial<Ativo>) => {
    const atual = ativoDe(tipo);
    const existe = modelo.ativos.some((a) => a.tipo === tipo);
    set({
      ativos: existe
        ? modelo.ativos.map((a) => (a.tipo === tipo ? { ...a, ...patch } : a))
        : [...modelo.ativos, { ...atual, ...patch }],
    });
  };

  const regime = modelo.regimeTributario;

  return (
    <>
      <PageHeader
        titulo={`Premissas — ${modelo.nomeEmpresa}`}
        subtitulo={`${modelo.regimeTributario} · ${modelo.tipoNegocio} · ${moeda}`}
        action={
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/modelagem-financeira-2">
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Modelos
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                to="/modelagem-financeira-2/relatorios/dre/$modeloId"
                params={{ modeloId: modelo.id }}
              >
                Relatórios (DRE, BP, FC)
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link
                to="/modelagem-financeira-2/projecao/$modeloId"
                params={{ modeloId: modelo.id }}
              >
                Ver projeção (60 meses)
              </Link>
            </Button>

          </div>
        }
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 py-4">
          <div className="min-w-[220px] flex-1">
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-medium">Formulário preenchido</span>
              <span className="tabular-nums text-muted-foreground">{fmtPct(progresso, 0)}</span>
            </div>
            <Progress value={progresso * 100} className="h-2" />
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <Save className="h-3.5 w-3.5" /> Salvamento automático ativo
          </Badge>
        </CardContent>
      </Card>

      <Tabs defaultValue="geral">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="geral">1. Gerais</TabsTrigger>
          <TabsTrigger value="receita">2. Receita</TabsTrigger>
          <TabsTrigger value="custos">3. Custos e Despesas</TabsTrigger>
          <TabsTrigger value="tributacao">4. Tributação</TabsTrigger>
          <TabsTrigger value="giro">5. Capital de Giro</TabsTrigger>
          <TabsTrigger value="ativos">6. Ativos</TabsTrigger>
          <TabsTrigger value="dividas">7. Dívidas</TabsTrigger>
        </TabsList>

        {/* ---------------- Seção 1 ---------------- */}
        <TabsContent value="geral" className="mt-4 grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Informações gerais</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo label="Nome da empresa">
                <Input
                  className="h-8"
                  value={modelo.nomeEmpresa}
                  onChange={(e) => set({ nomeEmpresa: e.target.value })}
                />
              </Campo>
              <Campo label="Data de início do modelo">
                <Input
                  type="date"
                  className="h-8"
                  value={modelo.dataInicioModelo}
                  onChange={(e) => set({ dataInicioModelo: e.target.value })}
                />
              </Campo>
              <Campo label="Unidade monetária">
                <Select
                  value={moeda}
                  onValueChange={(v) => set({ unidadeMonetaria: v as ModeloMF2["unidadeMonetaria"] })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MOEDAS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Regime tributário">
                <Select
                  value={regime}
                  onValueChange={(v) =>
                    set({
                      regimeTributario: v as ModeloMF2["regimeTributario"],
                      tributacao: {
                        ...modelo.tributacao,
                        regime: v as ModeloMF2["regimeTributario"],
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIMES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
              <Campo label="Tipo de negócio">
                <Select
                  value={modelo.tipoNegocio}
                  onValueChange={(v) => set({ tipoNegocio: v as ModeloMF2["tipoNegocio"] })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_NEGOCIO.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Campo>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                Sugestões para {modelo.tipoNegocio}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set({
                      adiantamentoClientes: sug.adiantamentoClientes,
                      adiantamentoFornecedores: sug.adiantamentoFornecedores,
                      tributosRecuperaveis: sug.tributosRecuperaveis,
                    })
                  }
                >
                  <Wand2 className="mr-1.5 h-4 w-4" /> Aplicar sugestões
                </Button>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Percentuais típicos do setor — apenas sugestão, você pode editar livremente.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              <Campo
                label="% adiantamento de clientes"
                ajuda={`Sugerido para ${modelo.tipoNegocio}: ${fmtPct(sug.adiantamentoClientes)}`}
              >
                <PctInput
                  value={modelo.adiantamentoClientes ?? 0}
                  onChange={(v) => set({ adiantamentoClientes: v })}
                />
              </Campo>
              <Campo
                label="% adiantamento a fornecedores"
                ajuda={`Sugerido: ${fmtPct(sug.adiantamentoFornecedores)}`}
              >
                <PctInput
                  value={modelo.adiantamentoFornecedores ?? 0}
                  onChange={(v) => set({ adiantamentoFornecedores: v })}
                />
              </Campo>
              <Campo
                label="% de tributos recuperáveis"
                ajuda={`Sugerido: ${fmtPct(sug.tributosRecuperaveis)}`}
              >
                <PctInput
                  value={modelo.tributosRecuperaveis ?? 0}
                  onChange={(v) => set({ tributosRecuperaveis: v })}
                />
              </Campo>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Premissas macroeconômicas (5 anos)</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {modelo.premissasMacro.map((p, i) => (
                <div key={p.ano} className="space-y-2 rounded-md border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Ano {p.ano}</div>
                  <Campo label="IPCA">
                    <PctInput
                      value={p.ipca}
                      onChange={(v) =>
                        set({
                          premissasMacro: modelo.premissasMacro.map((x, j) =>
                            j === i ? { ...x, ipca: v } : x,
                          ),
                        })
                      }
                    />
                  </Campo>
                  <Campo label="Selic">
                    <PctInput
                      value={p.selic}
                      onChange={(v) =>
                        set({
                          premissasMacro: modelo.premissasMacro.map((x, j) =>
                            j === i ? { ...x, selic: v } : x,
                          ),
                        })
                      }
                    />
                  </Campo>
                  <div className="text-xs text-muted-foreground">
                    Selic real:{" "}
                    <span className="font-medium text-foreground">
                      {fmtPct(selicReal(p.selic, p.ipca))}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Seção 2 ---------------- */}
        <TabsContent value="receita" className="mt-4 grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  Produtos e serviços{" "}
                  <Badge variant="outline" className="ml-1 align-middle">
                    {modelo.produtos.length}
                  </Badge>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set({
                      produtos: [
                        ...modelo.produtos,
                        {
                          id: uid(),
                          nome: `Produto ${modelo.produtos.length + 1}`,
                          unidadeMedida: "un",
                          volumeAno1: 0,
                          crescimentoVolume: [0, 0, 0, 0],
                          precoAno1: 0,
                          crescimentoPreco: [0, 0, 0, 0],
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Produto
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {modelo.produtos.length === 0 && (
                <p className="py-2 text-sm text-muted-foreground">
                  Adicione ao menos um produto ou serviço para projetar a receita.
                </p>
              )}
              {modelo.produtos.map((p, idx) => {
                const proj = receita!.porProduto[idx];
                const upd = (patch: Partial<typeof p>) =>
                  set({
                    produtos: modelo.produtos.map((x) => (x.id === p.id ? { ...x, ...patch } : x)),
                  });
                return (
                  <div key={p.id} className="space-y-3 rounded-md border p-3">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                      <Campo label="Nome" className="lg:col-span-2">
                        <Input
                          className="h-8"
                          value={p.nome}
                          onChange={(e) => upd({ nome: e.target.value })}
                        />
                      </Campo>
                      <Campo label="Unidade">
                        <Input
                          className="h-8"
                          value={p.unidadeMedida}
                          onChange={(e) => upd({ unidadeMedida: e.target.value })}
                        />
                      </Campo>
                      <Campo label="Volume ano 1">
                        <NumInput value={p.volumeAno1} onChange={(v) => upd({ volumeAno1: v })} />
                      </Campo>
                      <Campo label={`Preço médio ano 1 (${moeda})`}>
                        <NumInput value={p.precoAno1} onChange={(v) => upd({ precoAno1: v })} />
                      </Campo>
                    </div>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="min-w-[150px]">Linha</TableHead>
                            {ANOS.map((a) => (
                              <TableHead key={a} className="text-right">
                                Ano {a}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">% cresc. volume</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            {p.crescimentoVolume.map((v, i) => (
                              <TableCell key={i} className="p-1">
                                <PctInput
                                  value={v}
                                  onChange={(nv) => {
                                    const arr = [...p.crescimentoVolume] as typeof p.crescimentoVolume;
                                    arr[i] = nv;
                                    upd({ crescimentoVolume: arr });
                                  }}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">% cresc. preço</TableCell>
                            <TableCell className="text-right text-muted-foreground">—</TableCell>
                            {p.crescimentoPreco.map((v, i) => (
                              <TableCell key={i} className="p-1">
                                <PctInput
                                  value={v}
                                  onChange={(nv) => {
                                    const arr = [...p.crescimentoPreco] as typeof p.crescimentoPreco;
                                    arr[i] = nv;
                                    upd({ crescimentoPreco: arr });
                                  }}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow className="bg-muted/40">
                            <TableCell className="font-medium">Volume projetado</TableCell>
                            {proj.volumes.map((v, i) => (
                              <TableCell key={i} className="text-right tabular-nums">
                                {fmtNum(v, 0)}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow className="bg-muted/40">
                            <TableCell className="font-medium">Preço projetado</TableCell>
                            {proj.precos.map((v, i) => (
                              <TableCell key={i} className="text-right tabular-nums">
                                {fmtNum(v, 2)}
                              </TableCell>
                            ))}
                          </TableRow>
                          <TableRow className="bg-muted/40">
                            <TableCell className="font-medium">Receita bruta</TableCell>
                            {proj.receitas.map((v, i) => (
                              <TableCell key={i} className="text-right font-medium tabular-nums">
                                {fmtNum(v, 0)}
                              </TableCell>
                            ))}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          set({ produtos: modelo.produtos.filter((x) => x.id !== p.id) })
                        }
                      >
                        <Trash2 className="mr-1.5 h-4 w-4 text-destructive" /> Remover produto
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Receita bruta total projetada ({moeda})</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {receita!.total.map((v, i) => (
                <div key={i} className="rounded-md border p-3">
                  <div className="text-xs text-muted-foreground">Ano {i + 1}</div>
                  <div className="text-lg font-semibold tabular-nums">{fmtNum(v, 0)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                Sazonalidade mensal
                {sazOk ? (
                  <Badge variant="secondary" className="gap-1">
                    <Check className="h-3 w-3" /> OK — 100%
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" /> Erro — {fmtPct(soma)}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() =>
                    set({
                      sazonalidade: modelo.sazonalidade.map((s) => ({ ...s, percentual: 1 / 12 })),
                    })
                  }
                >
                  Distribuir igualmente
                </Button>
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                % do volume anual em cada mês — a soma dos 12 meses precisa ser exatamente 100%.
              </p>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-12">
              {modelo.sazonalidade.map((s, i) => (
                <Campo key={s.mes} label={`Mês ${s.mes}`}>
                  <PctInput
                    value={s.percentual}
                    onChange={(v) =>
                      set({
                        sazonalidade: modelo.sazonalidade.map((x, j) =>
                          j === i ? { ...x, percentual: v } : x,
                        ),
                      })
                    }
                  />
                </Campo>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Seção 3 ---------------- */}
        <TabsContent value="custos" className="mt-4 grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  Estrutura de pessoal{" "}
                  <Badge variant="outline" className="ml-1 align-middle">
                    {modelo.cargos.length}/{MAX_CARGOS}
                  </Badge>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={modelo.cargos.length >= MAX_CARGOS}
                  onClick={() =>
                    set({
                      cargos: [
                        ...modelo.cargos,
                        {
                          id: uid(),
                          nomeCargo: "",
                          tipo: "Custo",
                          quantidade: 1,
                          salarioMensal: 0,
                          encargosPercentual: 0.7,
                          beneficiosValor: 0,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Cargo
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {modelo.cargos.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Nenhum cargo cadastrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[180px]">Cargo</TableHead>
                      <TableHead className="min-w-[130px]">Tipo</TableHead>
                      <TableHead className="text-right">Qtd.</TableHead>
                      <TableHead className="text-right">Salário</TableHead>
                      <TableHead className="text-right">% Encargos</TableHead>
                      <TableHead className="text-right">Benefícios</TableHead>
                      <TableHead className="text-right">Total mensal</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelo.cargos.map((c) => {
                      const upd = (patch: Partial<typeof c>) =>
                        set({
                          cargos: modelo.cargos.map((x) =>
                            x.id === c.id ? { ...x, ...patch } : x,
                          ),
                        });
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="p-1">
                            <Input
                              className="h-8"
                              value={c.nomeCargo}
                              placeholder="Cargo"
                              onChange={(e) => upd({ nomeCargo: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Select
                              value={c.tipo}
                              onValueChange={(v) => upd({ tipo: v as typeof c.tipo })}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Custo">Custo</SelectItem>
                                <SelectItem value="Despesa">Despesa</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-1">
                            <NumInput value={c.quantidade} onChange={(v) => upd({ quantidade: v })} />
                          </TableCell>
                          <TableCell className="p-1">
                            <NumInput
                              value={c.salarioMensal}
                              onChange={(v) => upd({ salarioMensal: v })}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <PctInput
                              value={c.encargosPercentual}
                              onChange={(v) => upd({ encargosPercentual: v })}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <NumInput
                              value={c.beneficiosValor}
                              onChange={(v) => upd({ beneficiosValor: v })}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {fmtNum(totalMensalCargo(c), 0)}
                          </TableCell>
                          <TableCell className="p-1 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                set({ cargos: modelo.cargos.filter((x) => x.id !== c.id) })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/40">
                      <TableCell colSpan={6} className="font-medium">
                        Total folha mensal
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {fmtNum(
                          modelo.cargos.reduce((a, c) => a + totalMensalCargo(c), 0),
                          0,
                        )}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <TabelaLinhas
            chave="custosVariaveisPercentual"
            titulo="Custos variáveis (% da receita)"
            ajuda="Percentual da receita bruta em cada ano."
            max={MAX_LINHAS}
            percentual
          />
          <TabelaLinhas
            chave="custosVariaveisUnitarios"
            titulo={`Custos variáveis por unidade (${moeda}/un)`}
            ajuda="Valor por unidade vendida em cada ano."
            max={MAX_LINHAS}
          />
          <TabelaLinhas
            chave="custosFixos"
            titulo={`Custos fixos mensais (${moeda})`}
            ajuda="Valor mensal em cada ano."
            max={MAX_LINHAS}
          />
          <TabelaLinhas
            chave="despesasFixasSga"
            titulo={`Despesas fixas SG&A mensais (${moeda})`}
            ajuda="Valor mensal em cada ano. Nomes sugeridos são editáveis."
            max={MAX_SGA}
            sugestoes={SGA_SUGERIDAS}
          />
          <TabelaLinhas
            chave="despesasVariaveisSga"
            titulo="Despesas variáveis SG&A (% da receita)"
            ajuda="Percentual da receita bruta em cada ano."
            max={MAX_LINHAS}
            percentual
          />
        </TabsContent>

        {/* ---------------- Seção 4 ---------------- */}
        <TabsContent value="tributacao" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tributação — {regime}</CardTitle>
              <p className="text-xs text-muted-foreground">
                Apenas os campos relevantes para o regime selecionado na Seção 1.
              </p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {regime === "Simples Nacional" ? (
                <Campo label="% DAS sobre receita bruta">
                  <PctInput
                    value={modelo.tributacao.aliquotaDas}
                    onChange={(v) => set({ tributacao: { ...modelo.tributacao, aliquotaDas: v } })}
                  />
                </Campo>
              ) : (
                <>
                  {(
                    [
                      ["% ICMS sobre receita bruta", "aliquotaIcms"],
                      ["% ISS sobre receita bruta", "aliquotaIss"],
                      ["% IPI sobre receita bruta", "aliquotaIpi"],
                      ["% PIS/COFINS sobre receita bruta", "aliquotaPisCofins"],
                    ] as const
                  ).map(([label, chave]) => (
                    <Campo key={chave} label={label}>
                      <PctInput
                        value={modelo.tributacao[chave]}
                        onChange={(v) => set({ tributacao: { ...modelo.tributacao, [chave]: v } })}
                      />
                    </Campo>
                  ))}
                  <Campo
                    label={
                      regime === "Lucro Real"
                        ? "% IRPJ + CSLL sobre o lucro antes do imposto (EBT)"
                        : "% IRPJ + CSLL sobre receita bruta (presumido)"
                    }
                  >
                    <PctInput
                      value={modelo.tributacao.aliquotaIrpjCsll}
                      onChange={(v) =>
                        set({ tributacao: { ...modelo.tributacao, aliquotaIrpjCsll: v } })
                      }
                    />
                  </Campo>
                  {regime === "Lucro Real" && (
                    <Campo label="% créditos tributários recuperáveis sobre receita">
                      <PctInput
                        value={modelo.tributacao.percentualCreditosTributarios}
                        onChange={(v) =>
                          set({
                            tributacao: {
                              ...modelo.tributacao,
                              percentualCreditosTributarios: v,
                            },
                          })
                        }
                      />
                    </Campo>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Seção 5 ---------------- */}
        <TabsContent value="giro" className="mt-4 grid gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Capital de giro</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["Dias médios de recebimento", "diasRecebimento"],
                  ["Dias médios de estoque", "diasEstoque"],
                  ["Dias médios de pagamento", "diasPagamento"],
                ] as const
              ).map(([label, chave]) => (
                <Campo key={chave} label={label}>
                  <NumInput
                    value={modelo.capitalGiro[chave]}
                    onChange={(v) => set({ capitalGiro: { ...modelo.capitalGiro, [chave]: v } })}
                  />
                </Campo>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Capital social e caixa</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <Campo label={`Saldo de caixa inicial (${moeda})`}>
                <NumInput
                  value={modelo.caixaCapital.saldoCaixaInicial}
                  onChange={(v) =>
                    set({ caixaCapital: { ...modelo.caixaCapital, saldoCaixaInicial: v } })
                  }
                />
              </Campo>
              {modelo.caixaCapital.aportesReducaoCapital.map((v, i) => (
                <Campo
                  key={i}
                  label={`Aporte/redução ano ${i + 1}`}
                  ajuda="Valores negativos representam redução de capital."
                >
                  <NumInput
                    value={v}
                    onChange={(nv) => {
                      const arr = [...modelo.caixaCapital.aportesReducaoCapital] as Serie5;
                      arr[i] = nv;
                      set({ caixaCapital: { ...modelo.caixaCapital, aportesReducaoCapital: arr } });
                    }}
                  />
                </Campo>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- Seção 6 ---------------- */}
        <TabsContent value="ativos" className="mt-4 grid gap-6">
          {CATEGORIAS_ATIVO.map((tipo) => {
            const a = ativoDe(tipo);
            return (
              <Card key={tipo}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{tipo}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Investimento (CAPEX) por ano em {moeda}
                    {tipo !== "Investimentos" && " e taxa anual sobre o saldo"}.
                  </p>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {a.investimentoPorAno.map((v, i) => (
                    <Campo key={i} label={`Ano ${i + 1}`}>
                      <NumInput
                        value={v}
                        onChange={(nv) => {
                          const arr = [...a.investimentoPorAno] as Serie5;
                          arr[i] = nv;
                          setAtivo(tipo, { investimentoPorAno: arr });
                        }}
                      />
                    </Campo>
                  ))}
                  {tipo !== "Investimentos" && (
                    <Campo
                      label={tipo === "Imobilizado" ? "% depreciação a.a." : "% amortização a.a."}
                    >
                      <PctInput
                        value={a.taxaDepreciacaoAnual}
                        onChange={(v) => setAtivo(tipo, { taxaDepreciacaoAnual: v })}
                      />
                    </Campo>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* ---------------- Seção 7 ---------------- */}
        <TabsContent value="dividas" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
                <span>
                  Dívidas e financiamentos{" "}
                  <Badge variant="outline" className="ml-1 align-middle">
                    {modelo.dividas.length}/{MAX_DIVIDAS}
                  </Badge>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={modelo.dividas.length >= MAX_DIVIDAS}
                  onClick={() =>
                    set({
                      dividas: [
                        ...modelo.dividas,
                        {
                          id: uid(),
                          nome: `Dívida ${modelo.dividas.length + 1}`,
                          valorCaptacao: 0,
                          mesCaptacao: modelo.dataInicioModelo,
                          prazoMeses: 36,
                          taxaJurosAnual: 0.18,
                        },
                      ],
                    })
                  }
                >
                  <Plus className="mr-1.5 h-4 w-4" /> Dívida
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {modelo.dividas.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">Nenhuma dívida cadastrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[160px]">Nome</TableHead>
                      <TableHead className="text-right">Valor da captação</TableHead>
                      <TableHead>Mês da captação</TableHead>
                      <TableHead className="text-right">Prazo (meses)</TableHead>
                      <TableHead className="text-right">Juros a.a.</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modelo.dividas.map((d) => {
                      const upd = (patch: Partial<typeof d>) =>
                        set({
                          dividas: modelo.dividas.map((x) =>
                            x.id === d.id ? { ...x, ...patch } : x,
                          ),
                        });
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="p-1">
                            <Input
                              className="h-8"
                              value={d.nome}
                              onChange={(e) => upd({ nome: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <NumInput
                              value={d.valorCaptacao}
                              onChange={(v) => upd({ valorCaptacao: v })}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <Input
                              type="date"
                              className="h-8"
                              value={d.mesCaptacao}
                              onChange={(e) => upd({ mesCaptacao: e.target.value })}
                            />
                          </TableCell>
                          <TableCell className="p-1">
                            <NumInput value={d.prazoMeses} onChange={(v) => upd({ prazoMeses: v })} />
                          </TableCell>
                          <TableCell className="p-1">
                            <PctInput
                              value={d.taxaJurosAnual}
                              onChange={(v) => upd({ taxaJurosAnual: v })}
                            />
                          </TableCell>
                          <TableCell className="p-1 text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() =>
                                set({ dividas: modelo.dividas.filter((x) => x.id !== d.id) })
                              }
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
