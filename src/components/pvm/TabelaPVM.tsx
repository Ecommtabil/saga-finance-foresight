import { useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { ItemPVM, ResultadoPVM } from "@/lib/pvm";
import { brl, pct2, qtd } from "@/lib/analise-pvm/importacao";

type Chave = keyof Pick<ItemPVM, "item" | "q0" | "q1" | "r0" | "r1" | "mix0" | "mix1" | "p0" | "p1" | "dQ" | "dR" | "dP" | "dMix" | "volume" | "preco" | "mix" | "total">;
const COLS: Array<{ k: Chave; f: (v: number) => string; efeito?: boolean }> = [
  { k: "q0", f: qtd }, { k: "q1", f: qtd }, { k: "r0", f: brl }, { k: "r1", f: brl },
  { k: "mix0", f: pct2 }, { k: "mix1", f: pct2 }, { k: "p0", f: brl }, { k: "p1", f: brl },
  { k: "dQ", f: qtd }, { k: "dR", f: brl }, { k: "dP", f: brl }, { k: "dMix", f: v => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.` },
  { k: "volume", f: brl, efeito: true }, { k: "preco", f: brl, efeito: true }, { k: "mix", f: brl, efeito: true }, { k: "total", f: brl, efeito: true },
];
const GRUPOS: Array<[string, number]> = [["Quantidade", 2], ["Receita", 2], ["Mix %", 2], ["Preço médio", 2], ["Diferenças", 4], ["Efeitos", 4]];
const SUBS = ["Base", "Atual", "Base", "Atual", "Base", "Atual", "Base", "Atual", "Volume", "Receita", "Preço", "Mix p.p.", "Volume", "Preço", "Mix", "Total"];
const corEfeito = (v: number) => (v > 0.004 ? "text-vol-good" : v < -0.004 ? "text-vol-bad" : "");

export function TabelaPVM({ r, rotulo, onItem }: { r: ResultadoPVM; rotulo: string; onItem: (item: string) => void }) {
  const [ord, setOrd] = useState<{ k: Chave; asc: boolean }>({ k: "total", asc: true });
  const itens = [...r.itens].sort((a, b) => {
    const x = a[ord.k], y = b[ord.k];
    const c = typeof x === "string" ? x.localeCompare(String(y), "pt-BR") : (x as number) - (y as number);
    return ord.asc ? c : -c;
  });
  const ordenar = (k: Chave) => setOrd(o => (o.k === k ? { k, asc: !o.asc } : { k, asc: k === "item" }));
  const Seta = ({ k }: { k: Chave }) => (ord.k === k ? (ord.asc ? <ArrowUp className="inline h-3 w-3" /> : <ArrowDown className="inline h-3 w-3" />) : null);
  const t = r.total;
  const totais: Record<Chave, number | string> = { item: "TOTAL", q0: t.q0, q1: t.q1, r0: t.r0, r1: t.r1, mix0: 1, mix1: 1, p0: t.p0, p1: t.p1, dQ: t.dQ, dR: t.dR, dP: t.p1 - t.p0, dMix: 0, volume: t.volume, preco: t.preco, mix: t.mix, total: t.total };
  return (
    <div className="max-h-[560px] overflow-auto rounded-xl border border-vol-border">
      <table className="vol-table min-w-[1500px]">
        <thead className="sticky top-0 z-10">
          <tr>
            <th rowSpan={2} className="sticky left-0 z-20 cursor-pointer bg-vol-paper" onClick={() => ordenar("item")}>{rotulo} <Seta k="item" /></th>
            {GRUPOS.map(([g, n]) => <th key={g} colSpan={n} className="border-l border-vol-border text-center font-semibold text-vol-text">{g}</th>)}
          </tr>
          <tr>
            {COLS.map((c, i) => (
              <th key={c.k} className={`num cursor-pointer select-none ${[0, 2, 4, 6, 8, 12].includes(i) ? "border-l border-vol-border" : ""}`} onClick={() => ordenar(c.k)}>{SUBS[i]} <Seta k={c.k} /></th>
            ))}
          </tr>
        </thead>
        <tbody className="text-vol-text">
          {itens.map(it => (
            <tr key={it.item} className="cursor-pointer hover:bg-vol-gold/5" onClick={() => onItem(it.item)} title="Clique para filtrar o dashboard por este item">
              <td className="sticky left-0 bg-vol-surface font-medium">
                {it.item}
                {it.status === "novo" && <span className="ml-2 rounded bg-vol-good/15 px-1.5 py-0.5 text-[10px] font-semibold text-vol-good">Novo</span>}
                {it.status === "descontinuado" && <span className="ml-2 rounded bg-vol-bad/15 px-1.5 py-0.5 text-[10px] font-semibold text-vol-bad">Descontinuado</span>}
              </td>
              {COLS.map((c, i) => <td key={c.k} className={`num ${c.efeito ? corEfeito(it[c.k] as number) : ""} ${[0, 2, 4, 6, 8, 12].includes(i) ? "border-l border-vol-border" : ""} ${c.k === "total" ? "font-semibold" : ""}`}>{c.f(it[c.k] as number)}</td>)}
            </tr>
          ))}
        </tbody>
        <tfoot className="sticky bottom-0">
          <tr className="bg-vol-gold/15 font-bold text-vol-text">
            <td className="sticky left-0 bg-vol-paper">TOTAL</td>
            {COLS.map((c, i) => <td key={c.k} className={`num bg-vol-paper ${c.efeito ? corEfeito(totais[c.k] as number) : ""} ${[0, 2, 4, 6, 8, 12].includes(i) ? "border-l border-vol-border" : ""}`}>{c.f(totais[c.k] as number)}</td>)}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
