import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel.js";
import { api, internal } from "./_generated/api.js";
import { hashPassword, verifyPassword } from "./password"; // runtime padrão (Web Crypto)
import { isValidEmail, normalizeEmail } from "../src/lib/auth";
import { isPublicSignupRole } from "../src/lib/roles";
import { CURRENT_TERM_VERSION } from "./consentTerms";

type AuthorizeCtx = GenericActionCtxWithAuthConfig<DataModel>;

interface Credentials {
  email: string;
  password: string;
  /** Fluxo de cadastro (opcional): nome e papel do novo usuário. */
  name?: string;
  role?: string;
  flow?: "signUp" | "signIn";
  /** R7 (issue [S1-2]): versão do termo aceita no cadastro. */
  consentTermVersion?: string;
}

function parseCredentials(raw: unknown): Credentials | null {
  if (typeof raw !== "object" || raw === null) return null;
  const c = raw as Record<string, unknown>;
  if (typeof c.email !== "string" || typeof c.password !== "string") {
    return null;
  }
  return {
    email: c.email,
    password: c.password,
    name: typeof c.name === "string" ? c.name : undefined,
    role: typeof c.role === "string" ? c.role : undefined,
    flow: c.flow === "signUp" ? "signUp" : "signIn",
    consentTermVersion:
      typeof c.consentTermVersion === "string"
        ? c.consentTermVersion
        : undefined,
  };
}

/**
 * Lógica de authorize do provider ConvexCredentials (issue [S1-1]).
 *
 * - signUp: cria `users` + conta de credenciais com hash scrypt e papel validado.
 * - signIn: recupera a conta, verifica a senha e exige usuário ativo.
 *
 * Erros de negócio são lançados como Error com mensagem clara — o Convex Auth
 * propaga a mensagem ao cliente via `signIn` rejeitado.
 */
export const authorizeConfig = {
  id: "credentials-email",
  authorize: async (rawCredentials: unknown, ctx: AuthorizeCtx) => {
    const credentials = parseCredentials(rawCredentials);
    if (credentials === null) {
      throw new Error("E-mail e senha são obrigatórios.");
    }
    const email = normalizeEmail(credentials.email);
    const password = credentials.password;
    if (!isValidEmail(email)) {
      throw new Error("E-mail inválido.");
    }
    if (password.length < 8) {
      throw new Error("A senha deve ter pelo menos 8 caracteres.");
    }

    const flow = credentials.flow ?? "signIn";

    if (flow === "signUp") {
      const name = credentials.name?.trim() ?? "";
      const role = credentials.role;
      const consentTermVersion = credentials.consentTermVersion;
      if (name.length < 3) {
        throw new Error("Informe seu nome completo.");
      }
      // [REFACTOR_GESTOR] Etapa 3 — o público só cria aluno/recrutador;
      // gestor é provisionado manualmente pela coordenação (Convex
      // Dashboard). A checagem é NO SERVIDOR, não apenas na UI.
      if (!isPublicSignupRole(role)) {
        throw new Error(
          "Cadastro público disponível apenas para aluno e recrutador.",
        );
      }
      // R7 (issue [S1-2]): cadastro sem aceite do termo vigente é bloqueado
      // no servidor — a checkbox da UI é reforço, não a regra.
      if (
        consentTermVersion === undefined ||
        consentTermVersion !== CURRENT_TERM_VERSION
      ) {
        throw new Error(
          "É necessário aceitar o Termo de Consentimento LGPD vigente.",
        );
      }

      const existing = await ctx.runQuery(api.authHelpers.lookupByEmail, {
        email,
      });
      if (existing !== null) {
        throw new Error("Já existe conta com este e-mail.");
      }
      const secret = await hashPassword(password);
      const userId = await ctx.runMutation(internal.authHelpers.createUser, {
        email,
        name,
        role,
        secret,
        consentTermVersion,
      });
      return { userId };
    }

    // signIn
    const account = await ctx.runQuery(internal.authHelpers.findAccount, {
      email,
    });
    if (account === null) {
      throw new Error("E-mail ou senha incorretos.");
    }
    const ok = await verifyPassword(password, account.secret);
    if (!ok) {
      throw new Error("E-mail ou senha incorretos.");
    }
    if (!account.active) {
      throw new Error("Conta desativada. Procure a coordenação.");
    }
    return { userId: account.userId };
  },
};
