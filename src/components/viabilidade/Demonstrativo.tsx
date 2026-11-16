import { formatBRLContabil } from "@/lib/finance";
import type { RelatorioEstudo } from "@/lib/viabilidade/tipos";

export function Demonstrativo({ relatorio }: { relatorio: RelatorioEstudo }) {
  const anos = Array.from({ length: relatorio.anos + 1 }, (_, t) => t);
  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain md:mx-0 md:rounded-lg md:border md:border-via-border" style={{ scrollBehavior: "smooth" }}>
      <table className="via-table">
        <thead>
          <tr>
            <th scope="col">Conta</th>
            {anos.map((t) => <th key={t} scope="col">Ano {t}</th>)}
          </tr>
        </thead>
        <tbody>
          {relatorio.blocos.map((b) => [
            <tr key={`${b.titulo}-s`} className="via-secao"><td>{b.titulo}</td><td colSpan={anos.length} /></tr>,
            ...b.linhas.map((l) => (
              <tr key={`${b.titulo}-${l.rotulo}`} className={`via-${l.estilo ?? "calc"}`}>
                <td>{l.rotulo}</td>
                {l.valores.map((v, t) => (
                  <td key={t} className={v !== null && v < -0.005 ? "via-neg" : ""}>{v === null ? "–" : formatBRLContabil(v)}</td>
                ))}
              </tr>
            )),
          ])}
        </tbody>
      </table>
    </div>
  );
}
