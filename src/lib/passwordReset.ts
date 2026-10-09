/**
 * [ONBOARDING_RECOVERY] Regras PURAS do fluxo "Esqueci minha senha":
 * rota, validade do token e conteúdo do e-mail de recuperação.
 *
 * Sem I/O — a action `emails.sendPasswordResetEmail` só compõe e
 * transporta (mesmo padrão de src/lib/emailNotify.ts, TDD).
 */

/** Rota da página que lê `?token=` da URL e troca a senha. */
export const PASSWORD_RESET_PATH = "/recuperar-senha";

/** Validade do token de recuperação: 30 minutos. */
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

/**
 * Link do e-mail: `<base>/recuperar-senha?token=<token>` — a base aceita
 * com ou sem barra final e o token é codificado (nunca quebra a URL).
 */
export function buildPasswordResetLink(baseUrl: string, token: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${PASSWORD_RESET_PATH}?token=${encodeURIComponent(token)}`;
}

/** Conteúdo do e-mail de recuperação (assunto, texto e HTML). */
export function buildPasswordResetEmail(args: { link: string }): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = "Recuperação de senha — Portal de Carreiras UNICAP";
  const text = [
    "Olá!",
    "",
    "Recebemos um pedido para redefinir a sua senha no Portal de Carreiras UNICAP.",
    "",
    `Para escolher uma nova senha, abra este link (válido por 30 minutos): ${args.link}`,
    "",
    "Se não foi você, ignore este e-mail — a sua senha atual continua a valer.",
  ].join("\n");
  const html = [
    "<p>Olá!</p>",
    "<p>Recebemos um pedido para redefinir a sua senha no <strong>Portal de Carreiras UNICAP</strong>.</p>",
    `<p><a href="${args.link}">Clique aqui para escolher uma nova senha</a> (válido por 30 minutos).</p>`,
    `<p>Ou copie e cole no navegador: ${args.link}</p>`,
    "<p>Se não foi você, ignore este e-mail — a sua senha atual continua a valer.</p>",
  ].join("\n");
  return { subject, text, html };
}
