import { Fragment } from "react";
import { MES_CURTO, type ResultadoMes, type TotaisAnexo } from "@/lib/simples/calculo";
import { COLUNAS_ANEXO, NOME_COLUNA, TRIBUTOS_ANEXO, type AnexoId } from "@/lib/simples/tabelas";
import { num2, pct2, pct4 } from "@/lib/simples/formato";
import { FaixaBadge, IconeAlertas, Th } from "./ui";

const DICA_TRIBUTO = "Percentual de partilha da faixa (já com teto do ISS e sublimite) e valor em R$ do tributo, descontadas as parcelas excluídas por ST, monofásico ou retenção.";

export function ResultadoAnexo({ anexo, meses, totais }: { anexo: AnexoId; meses: ResultadoMes[]; totais: TotaisAnexo }) {
  const trib = TRIBUTOS_ANEXO[anexo];
  const cols = COLUNAS_ANEXO[anexo];
  const traco = <span className="text-via-muted">—</span>;
  return (
    <div className="sn-scroll">
      <table className="sn-table">
        <thead>
          <tr className="sn-grupo">
            <th colSpan={7} />
            {trib.map((t) => <th key={t} colSpan={2}>{t}</th>)}
            <th colSpan={cols.length}>Imposto por tipo de receita</th>
            <th />
          </tr>
          <tr>
            <Th>Mês</Th>
            <Th dica="Soma das receitas do anexo no mês.">Receita total</Th>
            <Th dica="Receita bruta dos 12 meses anteriores (empresa toda). Define a faixa e a partilha.">RBT12</Th>
            <Th dica="Faixa da tabela do anexo pelo RBT12. Verde 1–2, amarelo 3–4, laranja 5, vermelho 6 ou acima do teto.">Faixa</Th>
            <Th dica="Alíquota nominal da faixa (tabela do anexo).">Alíq. nominal</Th>
            <Th dica="Parcela a deduzir da faixa (tabela do anexo).">Parcela a deduzir</Th>
            <Th dica="(RBT12 × alíquota nominal − parcela a deduzir) ÷ RBT12.">Alíq. efetiva</Th>
            {trib.map((t) => (
              <Fragment key={t}>
                <Th dica={DICA_TRIBUTO}>%</Th>
                <Th dica={DICA_TRIBUTO}>R$</Th>
              </Fragment>
            ))}
            {cols.map((c) => <Th key={c} dica={`Imposto da receita “${NOME_COLUNA[c]}”.`}>{NOME_COLUNA[c]}</Th>)}
            <Th dica="Soma dos impostos por tipo de receita = valor do DAS do anexo no mês.">Total do DAS</Th>
          </tr>
        </thead>
        <tbody>
          {meses.map((m) => (
            <tr key={m.mes}>
              <td>{MES_CURTO[m.mes]}<IconeAlertas alertas={m.alertas} /></td>
              <td>{num2(m.receitaTotal)}</td>
              <td>{num2(m.rbt12)}</td>
              <td className="!text-center"><FaixaBadge faixa={m.faixa} /></td>
              <td>{m.calculado ? pct2(m.aliqNominal) : traco}</td>
              <td>{m.calculado ? num2(m.deducao) : traco}</td>
              <td className="font-semibold text-via-ink">{m.calculado ? pct4(m.ae) : m.faixa === 0 && m.receitaTotal > 0 ? <span className="text-[var(--sn-vermelho)]">Informe o RBT12</span> : traco}</td>
              {trib.map((t) => (
                <Fragment key={t}>
                  <td className="text-via-muted">{m.calculado ? pct2(m.partilha[t] ?? 0) : traco}</td>
                  <td>{num2(m.tributos[t])}</td>
                </Fragment>
              ))}
              {cols.map((c) => <td key={c}>{num2(m.impostoPorColuna[c])}</td>)}
              <td className="sn-das">{m.faixa === 7 ? <span className="text-[var(--sn-vermelho)]">Excedeu o limite</span> : num2(m.totalDas)}</td>
            </tr>
          ))}
          <tr className="sn-total">
            <td>TOTAIS</td>
            <td>{num2(totais.receitaTotal)}</td>
            <td colSpan={5} />
            {trib.map((t) => (
              <Fragment key={t}>
                <td />
                <td>{num2(totais.tributos[t])}</td>
              </Fragment>
            ))}
            {cols.map((c) => <td key={c}>{num2(totais.impostoPorColuna[c])}</td>)}
            <td className="sn-das">{num2(totais.totalDas)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
