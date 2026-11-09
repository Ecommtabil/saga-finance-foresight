import { calcularNCG, type EntradasNCG, type ResultadoNCG } from "./engine";
import { CONTAS_OPCIONAIS_ATIVO, CONTAS_OPCIONAIS_PASSIVO, diasDoPeriodo, saldoMedio, type PremissasNCG } from "./premissas";

export function entradasDasPremissas(p: PremissasNCG): EntradasNCG {
  const medio = (chave: string) => saldoMedio(p.saldos[chave] ?? { inicial: 0, final: 0 });
  return {
    dias: diasDoPeriodo(p), vendas: p.vendasBrutas, cmv: p.cmv, compras: p.compras,
    despesasFixas: p.despesasFixas, clientesMedio: medio("clientes"),
    estoquesMedio: medio("estoques"), fornecedoresMedio: medio("fornecedores"),
    outrosAtivos: CONTAS_OPCIONAIS_ATIVO.map(c => medio(c.chave)),
    outrosPassivos: CONTAS_OPCIONAIS_PASSIVO.map(c => medio(c.chave)),
    prazoDespFixas: p.prazoDespesas, mesesReserva: p.reservaMeses, caixa: p.caixaDisponivel,
  };
}

export const resultadoDasPremissas = (p: PremissasNCG) => calcularNCG(entradasDasPremissas(p));
export const diasTexto = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} dias`;
export const percentualTexto = (v: number) => v.toLocaleString("pt-BR", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
export function faixaCobertura(fracao: number): "critica" | "atencao" | "coberta" {
  return fracao < 0.7 ? "critica" : fracao < 1 ? "atencao" : "coberta";
}

export function componentesNCG(r: ResultadoNCG, p: PremissasNCG) {
  const custo = p.segmento === "industria" ? "CPV" : "CMV";
  return [
    { nome: "Clientes", valor: r.ncg.clientes, dias: r.prazos.pmr, logica: "Vendas/dia × PMR" },
    { nome: "Estoques", valor: r.ncg.estoques, dias: r.prazos.pme, logica: `${custo}/dia × PME` },
    { nome: "Outros ativos", valor: r.ncg.outrosAtivos, dias: null, logica: "Soma dos saldos médios dos outros ativos operacionais" },
    { nome: "Fornecedores", valor: r.ncg.fornecedores, dias: r.prazos.pmp, logica: "− Compras/dia × PMP" },
    { nome: "Desp. fixas a pagar", valor: r.ncg.despesasFixasAPagar, dias: p.prazoDespesas, logica: "− Despesas fixas/dia × prazo de pagamento" },
    { nome: "Outros passivos", valor: r.ncg.outrosPassivos, dias: null, logica: "− Soma dos saldos médios dos outros passivos operacionais" },
  ];
}

export function cascataNCG(r: ResultadoNCG, p: PremissasNCG) {
  let acumulado = 0;
  const parcelas = componentesNCG(r, p).map(c => {
    const inicio = acumulado;
    acumulado += c.valor;
    return { nome: c.nome, valor: c.valor, intervalo: [Math.min(inicio, acumulado), Math.max(inicio, acumulado)], tipo: c.valor < 0 ? "negativo" : "positivo" };
  });
  return [
    ...parcelas,
    { nome: "NCG operacional", valor: r.ncg.total, intervalo: [Math.min(0, r.ncg.total), Math.max(0, r.ncg.total)], tipo: "total" },
    { nome: "Reserva", valor: r.reservaSeguranca, intervalo: [Math.min(r.ncg.total, r.capitalGiroTotal), Math.max(r.ncg.total, r.capitalGiroTotal)], tipo: "reserva" },
    { nome: "Total necessário", valor: r.capitalGiroTotal, intervalo: [Math.min(0, r.capitalGiroTotal), Math.max(0, r.capitalGiroTotal)], tipo: "total" },
    { nome: "Caixa", valor: p.caixaDisponivel, intervalo: [0, p.caixaDisponivel], tipo: "caixa" },
    { nome: "Sobra/falta", valor: r.sobraFalta, intervalo: [Math.min(0, r.sobraFalta), Math.max(0, r.sobraFalta)], tipo: r.sobraFalta < 0 ? "negativo" : "coberto" },
  ];
}