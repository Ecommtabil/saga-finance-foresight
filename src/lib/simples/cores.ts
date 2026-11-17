import type { AnexoId, Tributo } from "./tabelas";

export const COR_ANEXO: Record<AnexoId, string> = { I: "#0F2A44", II: "#C9A227", III: "#5A7FB0", IV: "#7E8FA3", V: "#A8742B" };
export const COR_TRIBUTO: Record<Tributo, string> = {
  CPP: "#0F2A44", IRPJ: "#5A7FB0", CSLL: "#9DB4D3", COFINS: "#C9A227", PIS: "#E3CD7E", ICMS: "#7E8FA3", IPI: "#A8742B", ISS: "#3E6B5C",
};
