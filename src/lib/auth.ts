/**
 * Helpers puros de autenticação (issue [S1-1]).
 * Sem I/O — testáveis isoladamente (CEREBRO.md §6.2).
 * Hash de senha vive em `src/lib/password.ts` (node:crypto, uso exclusivo do backend).
 */

/** Normaliza o e-mail para busca case-insensitive (único no sistema). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validação simples de formato de e-mail (sem regex catastrófica). */
export function isValidEmail(email: string): boolean {
  const normalized = normalizeEmail(email);
  if (normalized.length === 0 || /\s/.test(normalized)) return false;
  const at = normalized.lastIndexOf("@");
  if (at <= 0 || at === normalized.length - 1) return false;
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (domain.includes("@") || !domain.includes(".")) return false;
  return local.length > 0 && domain.split(".").every((p) => p.length > 0);
}

const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
  "12345678", "123456789", "1234567890", "password", "senha123",
  "qwertyui", "qwerty123", "abc12345", "11111111", "iloveyou",
  "admin123", "unicap123", "mudar123",
]);

export type PasswordRule = { id: string; label: string; ok: boolean };

export function passwordRules(
  password: string,
  ctx: { email?: string; name?: string } = {},
): PasswordRule[] {
  const lower = password.toLowerCase();
  const emailUser = (ctx.email ?? "").split("@")[0]?.toLowerCase() ?? "";
  return [
    {
      id: "length",
      label: `Pelo menos ${PASSWORD_MIN_LENGTH} caracteres`,
      ok: password.length >= PASSWORD_MIN_LENGTH,
    },
    { id: "lower", label: "Uma letra minúscula", ok: /[a-z]/.test(password) },
    { id: "upper", label: "Uma letra maiúscula", ok: /[A-Z]/.test(password) },
    { id: "digit", label: "Um número", ok: /\d/.test(password) },
    {
      id: "common",
      label: "Não pode ser uma senha comum",
      ok: !COMMON_PASSWORDS.has(lower) && !/^(.)\1+$/.test(password),
    },
    {
      id: "personal",
      label: "Não pode conter seu e-mail",
      ok: emailUser.length < 4 || !lower.includes(emailUser),
    },
  ];
}