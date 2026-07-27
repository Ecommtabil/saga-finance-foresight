import { createContext, useContext, useState, type ReactNode } from "react";
import type { DadosImportados, Empresa, Modo, Premissas } from "./types";

interface SagaState {
  modo: Modo | null;
  setModo: (m: Modo) => void;
  empresa: Empresa | null;
  setEmpresa: (e: Empresa) => void;
  dados: DadosImportados | null;
  setDados: (d: DadosImportados | null) => void;
  atualizarPremissas: (p: Partial<Premissas>) => void;
  reset: () => void;
}

const Ctx = createContext<SagaState | null>(null);

export function SagaProvider({ children }: { children: ReactNode }) {
  const [modo, setModoState] = useState<Modo | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [dados, setDados] = useState<DadosImportados | null>(null);

  const setModo = (m: Modo) => {
    setModoState(m);
    setDados(null);
  };

  const atualizarPremissas = (p: Partial<Premissas>) => {
    setDados((prev) =>
      prev ? { ...prev, premissas: { ...prev.premissas, ...p } } : prev,
    );
  };

  const reset = () => {
    setModoState(null);
    setEmpresa(null);
    setDados(null);
  };

  return (
    <Ctx.Provider
      value={{ modo, setModo, empresa, setEmpresa, dados, setDados, atualizarPremissas, reset }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSaga() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSaga precisa do SagaProvider");
  return ctx;
}