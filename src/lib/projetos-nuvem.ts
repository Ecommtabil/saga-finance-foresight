import type { ProjetoSaga } from "./saga/context";

export const PENDENTE_KEY = "saga.nuvem.pendente";

export interface SnapshotCompleto {
  versao: 1;
  saga: ProjetoSaga;
  armazenamento: Record<string, string>;
}

/** Captura todos os módulos: estado em memória do SAGA + dados salvos no navegador. */
export function capturarSnapshot(saga: ProjetoSaga): SnapshotCompleto {
  const armazenamento: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("saga.") && k !== PENDENTE_KEY) {
      const v = localStorage.getItem(k);
      if (v != null) armazenamento[k] = v;
    }
  }
  return { versao: 1, saga, armazenamento };
}

/** Restaura um snapshot e recarrega o app para que todos os módulos leiam os novos dados. */
export function restaurarSnapshot(s: SnapshotCompleto) {
  const remover: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("saga.")) remover.push(k);
  }
  remover.forEach((k) => localStorage.removeItem(k));
  Object.entries(s.armazenamento ?? {}).forEach(([k, v]) => localStorage.setItem(k, v));
  sessionStorage.setItem(PENDENTE_KEY, JSON.stringify(s.saga ?? null));
  window.location.assign("/");
}
