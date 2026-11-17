import { describe, expect, it } from "vitest";
import { aplicarPrevia, classificarAtividade, consolidarPgdas, detectarCabecalho, interpretarPgdas, lerMes, lerValor, linhasDeColagem, linhasDePlanilha, montarPrevia, sugerirMapeamento } from "./importacao";
import { empresaNova } from "./store";

const extrato = (pa: string, extra = "") => `
Extrato do Simples Nacional
CNPJ Matriz: 12.345.678/0001-90 Nome empresarial: TESTE LTDA
Período de Apuração (PA): ${pa}
2) Informações da Declaração
2.1) Discriminativo de Receitas
Valores em reais (R$) Mercado Interno Mercado Externo Total
Receita Bruta do PA (RPA) - Competência 68.619,68 0,00 68.619,68
Receita bruta acumulada nos doze meses anteriores ao PA (RBT12) 400.000,00 0,00 400.000,00
Receita bruta acumulada no ano-calendário corrente (RBA) 0,00 0,00 0,00
Receita bruta acumulada no ano-calendário anterior (RBAA) 400.000,00 0,00 400.000,00
2.2) Receitas Brutas Anteriores (R$)
2.2.1) Mercado Interno
01/2024 30.000,00 02/2024 32.000,00 03/2024 33.000,00 12/2024 40.000,00 ${extra}
2.2.2) Mercado Externo
01/2024 0,00
2.3) Folha de Salários Anteriores (R$)
01/2024 8.000,00 02/2024 8.500,00
2.4) Fator r
2.9) Informações da Declaração por Estabelecimento
CNPJ Estabelecimento: 12.345.678/0001-90 Valor do estabelecimento: 68.619,68
Revenda de mercadorias, exceto para o exterior - Sem substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o substituído tributário do ICMS deve utilizar essa opção)
Receita Bruta Informada: R$ 15.199,02
Alíquota apurada (%) 6,0350
Revenda de mercadorias, exceto para o exterior - Com substituição tributária/tributação monofásica/antecipação com encerramento de tributação (o substituído tributário do ICMS deve utilizar essa opção) - Substituição tributária de: ICMS
Receita Bruta Informada: R$ 28.248,73
Revenda de mercadorias, exceto para o exterior - Com substituição tributária de: ICMS e tributação monofásica de: COFINS, PIS
Receita Bruta Informada: R$ 25.171,93
`;

describe("leitura de mês e valor", () => {
  it.each([["01/2025", "2025-01"], ["1/25", "2025-01"], ["jan/25", "2025-01"], ["janeiro 2025", "2025-01"], ["Março/2025", "2025-03"], ["2025-02", "2025-02"], ["15/04/2025", "2025-04"], [45658, "2025-01"]])("%s → %s", (e, s) => {
    expect(lerMes(e)).toBe(s);
  });
  it.each([["1.234,56", 1234.56], ["1,234.56", 1234.56], ["1234.56", 1234.56], ["R$ 15.199,02", 15199.02], ["1.000", 1000], ["(10,00)", -10], ["abc", null], ["", null]])("%s → %s", (e, s) => {
    expect(lerValor(e)).toBe(s);
  });
});

describe("PGDAS-D", () => {
  it("extrai PA, CNPJ, RBT12, receitas anteriores, folha e atividades", () => {
    const x = interpretarPgdas(extrato("01/2025"), "jan.pdf");
    expect(x.pa).toBe("2025-01");
    expect(x.cnpj).toBe("12.345.678/0001-90");
    expect(x.rbt12).toBe(400000);
    expect(x.rpa).toBe(68619.68);
    expect(x.rbaa).toBe(400000);
    expect(x.anteriores["2024-02"]).toBe(32000);
    expect(x.anteriores["2024-12"]).toBe(40000);
    expect(x.folha["2024-02"]).toBe(8500);
    expect(x.atividades.map((a) => [a.anexo, a.coluna, a.valor])).toEqual([
      ["I", "integral", 15199.02], ["I", "st", 28248.73], ["I", "stMono", 25171.93],
    ]);
  });
  it("classifica atividades de indústria e serviços", () => {
    expect(classificarAtividade("Venda de mercadorias industrializadas pelo contribuinte - com tributação monofásica de: COFINS, PIS")).toEqual({ anexo: "II", coluna: "mono" });
    expect(classificarAtividade("Prestação de serviços tributados pelo Anexo V - com retenção/substituição tributária de ISS")).toEqual({ anexo: "V", coluna: "comRet" });
    expect(classificarAtividade("Prestação de serviços do Anexo IV - sem retenção/substituição tributária de ISS")).toEqual({ anexo: "IV", coluna: "semRet" });
  });
  it("consolida vários PDFs: PA mais recente prevalece e mês do ano usa a receita segregada", () => {
    const jan = interpretarPgdas(extrato("01/2025"), "jan.pdf");
    const fev = interpretarPgdas(extrato("02/2025", "01/2025 70.000,00").replace("02/2024 32.000,00", "02/2024 32.500,00"), "fev.pdf");
    const c = consolidarPgdas([fev, jan], 2025, "12.345.678/0001-90");
    const fev24 = c.linhas.find((l) => l.mes === "2024-02");
    expect(fev24?.valor).toBe(32500);
    // jan/2025 tem receita segregada (do PDF de janeiro): o total de 70.000 da seção 2.2.1 é descartado
    expect(c.linhas.filter((l) => l.mes === "2025-01").every((l) => !l.total)).toBe(true);
    expect(c.conferencias["2025-01"].valor).toBe(400000);
    expect(c.avisos).toEqual([]);
  });
  it("avisa quando o CNPJ é diferente", () => {
    const c = consolidarPgdas([interpretarPgdas(extrato("01/2025"), "x.pdf")], 2025, "99.999.999/0001-99");
    expect(c.avisos.some((a) => a.includes("CNPJ"))).toBe(true);
  });
});

