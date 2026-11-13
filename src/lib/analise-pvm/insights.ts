import type { ItemPVM, ResultadoPVM } from "@/lib/pvm";
import { brlSinal, brlInteiro, pctSinal, periodoNome, qtd } from "./importacao";

export interface LeituraPVM { frases: string[]; quedasPreco: ItemPVM[]; altasPreco: ItemPVM[] }

const NOME = { volume: "VOLUME", preco: "PREÇO", mix: "MIX" } as const;

export function leituraPVM(r: ResultadoPVM): LeituraPVM {
  const t = r.total;
  const frases: string[] = [];
  const varPct = t.r0 !== 0 ? t.dR / t.r0 : 0;
  const de = periodoNome(r.base), para = periodoNome(r.atual);
  frases.push(Math.abs(t.dR) < 0.005
    ? `A receita ficou estável de ${de} para ${para}.`
    : `A receita ${t.dR < 0 ? "caiu" : "subiu"} ${brlInteiro(Math.abs(t.dR))} (${pctSinal(varPct)}) de ${de} para ${para}.`);

  const efeitos = (["volume", "preco", "mix"] as const).map(k => ({ k, v: t[k] })).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const [prin, ...outros] = efeitos;
  const detalhe = prin.k === "volume"
    ? ` (${t.dQ < 0 ? "redução" : "aumento"} de ${qtd(Math.abs(t.dQ))} unidades)`
    : prin.k === "preco"
      ? ` (preços dos itens ${prin.v < 0 ? "menores" : "maiores"} sobre o volume atual)`
      : ` (vendas ${prin.v < 0 ? "migraram para itens mais baratos" : "migraram para itens mais caros"})`;
  frases.push(`O principal motivo foi o ${NOME[prin.k]}: ${brlSinal(prin.v)}${detalhe}.`);
  const verbo = (v: number) => (v >= 0 ? "contribuiu com" : "retirou");
  frases.push(`O efeito ${NOME[outros[0].k]} foi de ${brlSinal(outros[0].v)} e o ${NOME[outros[1].k]} ${verbo(outros[1].v)} ${brlSinal(outros[1].v)}.`);

  const ord = [...r.itens].sort((a, b) => a.total - b.total);
  const neg = ord[0], pos = ord[ord.length - 1];
  const partes: string[] = [];
  if (neg && neg.total < 0) partes.push(`Maior impacto negativo: ${neg.item} (${brlSinal(neg.total)}).`);
  if (pos && pos.total > 0) partes.push(`Maior impacto positivo: ${pos.item} (${brlSinal(pos.total)}).`);
  if (!partes.length) partes.push("Nenhum item teve impacto relevante.");
  frases.push(partes.join(" "));

  const comPreco = r.itens.filter(i => i.status === "normal" && i.p0 !== 0);
  const varPreco = (i: ItemPVM) => i.dP / i.p0;
  const quedasPreco = comPreco.filter(i => i.dP < 0).sort((a, b) => varPreco(a) - varPreco(b)).slice(0, 3);
  const altasPreco = comPreco.filter(i => i.dP > 0).sort((a, b) => varPreco(b) - varPreco(a)).slice(0, 3);
  return { frases, quedasPreco, altasPreco };
}

export const GLOSSARIO = {
  volume: { titulo: "Efeito Volume", texto: "Quanto a receita mudou só por vender mais ou menos unidades, ao preço médio do período anterior.", formula: "(Qtd atual − Qtd anterior) × Preço médio total anterior" },
  preco: { titulo: "Efeito Preço", texto: "Quanto a receita mudou por causa da mudança de preço de cada item, sobre o volume atual.", formula: "(Preço atual − Preço anterior) × Qtd atual" },
  mix: { titulo: "Efeito Mix", texto: "Quanto a receita mudou porque a composição das vendas mudou entre itens mais caros e mais baratos.", formula: "(Mix atual − Mix anterior) × (Preço anterior do item − Preço médio total anterior) × Qtd total atual" },
} as const;
