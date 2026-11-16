import { formatAnos, formatBRL, formatPctCurto, indiceRentabilidade, irr, npv, paybackDescontado, paybackSimples } from "@/lib/finance";
import { acumular, anosArray, horizonteValido, somenteAnos, type CampoPremissa, type Parecer, type RelatorioEstudo } from "./tipos";

export interface PremissasNovaLinha {
  tma: number;
  aliquota: number;
  capex: number;
  icg: number;
  vidaUtil: number;
  residual: number;
  preco: number;
  custoVar: number;
  volume: number;
  despFixas: number;
  crescVolume: number;
  reajPreco: number;
  reajCustos: number;
  deducoes: number;
  horizonte: number;
}

export const PADRAO_NOVA_LINHA: PremissasNovaLinha = {
  tma: 0.12, aliquota: 0.34, capex: 250000, icg: 50000, vidaUtil: 5, residual: 40000,
  preco: 150, custoVar: 85, volume: 4000, despFixas: 90000,
  crescVolume: 0, reajPreco: 0, reajCustos: 0, deducoes: 0, horizonte: 5,
};

export const CAMPOS_NOVA_LINHA: CampoPremissa<PremissasNovaLinha>[] = [
  { chave: "tma", rotulo: "TMA / custo de capital a.a.", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "aliquota", rotulo: "Alíquota IRPJ + CSLL", tipo: "pct", grupo: "Taxas e horizonte" },
  { chave: "horizonte", rotulo: "Horizonte de análise (anos)", tipo: "int", grupo: "Taxas e horizonte", min: 3, max: 10 },
  { chave: "capex", rotulo: "Investimento em máquinas e equipamentos (CAPEX)", tipo: "brl", grupo: "Investimento" },
  { chave: "icg", rotulo: "Investimento em capital de giro (ICG)", tipo: "brl", grupo: "Investimento" },
  { chave: "vidaUtil", rotulo: "Vida útil do ativo (anos, depreciação linear)", tipo: "int", grupo: "Investimento", min: 1, max: 50 },
  { chave: "residual", rotulo: "Valor residual do ativo ao final do horizonte", tipo: "brl", grupo: "Investimento" },
  { chave: "preco", rotulo: "Preço unitário de venda no Ano 1", tipo: "brl", grupo: "Operação" },
  { chave: "custoVar", rotulo: "Custo variável unitário no Ano 1", tipo: "brl", grupo: "Operação" },
  { chave: "volume", rotulo: "Volume anual de vendas no Ano 1 (unidades)", tipo: "int", grupo: "Operação", min: 0 },
  { chave: "despFixas", rotulo: "Despesas fixas anuais (comerciais/adm)", tipo: "brl", grupo: "Operação" },
  { chave: "deducoes", rotulo: "Deduções sobre a receita (PIS/COFINS/ICMS/ISS)", tipo: "pct", grupo: "Operação" },
  { chave: "crescVolume", rotulo: "Crescimento anual do volume", tipo: "pct", grupo: "Crescimento e reajustes" },
  { chave: "reajPreco", rotulo: "Reajuste anual de preço", tipo: "pct", grupo: "Crescimento e reajustes" },
  { chave: "reajCustos", rotulo: "Reajuste anual de custos variáveis e despesas fixas", tipo: "pct", grupo: "Crescimento e reajustes" },
];