describe("planilha e colagem", () => {
  it("detecta cabeçalho e sugere o mapeamento pelo nome", () => {
    const rows = [["Relatório"], [], ["Mês (MM/AAAA)", "Anexo", "Tributada integral", "ST ICMS", "Monofásico", "ST + monofásico", "Serviço sem retenção", "Serviço com retenção"], ["01/2025", "I", "1.000,00", "", "", "500", "", ""]];
    const h = detectarCabecalho(rows);
    expect(h).toBe(2);
    const m = sugerirMapeamento(rows[h]);
    expect(m).toMatchObject({ mes: 0, anexo: 1, colunas: { integral: 2, st: 3, mono: 4, stMono: 5, semRet: 6, comRet: 7 } });
    const linhas = linhasDePlanilha(rows, h, m);
    expect(linhas).toEqual([
      { mes: "2025-01", anexo: "I", coluna: "integral", valor: 1000, ref: "Linha 4" },
      { mes: "2025-01", anexo: "I", coluna: "stMono", valor: 500, ref: "Linha 4" },
    ]);
  });
  it("só total do mês vira linha de total", () => {
    const rows = [["Competência", "Faturamento"], ["jan/24", "10.000,00"], ["fev/24", "x"]];
    const m = sugerirMapeamento(rows[0]);
    const l = linhasDePlanilha(rows, 0, m);
    expect(l[0]).toMatchObject({ mes: "2024-01", total: true, valor: 10000 });
    expect(l[1].erro).toContain("Valor inválido");
  });
  it("colagem de duas colunas", () => {
    const l = linhasDeColagem("Mês\tValor\n01/2024\t1.000,00\nfev/24\t2.000,50\nlixo");
    expect(l.slice(0, 2)).toEqual([{ mes: "2024-01", total: true, valor: 1000, ref: "Linha 2" }, { mes: "2024-02", total: true, valor: 2000.5, ref: "Linha 3" }]);
    expect(l[2].erro).toBeTruthy();
  });
});

describe("prévia e aplicação", () => {
  const base = () => {
    const e = empresaNova("x", { razaoSocial: "T", cnpj: "", ano: 2025, anexos: ["I"] });
    e.anoAnterior[0] = 5000;
    return e;
  };
  it("status novo / vai sobrescrever / erro e destino por ano", () => {
    const e = base();
    const p = montarPrevia(e, [
      { mes: "2024-01", total: true, valor: 6000 },
      { mes: "2024-02", total: true, valor: 7000 },
      { mes: "2025-01", total: true, valor: 1000 },
      { mes: "2025-02", anexo: "III", coluna: "semRet", valor: 10 },
      { mes: "2023-12", total: true, valor: 1 },
      { mes: "2025-03", total: true, valor: -5 },
    ], "I");
    const por = (mes: string) => p.find((x) => x.mes === mes);
    expect(por("2024-01")).toMatchObject({ destino: "anterior", status: "sobrescrever", atual: 5000 });
    expect(por("2024-02")).toMatchObject({ destino: "anterior", status: "novo" });
    expect(por("2025-01")).toMatchObject({ destino: "I", coluna: "integral", status: "novo" });
    expect(por("2025-02")?.status).toBe("erro");
    expect(por("2023-12")?.status).toBe("erro");
    expect(por("2025-03")?.mensagem).toContain("negativo");
  });
  it("sem sobrescrever: mantém o valor atual e conta como ignorado", () => {
    const e = base();
    const p = montarPrevia(e, [{ mes: "2024-01", total: true, valor: 6000 }, { mes: "2024-02", total: true, valor: 7000 }], "I");
    const sel = new Set(p.map((x) => x.id));
    const nao = aplicarPrevia(e, p, sel, false);
    expect(nao.empresa.anoAnterior.slice(0, 2)).toEqual([5000, 7000]);
    expect([nao.importados, nao.sobrescritos, nao.ignorados]).toEqual([1, 0, 1]);
    const sim = aplicarPrevia(e, p, sel, true);
    expect(sim.empresa.anoAnterior.slice(0, 2)).toEqual([6000, 7000]);
    expect([sim.importados, sim.sobrescritos, sim.ignorados]).toEqual([2, 1, 0]);
  });
});
