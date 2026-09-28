import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Estado salvo automaticamente no localStorage (chave deve começar com "saga."
 * para acompanhar o projeto ativo). Carrega após a hidratação para evitar divergência SSR.
 */
export function usePersistedState<T>(key: string, inicial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] {
  const [valor, setValor] = useState<T>(inicial);
  const carregado = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw != null) setValor(JSON.parse(raw) as T);
    } catch {
      /* ignora */
    }
    carregado.current = true;
  }, [key]);

  useEffect(() => {
    if (!carregado.current) return;
    try {
      localStorage.setItem(key, JSON.stringify(valor));
    } catch {
      /* limite de espaço */
    }
  }, [key, valor]);

  return [valor, setValor];
}
