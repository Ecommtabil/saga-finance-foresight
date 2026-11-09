import type { ReactNode } from "react";
import type { ResultadoNCG } from "@/lib/ncg/engine";
import { componentesNCG, diasTexto, percentualTexto } from "@/lib/ncg/apresentacao";
import { diasDoPeriodo, formatarMoeda, type PremissasNCG } from "@/lib/ncg/premissas";

export interface NcgResultadoProps { premissas: PremissasNCG; resultado: ResultadoNCG }

export function SecaoNCG({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <section className="ncg-report-section min-w-0"><h2>{titulo}</h2>{children}</section>;
}

function Tabela({ cabecalho, linhas }: { cabecalho: string[]; linhas: ReactNode[][] }) {
  return <div className="overflow-x-auto rounded-lg border border-ncg-border"><table className="ncg-table">
    <thead><tr>{cabecalho.map(c => <th key={c} scope="col">{c}</th>)}</tr></thead>
    <tbody>{linhas.map((linha, i) => <tr key={i}>{linha.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
  </table></div>;
}

export function StatusNCG({ coberto }: { coberto: boolean }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${coberto ? "bg-ncg-success/10 text-ncg-success" : "bg-ncg-negative/10 text-ncg-negative"}`}>{coberto ? "Giro coberto" : "Falta giro"}</span>;
}

export function MemorialNCG({ premissas: p, resultado: r }: NcgResultadoProps) {
  const custo = p.segmento === "industria" ? "CPV" : "CMV";
  return <div className="space-y-8 text-ncg-ink">
    <div><p className="text-xs font-medium uppercase text-ncg-muted">Relatório técnico · {diasTexto(diasDoPeriodo(p))}</p><h2 className="mt-2 text-2xl font-semibold">Memorial de cálculo</h2></div>
    <SecaoNCG titulo="Prazos médios">
      <Tabela cabecalho={["Prazo", "Valor em dias", "Fórmula"]} linhas={[
        ["PMR — Prazo médio de recebimento", diasTexto(r.prazos.pmr), "Saldo médio de clientes ÷ vendas do período × dias do período"],
        ["PME — Prazo médio de estocagem", diasTexto(r.prazos.pme), `Saldo médio de estoques ÷ ${custo} do período × dias do período`],
        ["PMP — Prazo médio de pagamento", diasTexto(r.prazos.pmp), "Saldo médio de fornecedores ÷ compras do período × dias do período"],
        ["Ciclo operacional", diasTexto(r.prazos.cicloOperacional), "PME + PMR"],
        ["Ciclo financeiro", diasTexto(r.prazos.cicloFinanceiro), "PME + PMR − PMP"],
      ]}/>
    </SecaoNCG>
    <SecaoNCG titulo="Bases diárias">
      <Tabela cabecalho={["Base", "Valor por dia", "Fórmula"]} linhas={[
        ["Vendas", formatarMoeda(r.bases.vendasDia), "Vendas do período ÷ dias do período"],
        [custo, formatarMoeda(r.bases.cmvDia), `${custo} do período ÷ dias do período`],
        ["Compras", formatarMoeda(r.bases.comprasDia), "Compras do período ÷ dias do período"],
        ["Despesas fixas", formatarMoeda(r.bases.despFixasDia), "Despesas fixas do período ÷ dias do período"],
      ]}/>
    </SecaoNCG>
    <SecaoNCG titulo="Necessidade de capital de giro operacional">
      <Tabela cabecalho={["Componente", "Valor", "Dias aplicados", "Lógica"]} linhas={[
        ...componentesNCG(r, p).map(c => [c.nome, <span className={c.valor < 0 ? "text-ncg-negative" : "text-ncg-positive"}>{formatarMoeda(c.valor)}</span>, c.dias === null ? "—" : diasTexto(c.dias), c.logica]),
        [<strong>NCG operacional</strong>, <strong>{formatarMoeda(r.ncg.total)}</strong>, "—", <strong>Ativos operacionais − passivos operacionais</strong>],
      ]}/>
      <p className="mt-3 text-xs text-ncg-muted">Saldos médios = (saldo inicial + saldo final) ÷ 2. Os cálculos usam a precisão integral; dias são arredondados apenas na exibição.</p>
    </SecaoNCG>
    <SecaoNCG titulo="Necessidade total x caixa">
      <div className="mb-4"><StatusNCG coberto={r.giroCoberto}/></div>
      <Tabela cabecalho={["Componente", "Valor", "Lógica"]} linhas={[
        ["NCG operacional", formatarMoeda(r.ncg.total), "Resultado do cálculo técnico"],
        ["Reserva de segurança", formatarMoeda(r.reservaSeguranca), `Despesas fixas/dia × 30 × ${p.reservaMeses.toLocaleString("pt-BR")} mês(es)`],
        [<strong>Capital de giro total necessário</strong>, <strong>{formatarMoeda(r.capitalGiroTotal)}</strong>, "NCG operacional + reserva"],
        ["Caixa disponível", formatarMoeda(p.caixaDisponivel), "Caixa e aplicações disponíveis hoje"],
        [<strong>Sobra/(falta)</strong>, <strong className={r.giroCoberto ? "text-ncg-success" : "text-ncg-negative"}>{formatarMoeda(r.sobraFalta)}</strong>, "Caixa − capital de giro total necessário"],
        ["Cobertura do caixa", percentualTexto(r.coberturaCaixa), "Caixa ÷ capital de giro total necessário"],
      ]}/>
    </SecaoNCG>
    <section className="rounded-lg bg-ncg-muted/10 p-5 text-ncg-muted">
      <h2 className="mb-4 text-lg font-semibold">Comparativo com o método simplificado</h2>
      <Tabela cabecalho={["Método", "Valor", "Fórmula"]} linhas={[
        ["NCG simplificada", formatarMoeda(r.ncgSimplificada), "Ciclo financeiro × (compras/dia + despesas fixas/dia)"],
        ["NCG operacional técnica", formatarMoeda(r.ncg.total), "Soma dos componentes operacionais"],
        ["Diferença", formatarMoeda(r.diferencaSimplificada), "NCG simplificada − NCG operacional técnica"],
      ]}/>
      <p className="mt-4 text-sm leading-relaxed">O método simplificado aplica um único ciclo às compras e despesas fixas. O cálculo técnico considera cada componente com sua própria base e prazo, além dos outros ativos e passivos. Por isso, os resultados podem diferir. A reserva de segurança não integra nenhum dos dois valores de NCG.</p>
    </section>
  </div>;
}