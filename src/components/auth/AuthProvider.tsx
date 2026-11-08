import { useMemo, type ReactNode } from "react";
import { ConvexAuthProvider, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import type { ConvexReactClient } from "convex/react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { isRole } from "../../lib/roles";
import { AuthStateContext, type AuthState } from "./authContext";

/**
 * Camada de autenticação/papéis (issue [S1-1]).
 * - ConvexAuthProvider gerencia tokens/sessão (Convex Auth).
 * - `me` resolve o documento `users` reativamente (papel, nome, ativo).
 * O hook de consumo (useAuthState) vive em authContext.ts para que este
 * arquivo exporte apenas componentes (regra react-refresh/only-export-components).
 *
 * [HARDENING] O papel do backend é validado localmente. Se o servidor
 * retornar um valor que não é um dos papéis oficiais (ROLES), tratamos o
 * usuário como não autenticado/isLoading. Isso evita que um valor
 * inesperado/inválido seja confiável no frontend, mantendo a compatibilidade
 * com o servidor e sem descartar dados legítimos.
 */
function AuthStateProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user: Doc<"users"> | null | undefined = useQuery(
    api.authHelpers.me,
    isAuthenticated ? {} : "skip",
  );

  // Se o servidor devolveu um objeto de usuário com um papel desconhecido,
  // tratamos como usuário inválido: continua em loading até que a sessão
  // seja reconfigurada ou o servidor retorne um papel válido.
  const userRoleIsValid = user ? isRole(user.role) : true;

  const value = useMemo<AuthState>(
    () => ({
      isLoading:
        isLoading ||
        (isAuthenticated && user === undefined) ||
        !userRoleIsValid,
      isAuthenticated: isAuthenticated && userRoleIsValid,
      user: user ?? null,
      role: userRoleIsValid ? (user?.role ?? null) : null,
    }),
    [isLoading, isAuthenticated, user, userRoleIsValid],
  );

  return (
    <AuthStateContext.Provider value={value}>
      {children}
    </AuthStateContext.Provider>
  );
}

export function AuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  return (
    <ConvexAuthProvider client={client}>
      <AuthStateProvider>{children}</AuthStateProvider>
    </ConvexAuthProvider>
  );
}
