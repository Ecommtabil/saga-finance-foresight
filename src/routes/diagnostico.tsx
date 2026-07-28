import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/saga/PageHeader";
import { EmptyState } from "@/components/saga/EmptyState";
import { useSaga } from "@/lib/saga/context";
import {
  margens,
  indicadoresLiquidez,
  indicadoresEndividamento,
  indicadoresRentabilidade,
} from "@/lib/saga/calculations";
import { fmtPct, fmtMult, safeDiv } from "@/lib/saga/formatters";

export const Route = createFileRoute("/diagnostico")({
  head: () => ({
    meta: [
      { title: "Diagnóstico — SAGA" },
      { name: "description", content: "Diagnóstico financeiro consolidado: lucratividade, gestão e endividamento." },
      { property: "og:title", content: "Diagnóstico — SAGA" },
      { property: "og:description", content: "Painel de diagnóstico com semáforo de saúde financeira." },
    ],
  }),
  component: DiagnosticoPage,
});

type Status = "bom" | "atencao" | "ruim" | "neutro";

function classificar(valor: number, bom: number, atencao: number, maiorMelhor = true): Status {
  if (!isFinite(valor)) return "neutro";
  if (maiorMelhor) {
    if (valor >= bom) return "bom";
    if (valor >= atencao) return "atencao";
    return "ruim";
  }
  if (valor <= bom) return "bom";
  if (valor <= atencao) return "atencao";
  return "ruim";
}

const STATUS_STYLE: Record<Status, { dot: string; label: string; text: string }> = {
  bom: { dot: "bg-emerald-500", label: "Saudável", text: "text-emerald-700" },
  atencao: { dot: "bg-amber-500", label: "Atenção", text: "text-amber-700" },
  ruim: { dot: "bg-red-500", label: "Crítico", text: "text-red-700" },
  neutro: { dot: "bg-muted-foreground", label: "—", text: "text-muted-foreground" },
};

