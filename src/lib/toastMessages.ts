/**
 * [UX_REFINEMENT] Etapa 1 — tradução de erros de servidor para mensagens
 * amigáveis exibidas nos Toasts.
 *
 * Nenhuma mensagem crua (`[CONVEX A(auth:signIn)]…`, stack traces,
 * TypeErrors) chega ao utilizador: erros internos caem num fallback
 * genérico; erros já humanos em português são repassados intactos.
 */

/** Fallback seguro — nunca expor detalhes internos ao utilizador. */
export const GENERIC_ERROR = "Algo deu errado. Tente novamente.";

/** Mensagens canônicas (fonte única de verdade das traduções). */
const CREDENTIALS = "E-mail ou palavra-passe incorretos.";
const DUPLICATE_ACCOUNT = "Já existe uma conta com este e-mail.";
const DEACTIVATED_ACCOUNT = "Conta desativada. Procure a coordenação.";
const SESSION_EXPIRED = "Sua sessão expirou. Entre novamente.";
const CONSENT_MISSING =
  "Aceite o Termo de Consentimento LGPD vigente para continuar.";
const OFFLINE =
  "Sem conexão com o servidor. Verifique sua internet e tente novamente.";

/**
 * Converte o valor capturado no `catch` em string legível, removendo o
 * prefixo `[CONVEX …]`, o resto de tags `[…]`, `Uncaught (in promise)`,
 * o prefixo `Error:` e o stack (linhas `    at …`).
 */
function extractMessage(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return null; // undefined/null/números/objetos → fallback genérico
}

function clean(raw: string): string {
  let msg = raw;
  // Stack trace: só a primeira linha sobrevive.
  const firstLine = msg.split(/\n\s+at\s+/)[0];
  if (firstLine !== undefined) msg = firstLine;
  // Prefixos de instrumentação: [CONVEX …], [Request Failed]…
  msg = msg.replace(/^\s*(\[[^\]]*\]\s*)+/, "");
  msg = msg.replace(/^Uncaught \(in promise\)\s+/, "");
  // "Error: " / "TypeError: " etc.
  msg = msg.replace(/^[A-Za-z]*Error:\s*/, "");
  return msg.trim();
}

/**
 * Erro de servidor → mensagem amigável em português para o Toast.
 *
 * Ordem: traduções específicas (credenciais, conta, sessão, LGPD,
 * rede) antes de detectar erro interno — assim `TypeError: Failed to
 * fetch` vira orientação de conexão, não o fallback.
 */
export function friendlyErrorMessage(error: unknown): string {
  const raw = extractMessage(error);
  if (raw === null) return GENERIC_ERROR;
  const msg = clean(raw);
  if (msg.length === 0) return GENERIC_ERROR;

  if (
    /e[\s-]*mail ou (senha|palavra-passe) incorretos/i.test(msg) ||
    /credenciais (inválidas|incorretas)/i.test(msg) ||
    /invalid credentials/i.test(msg) ||
    /incorrect email or password/i.test(msg)
  ) {
    return CREDENTIALS;
  }
  if (
    /já existe (uma )?conta com este e-?mail/i.test(msg) ||
    /account already exists/i.test(msg) ||
    /e-?mail já (cadastrado|em uso)/i.test(msg)
  ) {
    return DUPLICATE_ACCOUNT;
  }
  if (/conta desativada/i.test(msg)) return DEACTIVATED_ACCOUNT;
  if (/(sessão expirada|session expired)/i.test(msg)) return SESSION_EXPIRED;
  if (/termo de consentimento/i.test(msg)) return CONSENT_MISSING;
  if (
    /(failed to fetch|fetch failed|network error|erro de rede|sem conexão|internet)/i.test(
      msg,
    )
  ) {
    return OFFLINE;
  }

  // Erro interno (TypeError, handler do Convex, stack residual…):
  // nunca expor detalhes ao utilizador.
  if (
    /(TypeError|ReferenceError|SyntaxError|RangeError):/i.test(msg) ||
    /handler failed/i.test(msg) ||
    /cannot read propert/i.test(msg) ||
    /is not a function/i.test(msg) ||
    /undefined is not/i.test(msg) ||
    /\[CONVEX/i.test(msg) ||
    /^\s*at\s/.test(msg)
  ) {
    return GENERIC_ERROR;
  }

  // Mensagem já humana em português (validações de campo etc.):
  // repassar intacta.
  return msg;
}
