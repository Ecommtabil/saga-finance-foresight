import * as XLSX from "xlsx";
import { MESES_POB } from "./types";

export const ABAS_POB = {
  vendas: "Vendas",
  impostos: "Impostos",
  producao: "Producao",
  materiaPrima: "Materia-Prima",
  maoDeObra: "Mao de Obra",
  custosIndiretos: "Custos Indiretos",
  despesas: "Despesas",
  capex: "CAPEX",
  emprestimos: "Emprestimos",
} as const;

const M = [...MESES_POB];

function sheet(rows: (string | number)[][], widths: number[]) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = widths.map((w) => ({ wch: w }));
  return ws;
}

/** Gera e baixa a planilha modelo do Planejamento Orçamentário. */
export function baixarModeloPOB(nomeArquivo = "SAGA_Planejamento_Orcamentario_Modelo.xlsx") {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Produto", "Unidade", "Preço Unitário", ...M],
        ["Produto A", "un", 250, 100, 110, 120, 120, 130, 140, 140, 150, 150, 160, 170, 180],
        ["Produto B", "un", 90, 300, 300, 320, 320, 340, 350, 350, 360, 380, 400, 420, 450],
      ],
      [28, 10, 14, ...M.map(() => 8)],
    ),
    ABAS_POB.vendas,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Tributo", "Alíquota (%)"],
        ["ICMS", 18],
        ["ISS", 0],
        ["IPI", 0],
        ["PIS/COFINS", 9.25],
        ["IRPJ/CSLL", 34],
        ["Créditos Tributários", 8],
      ],
      [26, 14],
    ),
    ABAS_POB.impostos,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Parâmetro", "Valor"],
        ["Estoque inicial de produto acabado (un)", 0],
        ["Dias de estoque de produto acabado", 15],
        ["Perda de processo (%)", 2],
      ],
      [40, 14],
    ),
    ABAS_POB.producao,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        [
          "Insumo",
          "Unidade",
          "Custo Unitário",
          "Consumo por Unidade",
          "Dias de Estoque",
          "Dias de Pagamento",
        ],
        ["Matéria-prima 1", "kg", 12, 1.5, 20, 30],
        ["Embalagem", "un", 2.5, 1, 10, 30],
      ],
      [26, 10, 14, 20, 16, 18],
    ),
    ABAS_POB.materiaPrima,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Cargo", "Tipo (Direta/Indireta)", "Quantidade", "Salário Mensal", "Encargos (%)", "Benefícios"],
        ["Operador de produção", "Direta", 10, 2200, 70, 450],
        ["Supervisor", "Indireta", 2, 6500, 70, 800],
      ],
      [26, 22, 12, 16, 14, 12],
    ),
    ABAS_POB.maoDeObra,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Descrição", ...M],
        ["Energia elétrica fábrica", ...M.map(() => 18000)],
        ["Manutenção", ...M.map(() => 7000)],
      ],
      [30, ...M.map(() => 10)],
    ),
    ABAS_POB.custosIndiretos,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Descrição", ...M],
        ["Administrativo", ...M.map(() => 45000)],
        ["Comercial e marketing", ...M.map(() => 22000)],
      ],
      [30, ...M.map(() => 10)],
    ),
    ABAS_POB.despesas,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Descrição", "Mês (1-12)", "Valor", "Depreciação Anual (%)"],
        ["Máquina nova", 3, 250000, 10],
      ],
      [30, 12, 16, 22],
    ),
    ABAS_POB.capex,
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheet(
      [
        ["Nome", "Valor", "Mês Captação (1-12)", "Prazo (meses)", "Juros Anual (%)"],
        ["Financiamento máquina", 200000, 3, 48, 16],
      ],
      [28, 16, 20, 16, 18],
    ),
    ABAS_POB.emprestimos,
  );

  XLSX.writeFile(wb, nomeArquivo);
}
