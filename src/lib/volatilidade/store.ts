import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CONFIG_PADRAO, estudoExemplo, estudoVazio, ordenarLinhas, type ConfigVolatilidade, type Estudo } from "./dados";

interface EstadoVolatilidade {
  estudo: Estudo;
  salvos: Estudo[];
  config: ConfigVolatilidade;
  atualizar: (f: (e: Estudo) => Estudo) => void;
  definirConfig: (c: Partial<ConfigVolatilidade>) => void;
  carregarExemplo: () => void;
  novoEstudo: () => void;
  salvar: () => void;
  abrir: (id: string) => void;
  duplicar: (id?: string) => void;
  excluir: (id: string) => void;
}

const agora = () => new Date().toISOString();
const novoId = () => crypto.randomUUID();
const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// Chave "saga.*" acompanha o projeto ativo (workspaces locais).
export const CHAVE_VOLATILIDADE = "saga.volatilidade.v1";

export const useVolatilidade = create<EstadoVolatilidade>()(
  persist(
    (set, get) => ({
      estudo: estudoExemplo(),
      salvos: [],
      config: CONFIG_PADRAO,
      atualizar: f => set(s => {
        const e = f(s.estudo);
        return { estudo: { ...e, linhas: ordenarLinhas(e.linhas), atualizadoEm: agora() } };
      }),
      definirConfig: c => set(s => ({ config: { ...s.config, ...c } })),
      carregarExemplo: () => set(s => ({ estudo: { ...estudoExemplo(s.estudo.id, agora()), cliente: s.estudo.cliente || "Cliente Exemplo Ltda.", cnpj: s.estudo.cnpj, responsavel: s.estudo.responsavel, dataAnalise: s.estudo.dataAnalise || agora().slice(0, 10) } })),
      novoEstudo: () => set({ estudo: estudoVazio(novoId(), agora()) }),
      salvar: () => {
        const e = { ...get().estudo, atualizadoEm: agora() };
        const lista = get().salvos.filter(x => x.id !== e.id);
        set({ estudo: e, salvos: [clonar(e), ...lista] });
      },
      abrir: id => { const e = get().salvos.find(x => x.id === id); if (e) set({ estudo: clonar(e) }); },
      duplicar: id => {
        const base = id ? get().salvos.find(x => x.id === id) : get().estudo;
        if (!base) return;
        const t = agora();
        set({ estudo: { ...clonar(base), id: novoId(), cliente: base.cliente ? `${base.cliente} (cópia)` : "", cnpj: "", diagnostico: null, criadoEm: t, atualizadoEm: t } });
      },
      excluir: id => set(s => ({ salvos: s.salvos.filter(x => x.id !== id) })),
    }),
    {
      name: CHAVE_VOLATILIDADE,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: s => ({ estudo: s.estudo, salvos: s.salvos, config: s.config }),
      merge: (persistido, atual) => {
        const p = (persistido ?? {}) as Partial<EstadoVolatilidade>;
        return { ...atual, ...p, config: { ...CONFIG_PADRAO, ...(p.config ?? {}) } };
      },
    },
  ),
);
