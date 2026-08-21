import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Cenario, EmpresaSimpl } from "./types";
import { cenarioPadrao, empresaPadrao, uid } from "./defaults";
import { projetar, validarCenario, type Projecao } from "./engine";
import { calcularDcf, type DcfResultado } from "./valuation";

const STORAGE_KEY = "saga.modelagem-simplificada.v1";

interface Ctx {
  empresas: EmpresaSimpl[];
  empresa: EmpresaSimpl | null;
  cenario: Cenario | null;
  projecao: Projecao | null;
  dcf: DcfResultado | null;
  avisos: string[];
  pronto: boolean;
  selecionarEmpresa: (id: string) => void;
  criarEmpresa: (nome: string) => void;
  duplicarEmpresa: (id: string) => void;
  removerEmpresa: (id: string) => void;
  atualizarEmpresa: (patch: Partial<EmpresaSimpl>) => void;
  selecionarCenario: (id: string) => void;
  criarCenario: (nome: string, copiarAtual?: boolean) => void;
  renomearCenario: (id: string, nome: string) => void;
  removerCenario: (id: string) => void;
  atualizarCenario: (patch: Partial<Cenario>) => void;
  projetarCenario: (cenarioId: string) => Projecao | null;
  importarEstado: (json: string) => void;
  exportarEstado: () => string;
}

const SimplContext = createContext<Ctx | null>(null);

export function SimplProvider({ children }: { children: ReactNode }) {
  const [empresas, setEmpresas] = useState<EmpresaSimpl[]>([]);
  const [ativaId, setAtivaId] = useState<string>("");
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { empresas: EmpresaSimpl[]; ativaId: string };
        if (parsed.empresas?.length) {
          setEmpresas(parsed.empresas);
          setAtivaId(parsed.ativaId || parsed.empresas[0].id);
          setPronto(true);
          return;
        }
      }
    } catch {
      /* ignora estado corrompido */
    }
    const e = empresaPadrao("Cliente Demo");
    setEmpresas([e]);
    setAtivaId(e.id);
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ empresas, ativaId }));
    } catch {
      /* quota */
    }
  }, [empresas, ativaId, pronto]);

  const empresa = empresas.find((e) => e.id === ativaId) ?? empresas[0] ?? null;
  const cenario = empresa
    ? (empresa.cenarios.find((c) => c.id === empresa.cenarioAtivoId) ?? empresa.cenarios[0] ?? null)
    : null;

  const projecao = useMemo(
    () => (empresa && cenario ? projetar(empresa, cenario) : null),
    [empresa, cenario],
  );
  const dcf = useMemo(
    () => (empresa && cenario && projecao ? calcularDcf(empresa, cenario, projecao) : null),
    [empresa, cenario, projecao],
  );
  const avisos = useMemo(() => {
    if (!empresa || !cenario) return [];
    return [...validarCenario(empresa, cenario), ...(projecao?.alertas ?? [])];
  }, [empresa, cenario, projecao]);

  const mutarEmpresa = (id: string, fn: (e: EmpresaSimpl) => EmpresaSimpl) =>
    setEmpresas((prev) => prev.map((e) => (e.id === id ? fn(e) : e)));

  const value: Ctx = {
    empresas,
    empresa,
    cenario,
    projecao,
    dcf,
    avisos,
    pronto,
    selecionarEmpresa: setAtivaId,
    criarEmpresa: (nome) => {
      const e = empresaPadrao(nome || "Nova empresa");
      setEmpresas((p) => [...p, e]);
      setAtivaId(e.id);
    },
    duplicarEmpresa: (id) => {
      const orig = empresas.find((e) => e.id === id);
      if (!orig) return;
      const copia: EmpresaSimpl = JSON.parse(JSON.stringify(orig));
      copia.id = uid();
      copia.nome = `${orig.nome} (cópia)`;
      copia.criadoEm = new Date().toISOString();
      setEmpresas((p) => [...p, copia]);
      setAtivaId(copia.id);
    },
    removerEmpresa: (id) => {
      setEmpresas((p) => {
        const rest = p.filter((e) => e.id !== id);
        if (!rest.length) {
          const nova = empresaPadrao("Nova empresa");
          setAtivaId(nova.id);
          return [nova];
        }
        if (id === ativaId) setAtivaId(rest[0].id);
        return rest;
      });
    },
    atualizarEmpresa: (patch) => {
      if (!empresa) return;
      mutarEmpresa(empresa.id, (e) => ({ ...e, ...patch }));
    },
    selecionarCenario: (id) => {
      if (!empresa) return;
      mutarEmpresa(empresa.id, (e) => ({ ...e, cenarioAtivoId: id }));
    },
    criarCenario: (nome, copiarAtual = true) => {
      if (!empresa) return;
      const novo: Cenario =
        copiarAtual && cenario
          ? { ...(JSON.parse(JSON.stringify(cenario)) as Cenario), id: uid(), nome }
          : { ...cenarioPadrao(nome) };
      mutarEmpresa(empresa.id, (e) => ({
        ...e,
        cenarios: [...e.cenarios, novo],
        cenarioAtivoId: novo.id,
      }));
    },
    renomearCenario: (id, nome) => {
      if (!empresa) return;
      mutarEmpresa(empresa.id, (e) => ({
        ...e,
        cenarios: e.cenarios.map((c) => (c.id === id ? { ...c, nome } : c)),
      }));
    },
    removerCenario: (id) => {
      if (!empresa || empresa.cenarios.length <= 1) return;
      mutarEmpresa(empresa.id, (e) => {
        const cenarios = e.cenarios.filter((c) => c.id !== id);
        return {
          ...e,
          cenarios,
          cenarioAtivoId: e.cenarioAtivoId === id ? cenarios[0].id : e.cenarioAtivoId,
        };
      });
    },
    atualizarCenario: (patch) => {
      if (!empresa || !cenario) return;
      mutarEmpresa(empresa.id, (e) => ({
        ...e,
        cenarios: e.cenarios.map((c) => (c.id === cenario.id ? { ...c, ...patch } : c)),
      }));
    },
    projetarCenario: (cenarioId) => {
      if (!empresa) return null;
      const c = empresa.cenarios.find((x) => x.id === cenarioId);
      return c ? projetar(empresa, c) : null;
    },
    importarEstado: (json) => {
      const parsed = JSON.parse(json) as { empresas: EmpresaSimpl[]; ativaId?: string };
      if (!parsed.empresas?.length) throw new Error("Arquivo inválido");
      setEmpresas(parsed.empresas);
      setAtivaId(parsed.ativaId ?? parsed.empresas[0].id);
    },
    exportarEstado: () => JSON.stringify({ empresas, ativaId }, null, 2),
  };

  return <SimplContext.Provider value={value}>{children}</SimplContext.Provider>;
}

export function useSimpl() {
  const ctx = useContext(SimplContext);
  if (!ctx) throw new Error("useSimpl deve ser usado dentro de SimplProvider");
  return ctx;
}
