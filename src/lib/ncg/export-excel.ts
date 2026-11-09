import * as XLSX from "xlsx";
import { dadosRelatorio } from "./relatorio-dados";
import { baixarArquivo, nomeArquivoNCG } from "./download";
import type { PremissasNCG } from "./premissas";

export function criarExcelNCG(empresa: string, cnpj: string, p: PremissasNCG) {
  const d = dadosRelatorio(empresa, cnpj, p);
  const ncg: (string | number)[][] = [
    ["Ecommtabil — Memorial de cálculo NCG"], ["Empresa", empresa], [],
    ["Prazo", "Dias", "Fórmula"], ...d.prazos, [],
    ["Base diária", "R$/dia", "Fórmula"], ...d.bases, [],
    ["Componente", "Valor (R$)", "Dias aplicados", "Lógica"],
    ...d.componentes.map(c => [c.nome, c.valor, c.dias ?? "", c.logica]), [],
    ["Necessidade total x caixa", "Valor (R$)", "Lógica"], ...d.totais,
    ["Status", d.r.giroCoberto ? "Giro coberto" : "Falta giro"],
    ["Cobertura do caixa", d.r.coberturaCaixa, "Caixa / capital de giro total necessário"],
    ["NCG em dias de venda", d.r.ncgDiasVenda], ["NCG sobre vendas anualizadas", d.r.ncgSobreVendasAnualizadas], [],
    ["NCG simplificada", d.r.ncgSimplificada], ["Diferença simplificada − técnica", d.r.diferencaSimplificada],
    ["Diagnóstico", d.diagnostico],
  ];
  const wb = XLSX.utils.book_new();
  const abas: [string, (string | number)[][]][] = [["Premissas", [["Campo", "Valor"], ...d.premissas]], ["NCG", ncg]];
  for (const [nome, linhas] of abas) {
    const ws = XLSX.utils.aoa_to_sheet(linhas);
    linhas.forEach((linha, ri) => linha.forEach((v, ci) => {
      if (typeof v !== "number") return;
      const celula = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
      if (!celula) return;
      const rotulo = String(linha[0]);
      celula.z = rotulo === "Cobertura do caixa" || rotulo === "NCG sobre vendas anualizadas" ? "0.0%" : /dias|Prazo|Reserva \(meses\)|PMR|PME|PMP|Ciclo/i.test(rotulo) || (nome === "NCG" && ci === 2) ? "0" : '"R$ "#,##0.00;("R$ "#,##0.00)';
    }));
    ws["!cols"] = [{ wch: 46 }, { wch: 30 }, { wch: 45 }, { wch: 60 }];
    XLSX.utils.book_append_sheet(wb, ws, nome);
  }
  return wb;
}
export function exportarExcelNCG(empresa: string, cnpj: string, p: PremissasNCG) {
  const bytes = XLSX.write(criarExcelNCG(empresa, cnpj, p), { type: "array", bookType: "xlsx" });
  baixarArquivo(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), nomeArquivoNCG(empresa, "xlsx"));
}