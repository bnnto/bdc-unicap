import { createContext, useContext } from "react";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { Role } from "../../lib/roles";

/**
 * Estado de sessão + papel compartilhado (issue [S1-1]).
 * O contexto tem default "não autenticado" — fora de um AuthProvider
 * (testes, Storybook) os consumidores recebem esse estado, sem lançar erro,
 * seguindo o padrão dos contextos do próprio @convex-dev/auth.
 */
export type AuthState = {
  /** true enquanto a sessão/papel ainda está sendo resolvido. */
  isLoading: boolean;
  isAuthenticated: boolean;
  user: Doc<"users"> | null;
  role: Role | null;
};

export const AuthStateContext = createContext<AuthState>({
  isLoading: true,
  isAuthenticated: false,
  user: null,
  role: null,
});

/** Estado de sessão + papel do usuário autenticado. */
export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
