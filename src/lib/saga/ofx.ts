export type CategoriaDFC =
  | "op_recebimentos"
  | "op_fornecedores"
  | "op_pessoal"
  | "op_impostos"
  | "op_outras"
  | "inv_capex"
  | "inv_aplicacoes"
  | "fin_emprestimos"
  | "fin_juros"
  | "fin_dividendos"
  | "fin_aportes"
  | "nao_classificado";

export const CATEGORIAS: { id: CategoriaDFC; label: string; grupo: "Operacional" | "Investimento" | "Financiamento" | "Sem classificação" }[] = [
  { id: "op_recebimentos", label: "Recebimentos de clientes", grupo: "Operacional" },
  { id: "op_fornecedores", label: "Pagamentos a fornecedores", grupo: "Operacional" },
  { id: "op_pessoal", label: "Pessoal e encargos", grupo: "Operacional" },
  { id: "op_impostos", label: "Impostos e taxas", grupo: "Operacional" },
  { id: "op_outras", label: "Outras despesas operacionais", grupo: "Operacional" },
  { id: "inv_capex", label: "Imobilizado / CAPEX", grupo: "Investimento" },
  { id: "inv_aplicacoes", label: "Aplicações financeiras", grupo: "Investimento" },
  { id: "fin_emprestimos", label: "Empréstimos (captação/amortização)", grupo: "Financiamento" },
  { id: "fin_juros", label: "Juros e tarifas bancárias", grupo: "Financiamento" },
  { id: "fin_dividendos", label: "Dividendos / retiradas", grupo: "Financiamento" },
  { id: "fin_aportes", label: "Aportes de sócios", grupo: "Financiamento" },
  { id: "nao_classificado", label: "Não classificado", grupo: "Sem classificação" },
];

export const GRUPO_POR_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.id, c.grupo]));
export const LABEL_POR_CATEGORIA = new Map(CATEGORIAS.map((c) => [c.id, c.label]));

export interface TransacaoOFX {
  id: string;
  data: string; // ISO yyyy-mm-dd
  descricao: string;
  tipo: string;
  valor: number;
  categoria: CategoriaDFC;
}

export class OfxError extends Error {}

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const REGRAS: { cat: CategoriaDFC; termos: string[]; sinal?: 1 | -1 }[] = [
  { cat: "fin_aportes", termos: ["aporte", "integralizacao", "capital social"] },
  { cat: "fin_dividendos", termos: ["dividendo", "jcp", "juros sobre capital", "pro labore socio", "retirada socio", "distribuicao lucro"] },
  { cat: "fin_emprestimos", termos: ["emprestimo", "financiamento", "credito rotativo", "capital de giro", "bndes", "parcela financ", "amortizacao"] },
  { cat: "fin_juros", termos: ["juros", "iof", "tarifa", "cesta de servicos", "encargos", "multa banco", "anuidade"] },
  { cat: "inv_capex", termos: ["imobilizado", "maquina", "equipamento", "veiculo", "obra", "reforma", "software", "movel", "capex"] },
  { cat: "inv_aplicacoes", termos: ["aplicacao", "resgate", "cdb", "fundo", "poupanca", "investimento", "tesouro"] },
  { cat: "op_impostos", termos: ["darf", "das ", "simples nacional", "icms", "iss", "pis", "cofins", "irpj", "csll", "fgts", "inss", "gps", "tributo", "imposto", "gare"] },
  { cat: "op_pessoal", termos: ["folha", "salario", "salarios", "ferias", "rescisao", "13 salario", "vale transporte", "vale refeicao", "vr ", "va ", "pagamento funcionario", "adiantamento salarial"] },
  { cat: "op_fornecedores", termos: ["fornecedor", "boleto", "compra", "mercadoria", "materia prima", "nf ", "duplicata", "pagto fornec"] },
  { cat: "op_outras", termos: ["aluguel", "energia", "luz", "agua", "telefone", "internet", "combustivel", "frete", "seguro", "contabilidade", "honorario", "material", "manutencao", "publicidade", "marketing", "condominio", "viagem"] },
  { cat: "op_recebimentos", termos: ["recebimento", "cliente", "venda", "credito cartao", "pix recebido", "cobranca", "liquidacao titulo", "maquininha", "adquirente", "cielo", "rede", "stone", "pagseguro", "mercado pago"] },
];

export function classificar(descricao: string, valor: number): CategoriaDFC {
  const d = norm(` ${descricao} `);
  for (const r of REGRAS) {
    if (r.termos.some((t) => d.includes(norm(t)))) return r.cat;
  }
  // fallback pelo sinal: entradas viram recebimentos, saídas viram outras operacionais
  return valor >= 0 ? "op_recebimentos" : "op_outras";
}

function tag(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : "";
}

