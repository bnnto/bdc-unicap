import { useRef } from "react";

/** Mantém o último valor válido enquanto os novos argumentos carregam. */
export function useStableQuery<T>(value: T | undefined): {
  data: T | undefined;
  stale: boolean;
} {
  const last = useRef<T | undefined>(undefined);
  if (value !== undefined) last.current = value;
  return {
    data: value ?? last.current,
    stale: value === undefined && last.current !== undefined,
  };
}