import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ConfigForecast, LinhaOrcamento, Orcamento } from "./types";
import { CONFIG_PADRAO, nulls12, uid, zeros12 } from "./types";
import { analisarVariancia, gerarForecast, gerarRolling } from "./engine";

const STORAGE_KEY = "saga.orcamento.v1";

function novoOrcamento(nome: string, ano: number): Orcamento {
  return {
    id: uid(),
    nome,
    ano,
    moeda: "R$",
    criadoEm: new Date().toISOString(),
    linhas: [],
    config: { ...CONFIG_PADRAO },
  };
}

interface Ctx {
  orcamentos: Orcamento[];
  orcamento: Orcamento | null;
  pronto: boolean;
  selecionar: (id: string) => void;
  criar: (nome: string, ano: number) => void;
  duplicar: (id: string) => void;
  remover: (id: string) => void;
  atualizar: (patch: Partial<Orcamento>) => void;
  atualizarConfig: (patch: Partial<ConfigForecast>) => void;
  substituirLinhas: (linhas: LinhaOrcamento[]) => void;
  adicionarLinha: () => void;
  atualizarLinha: (id: string, patch: Partial<LinhaOrcamento>) => void;
  removerLinha: (id: string) => void;
  exportarEstado: () => string;
  importarEstado: (json: string) => void;
}

const OrcamentoCtx = createContext<Ctx | null>(null);

export function OrcamentoProvider({ children }: { children: ReactNode }) {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [ativoId, setAtivoId] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { orcamentos: Orcamento[]; ativoId: string };
        if (p.orcamentos?.length) {
          setOrcamentos(p.orcamentos);
          setAtivoId(p.ativoId || p.orcamentos[0].id);
          setPronto(true);
          return;
        }
      }
    } catch {
      /* estado corrompido */
    }
    const inicial = novoOrcamento("Orçamento 1", new Date().getFullYear());
    setOrcamentos([inicial]);
    setAtivoId(inicial.id);
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ orcamentos, ativoId }));
    } catch {
      /* quota */
    }
  }, [orcamentos, ativoId, pronto]);

  const orcamento = useMemo(
    () => orcamentos.find((o) => o.id === ativoId) ?? orcamentos[0] ?? null,
    [orcamentos, ativoId],
  );

  const patchAtivo = useCallback(
    (fn: (o: Orcamento) => Orcamento) =>
      setOrcamentos((prev) => prev.map((o) => (o.id === ativoId ? fn(o) : o))),
    [ativoId],
  );

  const value: Ctx = {
    orcamentos,
    orcamento,
    pronto,
    selecionar: setAtivoId,
    criar: (nome, ano) => {
      const o = novoOrcamento(nome || "Novo orçamento", ano);
      setOrcamentos((prev) => [...prev, o]);
      setAtivoId(o.id);
    },
    duplicar: (id) =>
      setOrcamentos((prev) => {
        const base = prev.find((o) => o.id === id);
        if (!base) return prev;
        const copia: Orcamento = {
          ...structuredClone(base),
          id: uid(),
          nome: `${base.nome} (cópia)`,
          criadoEm: new Date().toISOString(),
        };
        setAtivoId(copia.id);
        return [...prev, copia];
      }),
    remover: (id) =>
      setOrcamentos((prev) => {
        const rest = prev.filter((o) => o.id !== id);
        if (rest.length === 0) {
          const novo = novoOrcamento("Orçamento 1", new Date().getFullYear());
          setAtivoId(novo.id);
          return [novo];
        }
        if (id === ativoId) setAtivoId(rest[0].id);
        return rest;
      }),
    atualizar: (patch) => patchAtivo((o) => ({ ...o, ...patch })),
    atualizarConfig: (patch) => patchAtivo((o) => ({ ...o, config: { ...o.config, ...patch } })),
    substituirLinhas: (linhas) => patchAtivo((o) => ({ ...o, linhas })),
    adicionarLinha: () =>
      patchAtivo((o) => ({
        ...o,
        linhas: [
          ...o.linhas,
          {
            id: uid(),
            grupo: "Geral",
            conta: "Nova conta",
            tipo: "despesa",
            orcado: zeros12(),
            realizado: nulls12(),
          },
        ],
      })),
    atualizarLinha: (id, patch) =>
      patchAtivo((o) => ({
        ...o,
        linhas: o.linhas.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      })),
    removerLinha: (id) =>
      patchAtivo((o) => ({ ...o, linhas: o.linhas.filter((l) => l.id !== id) })),
    exportarEstado: () => JSON.stringify({ versao: 1, orcamentos, ativoId }, null, 2),
    importarEstado: (json) => {
      const p = JSON.parse(json) as { orcamentos: Orcamento[]; ativoId?: string };
      if (!Array.isArray(p.orcamentos) || p.orcamentos.length === 0)
        throw new Error("Arquivo de orçamento inválido.");
      setOrcamentos(p.orcamentos);
      setAtivoId(p.ativoId ?? p.orcamentos[0].id);
    },
  };

  return <OrcamentoCtx.Provider value={value}>{children}</OrcamentoCtx.Provider>;
}

export function useOrcamento() {
  const ctx = useContext(OrcamentoCtx);
  if (!ctx) throw new Error("useOrcamento precisa do OrcamentoProvider");
  return ctx;
}

export function useAnalises() {
  const { orcamento } = useOrcamento();
  return useMemo(() => {
    if (!orcamento || orcamento.linhas.length === 0)
      return { variancia: null, forecast: null, rolling: null };
    return {
      variancia: analisarVariancia(orcamento),
      forecast: gerarForecast(orcamento),
      rolling: gerarRolling(orcamento),
    };
  }, [orcamento]);
}