function parseData(raw: string): string {
  const m = raw.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!m) return "";
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export function lerOFX(texto: string): TransacaoOFX[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  if (!blocos.length) {
    throw new OfxError("Nenhuma transação (<STMTTRN>) encontrada no arquivo OFX.");
  }
  const txs: TransacaoOFX[] = [];
  blocos.forEach((b, i) => {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const valor = Number(tag(bloco, "TRNAMT").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
    if (!isFinite(valor)) return;
    const descricao = [tag(bloco, "MEMO"), tag(bloco, "NAME")].filter(Boolean).join(" — ") || "Sem descrição";
    txs.push({
      id: tag(bloco, "FITID") || `tx-${i}`,
      data: parseData(tag(bloco, "DTPOSTED")),
      descricao,
      tipo: tag(bloco, "TRNTYPE") || (valor >= 0 ? "CREDIT" : "DEBIT"),
      valor,
      categoria: classificar(descricao, valor),
    });
  });
  if (!txs.length) throw new OfxError("O arquivo não contém transações válidas.");
  return txs.sort((a, b) => a.data.localeCompare(b.data));
}

export interface DFCResumo {
  porCategoria: { categoria: CategoriaDFC; label: string; grupo: string; total: number; qtd: number }[];
  operacional: number;
  investimento: number;
  financiamento: number;
  variacaoCaixa: number;
}

export function montarDFC(txs: TransacaoOFX[]): DFCResumo {
  const mapa = new Map<CategoriaDFC, { total: number; qtd: number }>();
  for (const t of txs) {
    const cur = mapa.get(t.categoria) ?? { total: 0, qtd: 0 };
    mapa.set(t.categoria, { total: cur.total + t.valor, qtd: cur.qtd + 1 });
  }
  const porCategoria = CATEGORIAS.filter((c) => mapa.has(c.id)).map((c) => ({
    categoria: c.id,
    label: c.label,
    grupo: c.grupo,
    total: mapa.get(c.id)!.total,
    qtd: mapa.get(c.id)!.qtd,
  }));
  const soma = (g: string) =>
    porCategoria.filter((c) => c.grupo === g).reduce((a, b) => a + b.total, 0);
  const operacional = soma("Operacional") + soma("Sem classificação");
  const investimento = soma("Investimento");
  const financiamento = soma("Financiamento");
  return {
    porCategoria,
    operacional,
    investimento,
    financiamento,
    variacaoCaixa: operacional + investimento + financiamento,
  };
}

export interface AjustesReversos {
  depreciacao: number; // despesa não-caixa somada no indireto
  outrosNaoCaixa: number; // provisões, equivalência etc.
  varContasReceber: number; // aumento (+) do saldo
  varEstoques: number;
  varFornecedores: number;
  varOutrosPassivos: number;
  jurosFinanceiros: number; // resultado financeiro reclassificado
}

export const AJUSTES_ZERO: AjustesReversos = {
  depreciacao: 0,
  outrosNaoCaixa: 0,
  varContasReceber: 0,
  varEstoques: 0,
  varFornecedores: 0,
  varOutrosPassivos: 0,
  jurosFinanceiros: 0,
};

/**
 * Caminho inverso do fluxo de caixa indireto.
 * Indireto:  FCO = LL + Depreciação + Outros não-caixa − ΔCR − ΔEstoques + ΔFornecedores + ΔOutros passivos
 * Reverso:   LL  = FCO − Depreciação − Outros não-caixa + ΔCR + ΔEstoques − ΔFornecedores − ΔOutros passivos + Juros
 */
export function reverterParaLucro(fco: number, a: AjustesReversos) {
  const base = [
    {
      label: "Caixa gerado nas operações (FCO do OFX)",
      valor: fco,
      bold: true,
      explicacao: "Ponto de partida: caixa operacional apurado no extrato bancário.",
    },
    {
      label: "(−) Depreciação e amortização",
      valor: -a.depreciacao,
      explicacao:
        "No indireto a depreciação é somada ao lucro por não consumir caixa; no caminho inverso ela é retirada.",
    },
    {
      label: "(−) Outros itens não-caixa",
      valor: -a.outrosNaoCaixa,
      explicacao: "Provisões, equivalência e impairment somados no indireto são revertidos aqui.",
    },
    {
      label: "(+/−) Variação de contas a receber",
      valor: a.varContasReceber,
      explicacao:
        "Queda do saldo de clientes gerou caixa sem gerar lucro: como a variação é negativa, ela reduz o lucro reconstruído. Aumento do saldo (variação positiva) aumenta o lucro.",
    },
    {
      label: "(+/−) Variação de estoques",
      valor: a.varEstoques,
      explicacao:
        "Aumento de estoques consome caixa sem afetar o lucro; no caminho inverso ele volta somando ao resultado.",
    },
    {
      label: "(+/−) Variação de fornecedores",
      valor: -a.varFornecedores,
      explicacao:
        "Aumento de fornecedores segurou caixa sem melhorar o lucro; por isso é subtraído no caminho inverso.",
    },
    {
      label: "(+/−) Variação de outros passivos operacionais",
      valor: -a.varOutrosPassivos,
      explicacao:
        "Salários e impostos a pagar seguem a mesma lógica dos fornecedores: aumento do saldo reduz o lucro reconstruído.",
    },
    {
      label: "(+/−) Resultado financeiro reclassificado",
      valor: a.jurosFinanceiros,
      explicacao:
        "Juros e encargos tratados como financiamento na DFC retornam ao resultado por competência.",
    },
  ];
  let acum = 0;
  const linhas = base.map((l) => {
    acum += l.valor;
    return { ...l, acumulado: acum };
  });
  return { linhas, lucroLiquido: acum };
}