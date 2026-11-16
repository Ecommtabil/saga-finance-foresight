import { CAMPOS_COMPRAR_ALUGAR, PADRAO_COMPRAR_ALUGAR, relatorioComprarAlugar, type PremissasComprarAlugar } from "./comprar-alugar";
import { CAMPOS_EQUIPE, PADRAO_EQUIPE, relatorioEquipe, type PremissasEquipe } from "./equipe-terceirizar";
import { CAMPOS_MAQUINA, PADRAO_MAQUINA, relatorioMaquina, type PremissasMaquina } from "./maquina-leasing";
import { CAMPOS_NOVA_LINHA, PADRAO_NOVA_LINHA, relatorioNovaLinha, type PremissasNovaLinha } from "./nova-linha";
import type { CampoPremissa, EstudoId, RelatorioEstudo } from "./tipos";

export interface PremissasPorEstudo {
  "nova-linha": PremissasNovaLinha;
  "comprar-alugar": PremissasComprarAlugar;
  "maquina-leasing": PremissasMaquina;
  "equipe-terceirizar": PremissasEquipe;
}

export interface DefinicaoEstudo<K extends EstudoId = EstudoId> {
  id: K;
  titulo: string;
  descricao: string;
  tipoAnalise: string;
  rota: "/viabilidade/nova-linha" | "/viabilidade/comprar-alugar" | "/viabilidade/maquina-leasing" | "/viabilidade/equipe-terceirizar";
  padrao: PremissasPorEstudo[K];
  campos: CampoPremissa<PremissasPorEstudo[K]>[];
  relatorio: (p: PremissasPorEstudo[K]) => RelatorioEstudo;
}

export const ESTUDOS: { [K in EstudoId]: DefinicaoEstudo<K> } = {
  "nova-linha": {
    id: "nova-linha",
    titulo: "Nova Linha de Produtos",
    descricao: "Vale a pena investir para lançar um novo produto?",
    tipoAnalise: "DRE 5 anos + FCD + VPL/TIR/Payback",
    rota: "/viabilidade/nova-linha",
    padrao: PADRAO_NOVA_LINHA,
    campos: CAMPOS_NOVA_LINHA,
    relatorio: relatorioNovaLinha,
  },
  "comprar-alugar": {
    id: "comprar-alugar",
    titulo: "Comprar ou Alugar",
    descricao: "Imóvel ou ativo: imobilizar capital ou pagar aluguel?",
    tipoAnalise: "Fluxos comparativos e incrementais",
    rota: "/viabilidade/comprar-alugar",
    padrao: PADRAO_COMPRAR_ALUGAR,
    campos: CAMPOS_COMPRAR_ALUGAR,
    relatorio: relatorioComprarAlugar,
  },
  "maquina-leasing": {
    id: "maquina-leasing",
    titulo: "Máquina: Compra vs Leasing",
    descricao: "Comprar o equipamento ou contratar leasing?",
    tipoAnalise: "VPL + CAUE com benefício fiscal",
    rota: "/viabilidade/maquina-leasing",
    padrao: PADRAO_MAQUINA,
    campos: CAMPOS_MAQUINA,
    relatorio: relatorioMaquina,
  },
  "equipe-terceirizar": {
    id: "equipe-terceirizar",
    titulo: "Equipe Interna vs Terceirizar",
    descricao: "Contratar time próprio ou terceirizar o serviço?",
    tipoAnalise: "Custo incremental e ponto de inflexão",
    rota: "/viabilidade/equipe-terceirizar",
    padrao: PADRAO_EQUIPE,
    campos: CAMPOS_EQUIPE,
    relatorio: relatorioEquipe,
  },
};

export const LISTA_ESTUDOS: DefinicaoEstudo[] = Object.values(ESTUDOS) as DefinicaoEstudo[];

/** Relatório genérico de qualquer estudo, completando campos ausentes com o padrão. */
export function relatorioDe(id: EstudoId, premissas: unknown): RelatorioEstudo {
  const def = ESTUDOS[id] as unknown as DefinicaoEstudo;
  const p = { ...(def.padrao as object), ...((premissas as object) ?? {}) } as never;
  return def.relatorio(p);
}

export function premissasCompletas<K extends EstudoId>(id: K, premissas: unknown): PremissasPorEstudo[K] {
  return { ...(ESTUDOS[id].padrao as object), ...((premissas as object) ?? {}) } as PremissasPorEstudo[K];
}

export const NOTA_METODOLOGICA =
  "VPL: soma dos fluxos descontados à TMA, com o Ano 0 sem desconto (equivalente a =VPL(taxa; Ano1..AnoN) + Ano0 no Excel). " +
  "TIR: taxa que zera o VPL (Newton-Raphson com bisseção). Payback: anos até o acumulado ficar positivo, com interpolação dentro do ano. " +
  "CAUE: custo anual uniforme equivalente = VPL × [i(1+i)^n] / [(1+i)^n − 1]. " +
  "Benefício fiscal: despesas dedutíveis reduzem IRPJ/CSLL à alíquota informada, válido para empresas no Lucro Real; para Simples ou Presumido, use alíquota zero.";
