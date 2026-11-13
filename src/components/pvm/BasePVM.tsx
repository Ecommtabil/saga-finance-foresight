import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VolCard } from "@/components/volatilidade/ui";
import { brl, mesNome, qtd } from "@/lib/analise-pvm/importacao";
import type { RegistroPVM } from "@/lib/pvm";
import { FiltroMulti } from "./FiltroMulti";

const POR_PAGINA = 50;

export function BasePVM({ registros }: { registros: RegistroPVM[] }) {
  const [busca, setBusca] = useState("");
  const [f, setF] = useState({ unidade: [] as string[], categoria: [] as string[], metrica: [] as string[], mes: [] as string[] });
  const [pagina, setPagina] = useState(0);
  const opcoes = useMemo(() => ({
    unidade: [...new Set(registros.map(r => r.unidade))].sort(),
    categoria: [...new Set(registros.map(r => r.categoria))].sort(),
    metrica: ["Quantidade", "Receita"],
    mes: [...new Set(registros.map(r => r.mes))].sort(),
  }), [registros]);
  const filtrados = useMemo(() => {
    const b = busca.trim().toLowerCase();
    return registros.filter(r =>
      (!f.unidade.length || f.unidade.includes(r.unidade)) && (!f.categoria.length || f.categoria.includes(r.categoria)) &&
      (!f.metrica.length || f.metrica.includes(r.metrica)) && (!f.mes.length || f.mes.includes(r.mes)) &&
      (!b || `${r.unidade} ${r.categoria} ${r.produto}`.toLowerCase().includes(b)));
  }, [registros, busca, f]);
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas - 1);
  const mudar = (k: keyof typeof f, v: string[]) => { setF(x => ({ ...x, [k]: v })); setPagina(0); };
  return (
    <VolCard titulo={`Base de dados (${qtd(filtrados.length)} de ${qtd(registros.length)} linhas)`}>
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vol-muted" /><Input className="h-9 border-vol-border bg-vol-surface pl-9" placeholder="Buscar unidade, categoria ou produto" value={busca} onChange={e => { setBusca(e.target.value); setPagina(0); }} aria-label="Buscar na base" /></div>
        <FiltroMulti rotulo="Unidade" opcoes={opcoes.unidade} selecionados={f.unidade} onChange={v => mudar("unidade", v)} />
        <FiltroMulti rotulo="Categoria" opcoes={opcoes.categoria} selecionados={f.categoria} onChange={v => mudar("categoria", v)} />
        <FiltroMulti rotulo="Métrica" opcoes={opcoes.metrica} selecionados={f.metrica} onChange={v => mudar("metrica", v)} />
        <FiltroMulti rotulo="Mês" opcoes={opcoes.mes} selecionados={f.mes} onChange={v => mudar("mes", v)} formatar={mesNome} />
      </div>
      <div className="overflow-x-auto">
        <table className="vol-table min-w-[720px]">
          <thead><tr><th>Unidade</th><th>Categoria</th><th>Produto</th><th>Métrica</th><th>Mês</th><th className="num">Valor</th></tr></thead>
          <tbody className="text-vol-text">
            {filtrados.slice(pag * POR_PAGINA, (pag + 1) * POR_PAGINA).map((r, i) => (
              <tr key={i}><td>{r.unidade}</td><td>{r.categoria}</td><td>{r.produto}</td><td>{r.metrica}</td><td>{mesNome(r.mes)}</td><td className="num">{r.metrica === "Receita" ? brl(r.valor) : qtd(r.valor)}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2 text-sm text-vol-muted">
        <span>Página {pag + 1} de {paginas}</span>
        <Button size="sm" variant="outline" disabled={pag === 0} onClick={() => setPagina(pag - 1)}>Anterior</Button>
        <Button size="sm" variant="outline" disabled={pag >= paginas - 1} onClick={() => setPagina(pag + 1)}>Próxima</Button>
      </div>
    </VolCard>
  );
}
