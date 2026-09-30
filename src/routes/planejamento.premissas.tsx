import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Download, FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePlanejamento } from "@/lib/pob/store";
import { MESES_POB } from "@/lib/pob/types";
import { baixarModeloPOB } from "@/lib/pob/template";
import { lerPlanilhaPOB, type ResumoImportacaoPOB } from "@/lib/pob/import";
import {
  folhaMensal,
  receitaBrutaAnual,
  somaMeses,
  totalPremissas,
  type PremissasPOB,
} from "@/lib/pob/premissas";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/saga/formatters";
import { PremissasEditor } from "@/components/pob/PremissasEditor";

export const Route = createFileRoute("/planejamento/premissas")({
  head: () => ({
    meta: [
      { title: "Premissas do Orçamento | SAGA" },
      {
        name: "description",
        content:
          "Importe a planilha modelo com vendas, impostos, produção, matéria-prima, mão de obra, custos, despesas, CAPEX e empréstimos.",
      },
      { property: "og:title", content: "Premissas do Orçamento | SAGA" },
      {
        property: "og:description",
        content: "Preencha um cenário orçamentário inteiro a partir de uma planilha Excel.",
      },
    ],
  }),
  component: PremissasPage,
});

function PremissasPage() {
  const { cenario, atualizar } = usePlanejamento();
  const inputRef = useRef<HTMLInputElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ultimo, setUltimo] = useState<ResumoImportacaoPOB | null>(null);
  const [carregando, setCarregando] = useState(false);

  const premissas = cenario?.premissas;
  const preenchido = totalPremissas(premissas) > 0;

  async function onArquivo(file: File) {
    setCarregando(true);
    setErro(null);
    try {
      const buf = await file.arrayBuffer();
      const r = lerPlanilhaPOB(buf);
      if (totalPremissas(r.premissas) === 0) {
        setErro("Não encontramos dados preenchidos na planilha. Use a planilha modelo e preencha as abas.");
        setUltimo(null);
      } else {
        atualizar({ premissas: r.premissas });
        setUltimo(r);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível ler o arquivo.");
    } finally {
      setCarregando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-6">
      <PremissasEditor />
      <Card>
        <CardHeader>
          <CardTitle>Premissas por planilha</CardTitle>
          <CardDescription>
            Baixe a planilha modelo, preencha no Excel e faça o upload para preencher todo o cenário
            {cenario ? ` “${cenario.nome}”` : ""}: vendas, impostos, produção, matéria-prima, mão de obra,
            custos indiretos, despesas, CAPEX e empréstimos.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => baixarModeloPOB()}>
              <Download className="mr-2 h-4 w-4" /> Baixar planilha modelo
            </Button>
            <Button onClick={() => inputRef.current?.click()} disabled={carregando}>
              <Upload className="mr-2 h-4 w-4" />
              {carregando ? "Lendo arquivo..." : "Importar planilha preenchida"}
            </Button>
            {preenchido && (
              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => {
                  atualizar({ premissas: undefined });
                  setUltimo(null);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Limpar premissas
              </Button>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onArquivo(f);
              }}
            />
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Não foi possível importar</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}

          {ultimo && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Planilha importada</AlertTitle>
              <AlertDescription>
                <div className="mt-2 flex flex-wrap gap-2">
                  {ultimo.resumo.map((r) => (
                    <Badge key={r.aba} variant={r.itens ? "secondary" : "outline"}>
                      {r.aba}: {r.itens}
                    </Badge>
                  ))}
                </div>
                {ultimo.avisos.length > 0 && (
                  <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
                    {ultimo.avisos.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {!preenchido || !premissas ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma premissa carregada neste cenário. Comece baixando a planilha modelo.
            </p>
            <Button variant="outline" onClick={() => baixarModeloPOB()}>
              <Download className="mr-2 h-4 w-4" /> Baixar planilha modelo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <PremissasCarregadas premissas={premissas} moeda={cenario?.moeda ?? "R$"} />
      )}
    </div>
  );
}

function Kpi({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{valor}</p>
      </CardContent>
    </Card>
  );
}

function PremissasCarregadas({ premissas: p, moeda }: { premissas: PremissasPOB; moeda: string }) {
  const custoIndiretoAno = p.custosIndiretos.reduce((a, l) => a + somaMeses(l.valores), 0);
  const despesasAno = p.despesas.reduce((a, l) => a + somaMeses(l.valores), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi titulo="Receita bruta anual" valor={fmtMoney(receitaBrutaAnual(p), moeda)} />
        <Kpi titulo="Folha mensal" valor={fmtMoney(folhaMensal(p), moeda)} />
        <Kpi titulo="Custos indiretos (ano)" valor={fmtMoney(custoIndiretoAno, moeda)} />
        <Kpi titulo="Despesas operacionais (ano)" valor={fmtMoney(despesasAno, moeda)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados importados</CardTitle>
          <CardDescription>Confira o que foi lido da planilha antes de projetar o orçamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="vendas">
            <TabsList className="flex flex-wrap">
              <TabsTrigger value="vendas">Vendas</TabsTrigger>
              <TabsTrigger value="impostos">Impostos e produção</TabsTrigger>
              <TabsTrigger value="mp">Matéria-prima</TabsTrigger>
              <TabsTrigger value="mo">Mão de obra</TabsTrigger>
              <TabsTrigger value="custos">Custos e despesas</TabsTrigger>
              <TabsTrigger value="capex">CAPEX e empréstimos</TabsTrigger>
            </TabsList>

            <TabsContent value="vendas" className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead className="text-right">Preço</TableHead>
                    {MESES_POB.map((m) => (
                      <TableHead key={m} className="text-right">
                        {m}
                      </TableHead>
                    ))}
                    <TableHead className="text-right">Receita ano</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.produtos.map((prod) => (
                    <TableRow key={prod.id}>
                      <TableCell className="font-medium">{prod.nome}</TableCell>
                      <TableCell>{prod.unidade}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMoney(prod.precoUnitario, moeda)}
                      </TableCell>
                      {prod.volume.map((v, i) => (
                        <TableCell key={i} className="text-right tabular-nums">
                          {fmtNum(v)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtMoney(somaMeses(prod.volume) * prod.precoUnitario, moeda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="impostos" className="mt-4 grid gap-6 md:grid-cols-2">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tributo</TableHead>
                    <TableHead className="text-right">Alíquota</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ["ICMS", p.impostos.icms],
                    ["ISS", p.impostos.iss],
                    ["IPI", p.impostos.ipi],
                    ["PIS/COFINS", p.impostos.pisCofins],
                    ["IRPJ/CSLL", p.impostos.irpjCsll],
                    ["Créditos tributários", p.impostos.creditos],
                  ].map(([nome, v]) => (
                    <TableRow key={String(nome)}>
                      <TableCell>{nome}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(Number(v))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produção</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Estoque inicial de acabados</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNum(p.producao.estoqueInicialAcabado)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Dias de estoque de acabados</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtNum(p.producao.diasEstoqueAcabado)}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Perda de processo</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPct(p.producao.perdaProcessoPct)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="mp" className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Un.</TableHead>
                    <TableHead className="text-right">Custo unitário</TableHead>
                    <TableHead className="text-right">Consumo/un.</TableHead>
                    <TableHead className="text-right">Dias estoque</TableHead>
                    <TableHead className="text-right">Dias pagamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.materiasPrimas.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.nome}</TableCell>
                      <TableCell>{m.unidade}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(m.custoUnitario, moeda)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(m.consumoPorUnidade, 2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(m.diasEstoque)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(m.diasPagamento)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="mo" className="mt-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Qtd.</TableHead>
                    <TableHead className="text-right">Salário</TableHead>
                    <TableHead className="text-right">Encargos</TableHead>
                    <TableHead className="text-right">Benefícios</TableHead>
                    <TableHead className="text-right">Total mensal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.maoDeObra.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.cargo}</TableCell>
                      <TableCell>{c.tipo}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtNum(c.quantidade)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(c.salarioMensal, moeda)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtPct(c.encargosPct)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtMoney(c.beneficios, moeda)}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtMoney((c.salarioMensal * (1 + c.encargosPct) + c.beneficios) * c.quantidade, moeda)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="custos" className="mt-4 space-y-6 overflow-x-auto">
              {[
                { titulo: "Custos indiretos de fabricação", linhas: p.custosIndiretos },
                { titulo: "Despesas operacionais", linhas: p.despesas },
              ].map((bloco) => (
                <div key={bloco.titulo}>
                  <h3 className="mb-2 text-sm font-semibold">{bloco.titulo}</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Descrição</TableHead>
                        {MESES_POB.map((m) => (
                          <TableHead key={m} className="text-right">
                            {m}
                          </TableHead>
                        ))}
                        <TableHead className="text-right">Ano</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bloco.linhas.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell className="font-medium">{l.descricao}</TableCell>
                          {l.valores.map((v, i) => (
                            <TableCell key={i} className="text-right tabular-nums">
                              {fmtNum(v)}
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-medium tabular-nums">
                            {fmtMoney(somaMeses(l.valores), moeda)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="capex" className="mt-4 grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-semibold">Investimentos (CAPEX)</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Mês</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Depreciação a.a.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.capex.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.descricao}</TableCell>
                        <TableCell className="text-right">{MESES_POB[c.mes - 1]}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(c.valor, moeda)}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPct(c.depreciacaoAnualPct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold">Empréstimos</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Captação</TableHead>
                      <TableHead className="text-right">Prazo</TableHead>
                      <TableHead className="text-right">Juros a.a.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {p.emprestimos.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">{e.nome}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtMoney(e.valor, moeda)}</TableCell>
                        <TableCell className="text-right">{MESES_POB[e.mesCaptacao - 1]}</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtNum(e.prazoMeses)} m</TableCell>
                        <TableCell className="text-right tabular-nums">{fmtPct(e.jurosAnualPct)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
