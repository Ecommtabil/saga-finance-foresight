import * as XLSX from "xlsx";
import type { Modo } from "./types";

const HEADER_ANOS = ["Conta", "Ano 1", "Ano 2", "Ano 3", "Ano 4", "Ano 5"];

const DRE_ROWS = [
  ["Receita Bruta", 1000, 1150, 1300, 1450, 1600],
  ["Deduções", -100, -115, -130, -145, -160],
  ["Receita Líquida", 900, 1035, 1170, 1305, 1440],
  ["CMV", -450, -500, -560, -620, -680],
  ["Lucro Bruto", 450, 535, 610, 685, 760],
  ["Despesas Operacionais", -200, -220, -240, -260, -280],
  ["EBITDA", 250, 315, 370, 425, 480],
  ["Depreciação", -30, -35, -40, -45, -50],
  ["EBIT", 220, 280, 330, 380, 430],
  ["Resultado Financeiro", -20, -22, -25, -28, -30],
  ["LAIR", 200, 258, 305, 352, 400],
  ["Impostos", -68, -88, -104, -120, -136],
  ["Lucro Líquido", 132, 170, 201, 232, 264],
];

const BP_ROWS = [
  ["Caixa e Equivalentes", 80, 100, 130, 160, 200],
  ["Contas a Receber", 120, 140, 160, 180, 200],
  ["Estoques", 90, 100, 115, 130, 145],
  ["Ativo Circulante", 290, 340, 405, 470, 545],
  ["Ativo Não Circulante", 500, 540, 590, 640, 700],
  ["Ativo Total", 790, 880, 995, 1110, 1245],
  ["Fornecedores", 70, 78, 88, 98, 108],
  ["Empréstimos CP", 50, 55, 60, 65, 70],
  ["Passivo Circulante", 120, 133, 148, 163, 178],
  ["Empréstimos LP", 200, 210, 225, 240, 255],
  ["Passivo Não Circulante", 200, 210, 225, 240, 255],
  ["Patrimônio Líquido", 470, 537, 622, 707, 812],
  ["Passivo + PL Total", 790, 880, 995, 1110, 1245],
];

const PREMISSAS_ROWS = [
  ["Empresa", "Nome da Empresa"],
  ["Ano Base", 2024],
  ["Selic", 0.105],
  ["CDI", 0.104],
  ["IPCA", 0.045],
  ["Taxa Livre de Risco (Rf)", 0.105],
  ["Beta", 1.1],
  ["ERP (Prêmio de Risco)", 0.055],
  ["Alíquota IR/CSLL", 0.34],
  ["Custo da Dívida", 0.12],
  ["Dívida Total (Valor de Mercado)", 250],
  ["Equity (Valor de Mercado)", 1200],
  ["Crescimento Perpetuidade (g)", 0.03],
  ["Crescimento Projetado", 0.08],
];

export function gerarPlanilhaModelo(modo: Modo): Blob {
  const wb = XLSX.utils.book_new();
  const wsPrem = XLSX.utils.aoa_to_sheet([["Chave", "Valor"], ...PREMISSAS_ROWS]);
  XLSX.utils.book_append_sheet(wb, wsPrem, "Premissas");
  const wsDre = XLSX.utils.aoa_to_sheet([HEADER_ANOS, ...DRE_ROWS]);
  XLSX.utils.book_append_sheet(wb, wsDre, "DRE");
  if (modo === "completa") {
    const wsBp = XLSX.utils.aoa_to_sheet([HEADER_ANOS, ...BP_ROWS]);
    XLSX.utils.book_append_sheet(wb, wsBp, "Balanco");
  } else {
    const wsBp = XLSX.utils.aoa_to_sheet([
      HEADER_ANOS,
      ["Caixa e Equivalentes", 80, 100, 130, 160, 200],
      ["Dívida Total", 250, 265, 285, 305, 325],
      ["Patrimônio Líquido", 470, 537, 622, 707, 812],
    ]);
    XLSX.utils.book_append_sheet(wb, wsBp, "Balanco_Simplificado");
  }
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function baixarPlanilhaModelo(modo: Modo) {
  const blob = gerarPlanilhaModelo(modo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `SAGA_Modelo_${modo === "completa" ? "Completa" : "Basica"}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}