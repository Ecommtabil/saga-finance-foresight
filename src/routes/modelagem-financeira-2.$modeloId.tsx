import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/saga/PageHeader";
import { Campo, PctInput } from "@/components/simpl/fields";
import { useMF2 } from "@/lib/mf2/store";
import { selicReal, somaSazonalidade } from "@/lib/mf2/types";
import { fmtPct } from "@/lib/saga/formatters";

export const Route = createFileRoute("/modelagem-financeira-2/$modeloId")({
  head: () => ({
    meta: [
      { title: "Premissas do Modelo — Modelagem Financeira 2" },
      {
        name: "description",
        content: "Wizard de premissas: macroeconomia, sazonalidade e blocos de dados do modelo.",
      },
      { property: "og:title", content: "Premissas do Modelo — Modelagem Financeira 2" },
      { property: "og:description", content: "Estrutura de premissas do modelo financeiro." },
    ],
  }),
  component: PremissasModelo,
});

const BLOCOS: { titulo: string; descricao: string; chave: string }[] = [
  { titulo: "Produtos", descricao: "Produtos dinâmicos com volume, preço e crescimento anual", chave: "produtos" },
  { titulo: "Cargos", descricao: "Até 15 cargos, custo ou despesa, com encargos e benefícios", chave: "cargos" },
  { titulo: "Custos variáveis (%)", descricao: "Percentual da receita por ano", chave: "custosVariaveisPercentual" },
  { titulo: "Custos variáveis (unitários)", descricao: "Valor por unidade por ano", chave: "custosVariaveisUnitarios" },
  { titulo: "Custos fixos", descricao: "Valor mensal por ano", chave: "custosFixos" },
  { titulo: "Despesas fixas SG&A", descricao: "Valor mensal por ano", chave: "despesasFixasSga" },
  { titulo: "Despesas variáveis SG&A", descricao: "Percentual da receita por ano", chave: "despesasVariaveisSga" },
  { titulo: "Ativos", descricao: "Imobilizado, intangível e investimentos com depreciação", chave: "ativos" },
  { titulo: "Dívidas", descricao: "Até 5 captações com prazo e juros", chave: "dividas" },
];

function PremissasModelo() {
  const { modeloId } = Route.useParams();
  const { obterModelo, atualizarModelo, pronto } = useMF2();
  const modelo = obterModelo(modeloId);

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

  const soma = somaSazonalidade(modelo.sazonalidade);
  const sazonalidadeOk = Math.abs(soma - 1) < 0.0001;
  const contagem = (chave: string) => (modelo[chave as keyof typeof modelo] as unknown[]).length;

  return (
    <>
      <PageHeader
        titulo={`Premissas — ${modelo.nomeEmpresa}`}
        subtitulo={`${modelo.regimeTributario} · ${modelo.tipoNegocio} · ${modelo.unidadeMonetaria}`}
        action={
          <Button asChild size="sm" variant="outline">
            <Link to="/modelagem-financeira-2">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Modelos
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6">
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
                      atualizarModelo(modelo.id, {
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
                      atualizarModelo(modelo.id, {
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              Sazonalidade mensal
              {sazonalidadeOk ? (
                <Badge variant="secondary" className="gap-1">
                  <Check className="h-3 w-3" /> 100%
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {fmtPct(soma)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-12">
            {modelo.sazonalidade.map((s, i) => (
              <Campo key={s.mes} label={`Mês ${s.mes}`}>
                <PctInput
                  value={s.percentual}
                  onChange={(v) =>
                    atualizarModelo(modelo.id, {
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

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Capital de giro e caixa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-4">
            {(
              [
                ["Dias de recebimento", "diasRecebimento"],
                ["Dias de estoque", "diasEstoque"],
                ["Dias de pagamento", "diasPagamento"],
              ] as const
            ).map(([label, chave]) => (
              <Campo key={chave} label={label}>
                <Input
                  type="number"
                  className="h-8"
                  value={modelo.capitalGiro[chave]}
                  onChange={(e) =>
                    atualizarModelo(modelo.id, {
                      capitalGiro: { ...modelo.capitalGiro, [chave]: Number(e.target.value) || 0 },
                    })
                  }
                />
              </Campo>
            ))}
            <Campo label="Saldo de caixa inicial">
              <Input
                type="number"
                className="h-8"
                value={modelo.caixaCapital.saldoCaixaInicial}
                onChange={(e) =>
                  atualizarModelo(modelo.id, {
                    caixaCapital: {
                      ...modelo.caixaCapital,
                      saldoCaixaInicial: Number(e.target.value) || 0,
                    },
                  })
                }
              />
            </Campo>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Demais blocos do modelo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {BLOCOS.map((b) => (
              <div key={b.chave} className="rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{b.titulo}</span>
                  <Badge variant="outline">{contagem(b.chave)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{b.descricao}</p>
                <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                  Edição no próximo passo do wizard
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
