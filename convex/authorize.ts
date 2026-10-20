import { ConvexError } from "convex/values";
import type { GenericActionCtxWithAuthConfig } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel.js";
import { internal } from "./_generated/api.js";
import { hashPassword, verifyPassword } from "./password"; // runtime padrão (Web Crypto)
import {
  isValidEmail,
  normalizeEmail,
  passwordRules,
  PASSWORD_MAX_LENGTH,
  type PasswordRule,
} from "../src/lib/auth";
import { isPublicSignupRole } from "../src/lib/roles";
import { CURRENT_TERM_VERSION } from "./consentTerms";
import { validateRecruiterLinkedin } from "../src/lib/recruiterSignup";

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
  linkedinUrl?: string;
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
    linkedinUrl:
      typeof c.linkedinUrl === "string" 
      ? c.linkedinUrl 
      : undefined,
  };
}

/**
 * Hash falso, calculado uma vez por instância: quando o e-mail não existe,
 * ainda gastamos o mesmo tempo de um PBKDF2 real. Assim o tempo de resposta
 * não revela se a conta existe.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword("senha-falsa-para-igualar-o-tempo");
  return dummyHashPromise;
}

/**
 * Lógica de authorize do provider ConvexCredentials (issue [S1-1]).
 *
 * - signUp: cria `users` + conta de credenciais com hash PBKDF2, senha forte
 *   e papel validado.
 * - signIn: limita tentativas por e-mail, recupera a conta, verifica a senha
 *   e exige usuário ativo.
 *
 * Erros de negócio são lançados como Error com mensagem clara — o Convex Auth
 * propaga a mensagem ao cliente via `signIn` rejeitado.
 */
export const authorizeConfig = {
  id: "credentials-email",
  authorize: async (rawCredentials: unknown, ctx: AuthorizeCtx) => {
    const credentials = parseCredentials(rawCredentials);
    if (credentials === null) {
      throw new ConvexError("E-mail e senha são obrigatórios.");
    }
    const email = normalizeEmail(credentials.email);
    const password = credentials.password;
    if (!isValidEmail(email)) {
      throw new ConvexError("E-mail inválido.");
    }
    if (password.length < 8) {
      throw new ConvexError("A senha deve ter pelo menos 8 caracteres.");
    }
    // Teto: evita que uma senha gigante force o servidor a gastar CPU no hash.
    if (password.length > PASSWORD_MAX_LENGTH) {
      throw new ConvexError(
        `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
      );
    }

    const flow = credentials.flow ?? "signIn";

    if (flow === "signUp") {
      const name = credentials.name?.trim() ?? "";
      const role = credentials.role;
      const consentTermVersion = credentials.consentTermVersion;
      if (name.length < 3) {
        throw new ConvexError("Informe seu nome completo.");
      }
      // Senha forte SÓ no cadastro (no login, contas antigas continuam entrando).
      const failed = passwordRules(password, { email, name }).find(
        (r: PasswordRule) => !r.ok,
      );
      if (failed !== undefined) {
        throw new ConvexError(`Senha fraca: ${failed.label.toLowerCase()}.`);
      }
      // [REFACTOR_GESTOR] Etapa 3 — o público só cria aluno/recrutador;
      // gestor é provisionado manualmente pela coordenação (Convex
      // Dashboard). A checagem é NO SERVIDOR, não apenas na UI.
      if (!isPublicSignupRole(role)) {
        throw new ConvexError(
          "Cadastro público disponível apenas para aluno e recrutador.",
        );
      }
      // R7 (issue [S1-2]): cadastro sem aceite do termo vigente é bloqueado
      // no servidor — a checkbox da UI é reforço, não a regra.
      if (
        consentTermVersion === undefined ||
        consentTermVersion !== CURRENT_TERM_VERSION
      ) {
        throw new ConvexError(
          "É necessário aceitar o Termo de Consentimento LGPD vigente.",
        );
      }

      let linkedinUrl: string | undefined;
      if (role === "recrutador") {
        const check = validateRecruiterLinkedin(credentials.linkedinUrl);
        if (!check.ok) throw new ConvexError(check.error);
        linkedinUrl = check.normalized;
      }

      const existing = await ctx.runQuery(internal.authHelpers.lookupByEmail, {
        email,
      });
      if (existing !== null) {
        throw new ConvexError("Já existe conta com este e-mail.");
      }
      const secret = await hashPassword(password);
      const userId = await ctx.runMutation(internal.authHelpers.createUser, {
        email,
        name,
        role,
        secret,
        consentTermVersion,
        // O authorize só roda no cadastro público: recrutador nasce pendente.
        publicSignup: true,
        linkedinUrl,
      });
      return { userId };
    }

    // signIn — a tentativa é contada ANTES de verificar a senha.
    const attempt = await ctx.runMutation(
      internal.authHelpers.beginLoginAttempt,
      { email },
    );
    if (!attempt.allowed) {
      const minutes = Math.max(1, Math.ceil(attempt.retryAfterMs / 60_000));
      throw new ConvexError(
        `Muitas tentativas de login. Tente novamente em ${minutes} minuto(s).`,
      );
    }

    const account = await ctx.runQuery(internal.authHelpers.findAccount, {
      email,
    });
    if (account === null) {
      // Mesmo custo de CPU de uma conta real (anti enumeração por tempo).
      await verifyPassword(password, await getDummyHash());
      throw new ConvexError("E-mail ou senha incorretos.");
    }
    const ok = await verifyPassword(password, account.secret);
    if (!ok) {
      throw new ConvexError("E-mail ou senha incorretos.");
    }
    await ctx.runMutation(internal.authHelpers.clearLoginAttempts, { email });
    if (!account.active) {
      throw new ConvexError("Conta desativada. Procure a coordenação.");
    }
    return { userId: account.userId };
  },
};