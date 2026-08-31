import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { modeloPadrao, uid } from "./defaults";
import type { ModeloMF2 } from "./types";

const STORAGE_KEY = "saga.modelagem-financeira-2.v1";

interface Ctx {
  modelos: ModeloMF2[];
  pronto: boolean;
  obterModelo: (id: string) => ModeloMF2 | null;
  criarModelo: (dados: Parameters<typeof modeloPadrao>[0]) => ModeloMF2;
  atualizarModelo: (id: string, patch: Partial<ModeloMF2>) => void;
  duplicarModelo: (id: string) => void;
  removerModelo: (id: string) => void;
}

const MF2Context = createContext<Ctx | null>(null);

export function MF2Provider({ children }: { children: ReactNode }) {
  const [modelos, setModelos] = useState<ModeloMF2[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setModelos(JSON.parse(raw) as ModeloMF2[]);
    } catch {
      /* estado corrompido */
    }
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(modelos));
    } catch {
      /* quota */
    }
  }, [modelos, pronto]);

  const obterModelo = useCallback(
    (id: string) => modelos.find((m) => m.id === id) ?? null,
    [modelos],
  );

  const criarModelo: Ctx["criarModelo"] = useCallback((dados) => {
    const novo = modeloPadrao(dados);
    setModelos((prev) => [novo, ...prev]);
    return novo;
  }, []);

  const atualizarModelo: Ctx["atualizarModelo"] = useCallback((id, patch) => {
    setModelos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }, []);

  const duplicarModelo = useCallback((id: string) => {
    setModelos((prev) => {
      const base = prev.find((m) => m.id === id);
      if (!base) return prev;
      return [
        {
          ...structuredClone(base),
          id: uid(),
          nomeEmpresa: `${base.nomeEmpresa} (cópia)`,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ];
    });
  }, []);

  const removerModelo = useCallback((id: string) => {
    setModelos((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <MF2Context.Provider
      value={{
        modelos,
        pronto,
        obterModelo,
        criarModelo,
        atualizarModelo,
        duplicarModelo,
        removerModelo,
      }}
    >
      {children}
    </MF2Context.Provider>
  );
}

export function useMF2(): Ctx {
  const ctx = useContext(MF2Context);
  if (!ctx) throw new Error("useMF2 precisa estar dentro de MF2Provider");
  return ctx;
}
