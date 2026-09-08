import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { uid, type CenarioOrcamento } from "./types";

const STORAGE_KEY = "saga.planejamento.v1";

function novoCenario(nome: string, ano: number): CenarioOrcamento {
  const agora = new Date().toISOString();
  return { id: uid(), nome, ano, moeda: "R$", criadoEm: agora, atualizadoEm: agora };
}

interface Ctx {
  cenarios: CenarioOrcamento[];
  cenario: CenarioOrcamento | null;
  pronto: boolean;
  selecionar: (id: string) => void;
  criar: (nome: string, ano: number) => void;
  duplicar: (id: string) => void;
  remover: (id: string) => void;
  atualizar: (patch: Partial<CenarioOrcamento>) => void;
}

const PobCtx = createContext<Ctx | null>(null);

export function PlanejamentoProvider({ children }: { children: ReactNode }) {
  const [cenarios, setCenarios] = useState<CenarioOrcamento[]>([]);
  const [ativoId, setAtivoId] = useState("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { cenarios: CenarioOrcamento[]; ativoId: string };
        if (p.cenarios?.length) {
          setCenarios(p.cenarios);
          setAtivoId(p.ativoId || p.cenarios[0].id);
          setPronto(true);
          return;
        }
      }
    } catch {
      /* estado corrompido */
    }
    const inicial = novoCenario(`Orçamento ${new Date().getFullYear()}`, new Date().getFullYear());
    setCenarios([inicial]);
    setAtivoId(inicial.id);
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ cenarios, ativoId }));
    } catch {
      /* quota */
    }
  }, [cenarios, ativoId, pronto]);

  const cenario = useMemo(
    () => cenarios.find((c) => c.id === ativoId) ?? cenarios[0] ?? null,
    [cenarios, ativoId],
  );

  const atualizar = useCallback(
    (patch: Partial<CenarioOrcamento>) =>
      setCenarios((prev) =>
        prev.map((c) =>
          c.id === ativoId ? { ...c, ...patch, atualizadoEm: new Date().toISOString() } : c,
        ),
      ),
    [ativoId],
  );

  const value: Ctx = {
    cenarios,
    cenario,
    pronto,
    selecionar: setAtivoId,
    criar: (nome, ano) => {
      const c = novoCenario(nome || "Novo cenário", ano);
      setCenarios((prev) => [...prev, c]);
      setAtivoId(c.id);
    },
    duplicar: (id) =>
      setCenarios((prev) => {
        const base = prev.find((c) => c.id === id);
        if (!base) return prev;
        const copia: CenarioOrcamento = {
          ...structuredClone(base),
          id: uid(),
          nome: `${base.nome} (cópia)`,
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
        };
        setAtivoId(copia.id);
        return [...prev, copia];
      }),
    remover: (id) =>
      setCenarios((prev) => {
        const rest = prev.filter((c) => c.id !== id);
        if (rest.length === 0) {
          const novo = novoCenario(`Orçamento ${new Date().getFullYear()}`, new Date().getFullYear());
          setAtivoId(novo.id);
          return [novo];
        }
        if (id === ativoId) setAtivoId(rest[0].id);
        return rest;
      }),
    atualizar,
  };

  return <PobCtx.Provider value={value}>{children}</PobCtx.Provider>;
}

export function usePlanejamento() {
  const ctx = useContext(PobCtx);
  if (!ctx) throw new Error("usePlanejamento precisa do PlanejamentoProvider");
  return ctx;
}
