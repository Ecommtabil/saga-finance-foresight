export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/\u00a0/g, " ");
export const num2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Fração → "7,5432%". */
export const pct4 = (v: number) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`;
export const pct2 = (v: number) => `${(v * 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
export const nomeMes = (mes: string) => {
  const [a, m] = mes.split("-");
  return `${m}/${a}`;
};
export function nomeArquivoSimples(razao: string, ano: number, ext: string) {
  const nome = razao.trim().replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, "_").slice(0, 70) || "Empresa";
  return `Ecommtabil_Simples_${nome}_${ano}.${ext}`;
}
