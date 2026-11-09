import { componentesNCG, diasTexto, percentualTexto, resultadoDasPremissas } from "./apresentacao";
import { CONTAS_PRINCIPAIS, CONTAS_OPCIONAIS_ATIVO, CONTAS_OPCIONAIS_PASSIVO, diasDoPeriodo, saldoMedio, formatarMoeda, type PremissasNCG } from "./premissas";
import { periodoNCG } from "./analises";
import type { ResultadoNCG } from "./engine";

export function diagnosticoNCG(r: ResultadoNCG) {
  const ciclo = r.prazos.cicloFinanceiro >= 0 ? `A empresa financia ${diasTexto(r.prazos.cicloFinanceiro)} da operação.` : `Os fornecedores oferecem ${diasTexto(-r.prazos.cicloFinanceiro)} de folga após o recebimento das vendas.`;
  return ciclo + (r.capitalGiroTotal > 0 ? ` Hoje o caixa cobre ${percentualTexto(r.coberturaCaixa)} da necessidade total, ${r.giroCoberto ? "com sobra de" : "faltando"} ${formatarMoeda(Math.abs(r.sobraFalta))} de capital de giro.` : ` Não há necessidade líquida positiva de capital de giro. A posição entre caixa e necessidade é de ${formatarMoeda(r.sobraFalta)}.`);
}
export const NOTA_SIMPLIFICADA = "O método simplificado aplica um único ciclo às compras e despesas fixas. O cálculo técnico considera cada componente com sua própria base e prazo, além dos outros ativos e passivos. Por isso, os resultados podem diferir. A reserva de segurança não integra nenhum dos dois valores de NCG.";
export function dadosRelatorio(empresa: string, cnpj: string, p: PremissasNCG) {
  const r = resultadoDasPremissas(p);
  const custo = p.segmento === "industria" ? "CPV" : "CMV";
  const prazos: [string, number, string][] = [
    ["PMR — Recebimento", r.prazos.pmr, "Saldo médio clientes / vendas × dias do período"],
    ["PME — Estoques", r.prazos.pme, `Saldo médio estoques / ${custo} × dias do período`],
    ["PMP — Pagamento", r.prazos.pmp, "Saldo médio fornecedores / compras × dias do período"],
    ["Ciclo operacional", r.prazos.cicloOperacional, "PME + PMR"],
    ["Ciclo financeiro", r.prazos.cicloFinanceiro, "PME + PMR − PMP"],
  ];
  const bases: [string, number, string][] = [
    ["Vendas/dia", r.bases.vendasDia, "Vendas / dias do período"],
    [`${custo}/dia`, r.bases.cmvDia, `${custo} / dias do período`],
    ["Compras/dia", r.bases.comprasDia, "Compras / dias do período"],
    ["Despesas fixas/dia", r.bases.despFixasDia, "Despesas fixas / dias do período"],
  ];
  const totais: [string, number, string][] = [
    ["NCG operacional", r.ncg.total, "Ativos operacionais − passivos operacionais"],
    ["Reserva de segurança", r.reservaSeguranca, `Despesas fixas/dia × 30 × ${p.reservaMeses} mês(es)`],
    ["Capital de giro total necessário", r.capitalGiroTotal, "NCG operacional + reserva"],
    ["Caixa disponível", p.caixaDisponivel, "Caixa e aplicações disponíveis hoje"],
    ["Sobra/(falta)", r.sobraFalta, "Caixa − capital de giro total necessário"],
  ];
  const premissas: (string | number)[][] = [
    ["Empresa", empresa], ["CNPJ", cnpj || "Não informado"], ["Segmento", p.segmento],
    ["Data inicial", p.dataInicial], ["Data final", p.dataFinal], ["Período", periodoNCG(p)],
    ["Dias informados manualmente", p.diasManual ? "Sim" : "Não"], ["Dias do período", diasDoPeriodo(p)],
    ["Vendas brutas", p.vendasBrutas], [custo, p.cmv], ["Compras", p.compras], ["Despesas fixas", p.despesasFixas],
    ["Prazo despesas fixas (dias)", p.prazoDespesas], ["Reserva (meses)", p.reservaMeses], ["Caixa disponível", p.caixaDisponivel],
    [], ["Conta", "Saldo inicial", "Saldo final", "Saldo médio"],
    ...[...CONTAS_PRINCIPAIS, ...CONTAS_OPCIONAIS_ATIVO, ...CONTAS_OPCIONAIS_PASSIVO].map(c => {
      const s = p.saldos[c.chave] ?? { inicial: 0, final: 0 };
      return [c.rotulo, s.inicial, s.final, saldoMedio(s)];
    }),
  ];
  return { r, prazos, bases, totais, premissas, componentes: componentesNCG(r, p), diagnostico: diagnosticoNCG(r) };
}