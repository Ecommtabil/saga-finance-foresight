import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Estado salvo automaticamente no localStorage (chave deve começar com "saga."
 * para acompanhar o projeto ativo). Carrega após a hidratação para evitar divergência SSR.
 * Ao trocar de chave, nunca grava o valor antigo na nova chave antes de carregá-la.
 */
export function usePersistedState<T>(key: string, inicial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(inicial);
  const inicialRef = useRef(inicial);
  const chaveCarregada = useRef<string | null>(null);
  const pularGravacao = useRef(false);

  useEffect(() => {
    let v: T | undefined;
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) v = JSON.parse(raw) as T;
    } catch {
      /* ignora */
    }
    const ini = inicialRef.current;
    const novo = v !== undefined ? v : typeof ini === "function" ? (ini as () => T)() : ini;
    chaveCarregada.current = key;
    pularGravacao.current = true;
    setValor(novo);
  }, [key]);

  useEffect(() => {
    if (chaveCarregada.current !== key) return;
    if (pularGravacao.current) {
      pularGravacao.current = false;
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(valor));
    } catch {
      /* limite de espaço */
    }
  }, [key, valor]);

  return [valor, setValor];
}