export function calcularNovaLinha(p: PremissasNovaLinha) {
  const N = horizonteValido(p.horizonte);
  const vida = Math.max(1, Math.round(p.vidaUtil));
  const depAnual = (p.capex - p.residual) / vida;
  const preco = anosArray(N, (t) => (t === 0 ? 0 : p.preco * Math.pow(1 + p.reajPreco, t - 1)));
  const volume = anosArray(N, (t) => (t === 0 ? 0 : p.volume * Math.pow(1 + p.crescVolume, t - 1)));
  const fatorCusto = anosArray(N, (t) => (t === 0 ? 0 : Math.pow(1 + p.reajCustos, t - 1)));
  const receitaBruta = anosArray(N, (t) => preco[t] * volume[t]);
  const deducoes = receitaBruta.map((r) => r * p.deducoes);
  const receitaLiquida = receitaBruta.map((r, t) => r - deducoes[t]);
  // Custo variável = CUSTO UNITÁRIO × VOLUME (corrige a planilha original que multiplicava preço × custo)
  const custosVar = anosArray(N, (t) => p.custoVar * fatorCusto[t] * volume[t]);
  const lucroBruto = receitaLiquida.map((r, t) => r - custosVar[t]);
  const despFixas = anosArray(N, (t) => p.despFixas * fatorCusto[t]);
  const depreciacao = anosArray(N, (t) => (t >= 1 && t <= vida ? depAnual : 0));
  const lajir = lucroBruto.map((l, t) => l - despFixas[t] - depreciacao[t]);
  const ir = lajir.map((l) => (l > 0 ? l * p.aliquota : 0));
  const lucroLiquido = lajir.map((l, t) => l - ir[t]);
  const investimento = anosArray(N, (t) => (t === 0 ? p.capex + p.icg : 0));
  const recuperacao = anosArray(N, (t) => (t === N ? p.residual + p.icg : 0));
  const fcl = anosArray(N, (t) => lucroLiquido[t] + depreciacao[t] - investimento[t] + recuperacao[t]);
  const acumulado = acumular(fcl);
  const vpl = npv(p.tma, fcl);
  const tir = irr(fcl);
  const indice = indiceRentabilidade(p.tma, fcl);
  const pbS = paybackSimples(fcl);
  const pbD = paybackDescontado(p.tma, fcl);
  const margens = receitaLiquida.slice(1).map((r, i) => (r !== 0 ? lucroLiquido[i + 1] / r : null)).filter((x): x is number => x !== null);
  const margemMedia = margens.length ? margens.reduce((a, b) => a + b, 0) / margens.length : null;
  return {
    N, preco, volume, receitaBruta, deducoes, receitaLiquida, custosVar, lucroBruto, despFixas, depreciacao,
    lajir, ir, lucroLiquido, investimento, recuperacao, fcl, acumulado, vpl, tir, indice, pbS, pbD, margemMedia,
  };
}

export type ResultadoNovaLinha = ReturnType<typeof calcularNovaLinha>;

export function parecerNovaLinha(p: PremissasNovaLinha, r: ResultadoNovaLinha): Parecer {
  const tmaTxt = formatPctCurto(p.tma, 2);
  const tirTxt = r.tir === null ? "TIR não calculável" : `TIR de ${formatPctCurto(r.tir, 1)}`;
  const pbTxt = r.pbS === null ? "sem recuperação do investimento no horizonte" : `recuperação do investimento em ${formatAnos(r.pbS)}`;
  const base = `O projeto gera VPL de ${formatBRL(r.vpl)} à TMA de ${tmaTxt}, com ${tirTxt} e ${pbTxt}.`;
  const limite = 0.8 * r.N;
  if (r.vpl > 0 && (r.pbD === null || r.pbD > limite)) {
    return {
      nivel: "amarelo",
      titulo: "VIABILIDADE MARGINAL",
      texto: `${base} Porém o payback descontado (${r.pbD === null ? "não atingido" : formatAnos(r.pbD)}) supera 80% do horizonte de ${r.N} anos, deixando pouca margem para imprevistos.`,
    };
  }
  if (r.vpl > 0 && r.tir !== null && r.tir > p.tma) {
    return {
      nivel: "verde",
      titulo: "PROJETO VIÁVEL",
      texto: `${base} O retorno supera o custo de capital e cada R$ 1,00 investido devolve R$ ${(r.indice ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} em valor presente.`,
    };
  }
  if (r.vpl > 0) {
    return { nivel: "amarelo", titulo: "VIABILIDADE MARGINAL", texto: `${base} A TIR não pôde ser confirmada acima da TMA; revise os fluxos.` };
  }
  return {
    nivel: "vermelho",
    titulo: "PROJETO INVIÁVEL",
    texto: `${base} O valor presente dos fluxos não cobre o investimento à taxa exigida; seria necessário rever preço, volume, custos ou o investimento.`,
  };
}

export interface ItemTornado { nome: string; menos: number; mais: number; amplitude: number }