function IndicadorCard({
  titulo,
  valor,
  status,
  interpretacao,
  referencia,
}: {
  titulo: string;
  valor: string;
  status: Status;
  interpretacao: string;
  referencia: string;
}) {
  const s = STATUS_STYLE[status];
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {titulo}
          </CardTitle>
          <span className={`flex items-center gap-1.5 text-[10px] font-medium ${s.text}`}>
            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
            {s.label}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{valor}</div>
        <p className="mt-2 text-xs text-foreground/80">{interpretacao}</p>
        <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
          Referência: {referencia}
        </p>
      </CardContent>
    </Card>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3 rounded-md bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground">
        {titulo}
      </div>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

function DiagnosticoPage() {
  const { dados, modo } = useSaga();
  if (!dados) {
    return (
      <>
        <PageHeader titulo="Diagnóstico" />
        <EmptyState titulo="Diagnóstico indisponível" />
      </>
    );
  }

  const last = dados.anos.length - 1;
  const m = margens(dados);
  const rent = indicadoresRentabilidade(dados);
  const liq = indicadoresLiquidez(dados);
  const end = indicadoresEndividamento(dados);

  const mBruta = m.bruta[last];
  const mEbitda = m.ebitda[last];
  const mOp = m.operacional[last];
  const mLiq = m.liquida[last];

  const roe = rent.roe[last];
  const roa = rent.roa[last];
  const roic = rent.roic[last];
  const giroAtivo = dados.balanco
    ? safeDiv(dados.dre.receitaLiquida[last], dados.balanco.ativoTotal[last])
    : NaN;

  const divPL = end?.dividaSobrePL[last] ?? NaN;
  const divAtivo = end?.dividaSobreAtivo[last] ?? NaN;
  const cobJuros = end?.coberturaJuros[last] ?? NaN;
  const liqCorr = liq?.corrente[last] ?? NaN;

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Diagnóstico"
        subtitulo={`Leitura consolidada do ano base (${dados.anos[last]}) com semáforo de saúde financeira.`}
      />

      <Secao titulo="Lucratividade">
        <IndicadorCard
          titulo="Margem Bruta"
          valor={fmtPct(mBruta)}
          status={classificar(mBruta, 0.4, 0.2)}
          interpretacao={
            mBruta >= 0.4
              ? "Boa eficiência na produção/entrega, sobra saudável após CMV."
              : mBruta >= 0.2
                ? "Margem apertada — revisar custos diretos e política de preços."
                : "Margem crítica — o CMV consome quase toda a receita."
          }
          referencia="≥ 40% saudável • 20–40% atenção"
        />
        <IndicadorCard
          titulo="Margem EBITDA"
          valor={fmtPct(mEbitda)}
          status={classificar(mEbitda, 0.15, 0.08)}
          interpretacao={
            mEbitda >= 0.15
              ? "Geração de caixa operacional consistente."
              : mEbitda >= 0.08
                ? "Caixa operacional limitado — controle despesas fixas."
                : "Operação pressiona o caixa; risco de sustentabilidade."
          }
          referencia="≥ 15% saudável • 8–15% atenção"
        />
        <IndicadorCard
          titulo="Margem Operacional"
          valor={fmtPct(mOp)}
          status={classificar(mOp, 0.1, 0.04)}
          interpretacao={
            mOp >= 0.1
              ? "Operação rentável mesmo após depreciação."
              : mOp >= 0.04
                ? "Rentabilidade operacional baixa — avaliar eficiência."
                : "Operação não cobre estrutura — revisão urgente."
          }
          referencia="≥ 10% saudável • 4–10% atenção"
        />
        <IndicadorCard
          titulo="Margem Líquida"
          valor={fmtPct(mLiq)}
          status={classificar(mLiq, 0.08, 0.03)}
          interpretacao={
            mLiq >= 0.08
              ? "Cada real de receita gera lucro final relevante."
              : mLiq >= 0.03
                ? "Lucro final apertado — pouca folga para reinvestir."
                : "Resultado final crítico ou negativo."
          }
          referencia="≥ 8% saudável • 3–8% atenção"
        />
      </Secao>

      <Secao titulo="Gestão">
        <IndicadorCard
          titulo="ROE"
          valor={fmtPct(roe)}
          status={classificar(roe, 0.15, 0.08)}
          interpretacao={
            roe >= 0.15
              ? "Excelente retorno sobre o capital do sócio."
              : roe >= 0.08
                ? "Retorno moderado — comparar com custo de oportunidade."
                : "Retorno baixo para o risco do negócio."
          }
          referencia="≥ 15% saudável • 8–15% atenção"
        />
        <IndicadorCard
          titulo="ROA"
          valor={fmtPct(roa)}
          status={classificar(roa, 0.08, 0.04)}
          interpretacao={
            roa >= 0.08
              ? "Ativos bem aproveitados na geração de lucro."
              : roa >= 0.04
                ? "Aproveitamento parcial dos ativos."
                : "Ativos ociosos ou pouco produtivos."
          }
          referencia="≥ 8% saudável • 4–8% atenção"
        />
        <IndicadorCard
          titulo="ROIC"
          valor={fmtPct(roic)}
          status={classificar(roic, 0.12, 0.06)}
          interpretacao={
            roic >= 0.12
              ? "Capital investido gera valor acima do custo típico."
              : roic >= 0.06
                ? "Retorno próximo do custo de capital — atenção."
                : "Destruição de valor: retorno abaixo do custo de capital."
          }
          referencia="≥ 12% saudável • 6–12% atenção"
        />
        <IndicadorCard
          titulo="Giro do Ativo"
          valor={isFinite(giroAtivo) ? fmtMult(giroAtivo, 2) : "—"}
          status={classificar(giroAtivo, 1, 0.5)}
          interpretacao={
            !isFinite(giroAtivo)
              ? "Disponível apenas no modo Contabilidade Completa."
              : giroAtivo >= 1
                ? "Ativos giram bem e sustentam a receita."
                : giroAtivo >= 0.5
                  ? "Giro médio — parte do ativo pouco produtiva."
                  : "Ativos pesados frente à receita gerada."
          }
          referencia="≥ 1,0x saudável • 0,5–1,0x atenção"
        />
      </Secao>

      <Secao titulo="Endividamento">
        <IndicadorCard
          titulo="Dívida / PL"
          valor={isFinite(divPL) ? fmtMult(divPL, 2) : "—"}
          status={classificar(divPL, 0.5, 1, false)}
          interpretacao={
            !isFinite(divPL)
              ? "Disponível apenas no modo Contabilidade Completa."
              : divPL <= 0.5
                ? "Estrutura pouco alavancada, boa folga financeira."
                : divPL <= 1
                  ? "Alavancagem moderada — monitorar prazos."
                  : "Alta dependência de dívida frente ao capital próprio."
          }
          referencia="≤ 0,5x saudável • 0,5–1,0x atenção"
        />
        <IndicadorCard
          titulo="Dívida / Ativo"
          valor={isFinite(divAtivo) ? fmtPct(divAtivo) : "—"}
          status={classificar(divAtivo, 0.3, 0.5, false)}
          interpretacao={
            !isFinite(divAtivo)
              ? "Disponível apenas no modo Contabilidade Completa."
              : divAtivo <= 0.3
                ? "Baixa participação de dívida na estrutura de ativos."
                : divAtivo <= 0.5
                  ? "Alavancagem média sobre os ativos."
                  : "Ativos majoritariamente financiados por dívida."
          }
          referencia="≤ 30% saudável • 30–50% atenção"
        />
        <IndicadorCard
          titulo="Cobertura de Juros"
          valor={isFinite(cobJuros) ? fmtMult(cobJuros, 2) : "—"}
          status={classificar(cobJuros, 3, 1.5)}
          interpretacao={
            !isFinite(cobJuros)
              ? "Disponível apenas no modo Contabilidade Completa."
              : cobJuros >= 3
                ? "EBIT cobre folgadamente as despesas financeiras."
                : cobJuros >= 1.5
                  ? "Cobertura apertada — vulnerável a alta de juros."
                  : "EBIT insuficiente para cobrir os juros."
          }
          referencia="≥ 3,0x saudável • 1,5–3,0x atenção"
        />
        <IndicadorCard
          titulo="Liquidez Corrente"
          valor={isFinite(liqCorr) ? fmtMult(liqCorr, 2) : "—"}
          status={classificar(liqCorr, 1.5, 1)}
          interpretacao={
            !isFinite(liqCorr)
              ? "Disponível apenas no modo Contabilidade Completa."
              : liqCorr >= 1.5
                ? "Curto prazo confortável para honrar obrigações."
                : liqCorr >= 1
                  ? "Curto prazo equilibrado, sem folga relevante."
                  : "Passivo circulante maior que o ativo circulante."
          }
          referencia="≥ 1,5x saudável • 1,0–1,5x atenção"
        />
      </Secao>

      {modo === "basica" && (
        <p className="text-xs text-muted-foreground">
          Alguns indicadores de gestão e endividamento exigem o Balanço Patrimonial (modo Contabilidade Completa).
        </p>
      )}
    </div>
  );
}