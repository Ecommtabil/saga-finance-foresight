import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { SEM_FILTROS, type FiltrosPVM, type NivelPVM, type RegistroPVM } from "@/lib/pvm";
import type { ResumoImportacao } from "./importacao";

export type ModoPVM = "dois" | "acumulado" | "mensal";

export interface ControlesPVM {
  modo: ModoPVM;
  base: string | null; baseFim: string | null;
  atual: string | null; atualFim: string | null;
  nivel: NivelPVM;
  filtros: FiltrosPVM;
}

export const CONTROLES_PADRAO: ControlesPVM = { modo: "dois", base: null, baseFim: null, atual: null, atualFim: null, nivel: "unidade", filtros: SEM_FILTROS };

interface EstadoPVM {
  registros: RegistroPVM[];
  resumo: ResumoImportacao | null;
  cliente: string;
  controles: ControlesPVM;
  importar: (registros: RegistroPVM[], resumo: ResumoImportacao) => void;
  limpar: () => void;
  setCliente: (c: string) => void;
  setControles: (f: (c: ControlesPVM) => ControlesPVM) => void;
}

export const CHAVE_PVM = "saga.pvm.v1"; // segue o projeto local ativo

export const usePVM = create<EstadoPVM>()(
  persist(
    set => ({
      registros: [],
      resumo: null,
      cliente: "",
      controles: CONTROLES_PADRAO,
      importar: (registros, resumo) => set({
        registros, resumo,
        controles: { ...CONTROLES_PADRAO, base: resumo.meses[0] ?? null, atual: resumo.meses[1] ?? resumo.meses[0] ?? null, baseFim: resumo.meses[0] ?? null, atualFim: resumo.meses[1] ?? resumo.meses[0] ?? null },
      }),
      limpar: () => set({ registros: [], resumo: null, controles: CONTROLES_PADRAO }),
      setCliente: cliente => set({ cliente }),
      setControles: f => set(s => ({ controles: f(s.controles) })),
    }),
    {
      name: CHAVE_PVM,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: s => ({ registros: s.registros, resumo: s.resumo, cliente: s.cliente, controles: s.controles }),
    },
  ),
);
