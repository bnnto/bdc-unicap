import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { authorizeConfig } from "./authorize";

/**
 * Configuração do Convex Auth (issue [S1-1]).
 * Provider de credenciais próprio (e-mail + senha) com papel escolhido no
 * cadastro — usamos ConvexCredentials em vez do provider Password padrão
 * para controlar papéis (aluno, recrutador, gestor) e status ativo
 * no mesmo fluxo de autenticação.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [ConvexCredentials(authorizeConfig)],
});