/** Impacto no VPL de ±10% em cada variável, ordenado do maior para o menor impacto. */
export function tornadoNovaLinha(p: PremissasNovaLinha, variacao = 0.1): { base: number; itens: ItemTornado[] } {
  const base = calcularNovaLinha(p).vpl;
  const vars: Array<[string, keyof PremissasNovaLinha]> = [
    ["Preço", "preco"], ["Volume", "volume"], ["Custo variável", "custoVar"], ["Despesas fixas", "despFixas"], ["CAPEX", "capex"],
  ];
  const itens = vars.map(([nome, k]) => {
    const menos = calcularNovaLinha({ ...p, [k]: (p[k] as number) * (1 - variacao) }).vpl - base;
    const mais = calcularNovaLinha({ ...p, [k]: (p[k] as number) * (1 + variacao) }).vpl - base;
    return { nome, menos, mais, amplitude: Math.abs(mais - menos) };
  });
  itens.sort((a, b) => b.amplitude - a.amplitude);
  return { base, itens };
}

export function relatorioNovaLinha(p: PremissasNovaLinha): RelatorioEstudo {
  const r = calcularNovaLinha(p);
  const neg = (v: number[]) => v.map((x) => -x);
  return {
    anos: r.N,
    blocos: [
      {
        titulo: "DRE projetada",
        linhas: [
          { rotulo: "Receita Bruta", valores: somenteAnos(r.receitaBruta), estilo: "calc" },
          { rotulo: "(−) Deduções sobre a receita", valores: somenteAnos(neg(r.deducoes)), estilo: "calc" },
          { rotulo: "(=) Receita Líquida", valores: somenteAnos(r.receitaLiquida), estilo: "subtotal" },
          { rotulo: "(−) Custos Variáveis", valores: somenteAnos(neg(r.custosVar)), estilo: "calc" },
          { rotulo: "(=) Lucro Bruto", valores: somenteAnos(r.lucroBruto), estilo: "subtotal" },
          { rotulo: "(−) Despesas Fixas", valores: somenteAnos(neg(r.despFixas)), estilo: "calc" },
          { rotulo: "(−) Depreciação", valores: somenteAnos(neg(r.depreciacao)), estilo: "calc" },
          { rotulo: "(=) LAJIR", valores: somenteAnos(r.lajir), estilo: "subtotal" },
          { rotulo: "(−) IRPJ/CSLL", valores: somenteAnos(neg(r.ir)), estilo: "calc" },
          { rotulo: "(=) Lucro Líquido", valores: somenteAnos(r.lucroLiquido), estilo: "total" },
        ],
      },
      {
        titulo: "Fluxo de Caixa Livre (FCL)",
        linhas: [
          { rotulo: "Lucro Líquido", valores: somenteAnos(r.lucroLiquido), estilo: "calc" },
          { rotulo: "(+) Depreciação", valores: somenteAnos(r.depreciacao), estilo: "calc" },
          { rotulo: "(−) Investimento inicial (CAPEX + ICG)", valores: neg(r.investimento), estilo: "calc" },
          { rotulo: "(+) Valor residual + devolução do ICG", valores: r.recuperacao, estilo: "calc" },
          { rotulo: "(=) FCL", valores: r.fcl, estilo: "total" },
          { rotulo: "Fluxo de caixa acumulado", valores: r.acumulado, estilo: "acumulado" },
        ],
      },
    ],
    kpis: [
      { id: "vpl", rotulo: "VPL", valor: r.vpl, formato: "brl", ok: r.vpl > 0, destaque: true, dica: "Valor presente dos fluxos à TMA, somado ao investimento do Ano 0." },
      { id: "tir", rotulo: "TIR", valor: r.tir, formato: "pct", ok: r.tir === null ? false : r.tir > p.tma, textoNulo: "Não calculável", dica: "Taxa que zera o VPL. Comparar com a TMA." },
      { id: "ir", rotulo: "Índice de Rentabilidade", valor: r.indice, formato: "x", ok: r.indice === null ? undefined : r.indice > 1, textoNulo: "–", dica: "VP dos fluxos futuros ÷ investimento. Viável se > 1,00." },
      { id: "pbs", rotulo: "Payback simples", valor: r.pbS, formato: "anos", textoNulo: "Não recupera", dica: "Anos até o caixa acumulado ficar positivo." },
      { id: "pbd", rotulo: "Payback descontado", valor: r.pbD, formato: "anos", ok: r.pbD === null ? false : r.pbD <= 0.8 * r.N, textoNulo: "Não recupera", dica: "Mesmo cálculo sobre os fluxos descontados à TMA." },
      { id: "margem", rotulo: "Margem líquida média", valor: r.margemMedia, formato: "pct", textoNulo: "–", dica: "Média das margens líquidas anuais (Lucro Líquido ÷ Receita Líquida)." },
    ],
    parecer: parecerNovaLinha(p, r),
  };
}
