import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { DadosImportados, Empresa, Modo, Premissas } from "./types";
import type { DatasetEstatistico } from "./stats";

export interface ProjetoSaga {
  versao: 1;
  salvoEm: string;
  modo: Modo | null;
  empresa: Empresa | null;
  dados: DadosImportados | null;
  statsDataset: DatasetEstatistico | null;
}

interface SagaState {
  modo: Modo | null;
  setModo: (m: Modo) => void;
  empresa: Empresa | null;
  setEmpresa: (e: Empresa) => void;
  dados: DadosImportados | null;
  setDados: (d: DadosImportados | null) => void;
  atualizarPremissas: (p: Partial<Premissas>) => void;
  statsDataset: DatasetEstatistico | null;
  setStatsDataset: (d: DatasetEstatistico | null) => void;
  exportarProjeto: () => ProjetoSaga;
  carregarProjeto: (p: ProjetoSaga) => void;
  reset: () => void;
}

const Ctx = createContext<SagaState | null>(null);

export function SagaProvider({ children }: { children: ReactNode }) {
  const [modo, setModoState] = useState<Modo | null>(null);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);
  const [dados, setDados] = useState<DadosImportados | null>(null);
  const [statsDataset, setStatsDataset] = useState<DatasetEstatistico | null>(null);

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
    setStatsDataset(null);
  };

  const exportarProjeto = (): ProjetoSaga => ({
    versao: 1,
    salvoEm: new Date().toISOString(),
    modo,
    empresa,
    dados,
    statsDataset,
  });

  const carregarProjeto = (p: ProjetoSaga) => {
    setModoState(p.modo ?? null);
    setEmpresa(p.empresa ?? null);
    setDados(p.dados ?? null);
    setStatsDataset(p.statsDataset ?? null);
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("saga.nuvem.pendente");
      if (!raw) return;
      sessionStorage.removeItem("saga.nuvem.pendente");
      const p = JSON.parse(raw) as ProjetoSaga | null;
      if (p) carregarProjeto(p);
    } catch {
      /* ignora */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Ctx.Provider
      value={{ modo, setModo, empresa, setEmpresa, dados, setDados, atualizarPremissas, statsDataset, setStatsDataset, exportarProjeto, carregarProjeto, reset }}
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