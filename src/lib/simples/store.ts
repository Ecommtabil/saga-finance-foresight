import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { DadosCalculo, MesReceita } from "./calculo";
import { ANO_TABELA_PADRAO, tabelasPadrao, type AnexoId, type TabelasSimples } from "./tabelas";

export interface ConferenciaRbt12 { valor: number; arquivo: string }

export interface EmpresaSimples extends DadosCalculo {
  id: string;
  razaoSocial: string;
  cnpj: string;
  /** Folha de salários mensal ("AAAA-MM") lida do PGDAS, guardada para o Fator R. */
  folha: Record<string, number>;
  /** RBT12 lido do PGDAS-D por mês do ano ("AAAA-MM"), para conferência. */
  conferenciaRbt12: Record<string, ConferenciaRbt12>;
  criadoEm: string;
  atualizadoEm: string;
}

export type OrigemImportacao = "pgdas" | "planilha" | "colar";
export const NOME_ORIGEM: Record<OrigemImportacao, string> = { pgdas: "Extrato PGDAS-D (PDF)", planilha: "Planilha Excel/CSV", colar: "Colado do Excel" };

type DadosReceita = Pick<EmpresaSimples, "anoAnterior" | "receitas" | "folha" | "conferenciaRbt12">;
export interface RegistroImportacao {
  id: string;
  empresaId: string;
  data: string;
  usuario: string;
  arquivo: string;
  origem: OrigemImportacao;
  meses: number;
  sobrescritos: number;
  ignorados: number;
  /** Dados antes da importação, para desfazer (só guardado na última de cada empresa). */
  antes?: DadosReceita;
}

interface EstadoSimples {
  empresas: EmpresaSimples[];
  tabelasPorAno: Record<string, TabelasSimples>;
  historico: RegistroImportacao[];
  criarEmpresa: (dados: Pick<EmpresaSimples, "razaoSocial" | "cnpj" | "ano" | "anexos">) => string;
  atualizarEmpresa: (id: string, f: (e: EmpresaSimples) => EmpresaSimples) => void;
  excluirEmpresa: (id: string) => void;
  definirTabelas: (ano: number, t: TabelasSimples) => void;
  excluirTabelas: (ano: number) => void;
  registrarImportacao: (empresaId: string, nova: EmpresaSimples, r: Omit<RegistroImportacao, "id" | "empresaId" | "data" | "antes">) => void;
  desfazerUltima: (empresaId: string) => boolean;
}

const agora = () => new Date().toISOString();
const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

export function mesesVazios(): MesReceita[] {
  return Array.from({ length: 12 }, () => ({}));
}

export function empresaNova(id: string, d: Pick<EmpresaSimples, "razaoSocial" | "cnpj" | "ano" | "anexos">): EmpresaSimples {
  const t = agora();
  const receitas: Partial<Record<AnexoId, MesReceita[]>> = {};
  for (const a of d.anexos) receitas[a] = mesesVazios();
  return {
    id, ...d, inicioAtividade: false, mesInicio: null,
    anoAnterior: Array(12).fill(0), receitas, rbt12Manual: Array(12).fill(null),
    folha: {}, conferenciaRbt12: {}, criadoEm: t, atualizadoEm: t,
  };
}

/** Garante a grade de 12 meses para cada anexo selecionado. */
export function normalizarEmpresa(e: EmpresaSimples): EmpresaSimples {
  const receitas = { ...e.receitas };
  for (const a of e.anexos) {
    const atual = receitas[a] ?? [];
    receitas[a] = Array.from({ length: 12 }, (_, i) => atual[i] ?? {});
  }
  return {
    ...e, receitas,
    anoAnterior: Array.from({ length: 12 }, (_, i) => Number(e.anoAnterior?.[i]) || 0),
    rbt12Manual: Array.from({ length: 12 }, (_, i) => (typeof e.rbt12Manual?.[i] === "number" ? (e.rbt12Manual[i] as number) : null)),
    folha: e.folha ?? {}, conferenciaRbt12: e.conferenciaRbt12 ?? {},
  };
}

// Chave "saga.*" acompanha o projeto ativo (projetos locais).
export const CHAVE_SIMPLES = "saga.simples.v1";

export const useSimples = create<EstadoSimples>()(
  persist(
    (set, get) => ({
      empresas: [],
      tabelasPorAno: { [String(ANO_TABELA_PADRAO)]: tabelasPadrao() },
      historico: [],
      criarEmpresa: (d) => {
        const id = crypto.randomUUID();
        set((s) => ({ empresas: [empresaNova(id, d), ...s.empresas] }));
        return id;
      },
      atualizarEmpresa: (id, f) => set((s) => ({
        empresas: s.empresas.map((e) => (e.id === id ? { ...normalizarEmpresa(f(e)), atualizadoEm: agora() } : e)),
      })),
      excluirEmpresa: (id) => set((s) => ({ empresas: s.empresas.filter((e) => e.id !== id), historico: s.historico.filter((h) => h.empresaId !== id) })),
      definirTabelas: (ano, t) => set((s) => ({ tabelasPorAno: { ...s.tabelasPorAno, [String(ano)]: clonar(t) } })),
      excluirTabelas: (ano) => set((s) => {
        const copia = { ...s.tabelasPorAno };
        delete copia[String(ano)];
        return { tabelasPorAno: Object.keys(copia).length ? copia : { [String(ANO_TABELA_PADRAO)]: tabelasPadrao() } };
      }),
      registrarImportacao: (empresaId, nova, r) => {
        const atual = get().empresas.find((e) => e.id === empresaId);
        if (!atual) return;
        const antes: DadosReceita = clonar({ anoAnterior: atual.anoAnterior, receitas: atual.receitas, folha: atual.folha, conferenciaRbt12: atual.conferenciaRbt12 });
        const registro: RegistroImportacao = { ...r, id: crypto.randomUUID(), empresaId, data: agora(), antes };
        set((s) => ({
          empresas: s.empresas.map((e) => (e.id === empresaId ? { ...normalizarEmpresa(nova), atualizadoEm: agora() } : e)),
          // Só a última importação de cada empresa guarda os dados para desfazer.
          historico: [registro, ...s.historico.map((h) => (h.empresaId === empresaId ? { ...h, antes: undefined } : h))].slice(0, 200),
        }));
      },
      desfazerUltima: (empresaId) => {
        const ultima = get().historico.find((h) => h.empresaId === empresaId);
        if (!ultima?.antes) return false;
        const antes = ultima.antes;
        set((s) => ({
          empresas: s.empresas.map((e) => (e.id === empresaId ? normalizarEmpresa({ ...e, ...clonar(antes), atualizadoEm: agora() }) : e)),
          historico: s.historico.filter((h) => h.id !== ultima.id),
        }));
        return true;
      },
    }),
    {
      name: CHAVE_SIMPLES,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ empresas: s.empresas, tabelasPorAno: s.tabelasPorAno, historico: s.historico }),
      merge: (persistido, atual) => {
        const p = (persistido ?? {}) as Partial<EstadoSimples>;
        return {
          ...atual, ...p,
          empresas: (p.empresas ?? []).map(normalizarEmpresa),
          tabelasPorAno: p.tabelasPorAno && Object.keys(p.tabelasPorAno).length ? p.tabelasPorAno : atual.tabelasPorAno,
        };
      },
    },
  ),
);

export function mascaraCnpj(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}
