import { useMemo, type ReactNode } from "react";
import { ConvexAuthProvider, useConvexAuth } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import type { ConvexReactClient } from "convex/react";
import type { Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { AuthStateContext, type AuthState } from "./authContext";

/**
 * Camada de autenticação/papéis (issue [S1-1]).
 * - ConvexAuthProvider gerencia tokens/sessão (Convex Auth).
 * - `me` resolve o documento `users` reativamente (papel, nome, ativo).
 * O hook de consumo (useAuthState) vive em authContext.ts para que este
 * arquivo exporte apenas componentes (regra react-refresh/only-export-components).
 */
function AuthStateProvider({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();
  const user: Doc<"users"> | null | undefined = useQuery(
    api.authHelpers.me,
    isAuthenticated ? {} : "skip",
  );

  const value = useMemo<AuthState>(
    () => ({
      isLoading: isLoading || (isAuthenticated && user === undefined),
      isAuthenticated,
      user: user ?? null,
      role: user?.role ?? null,
    }),
    [isLoading, isAuthenticated, user],
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
