/**
 * [MODERACAO_RECRUTADOR] Validação pura do LinkedIn exigido no cadastro
 * público do recrutador. Compartilhada entre a UI e o servidor.
 */
type LinkedinValidation =
  | { ok: true; normalized: string }
  | { ok: false; error: string };

export function validateRecruiterLinkedin(raw: unknown): LinkedinValidation {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return { ok: false, error: "Informe o seu LinkedIn." };
  }
  const value = raw.trim();
  if (value.length > 300) {
    return { ok: false, error: "URL do LinkedIn muito longa." };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return {
      ok: false,
      error: "URL do LinkedIn inválida. Use https://www.linkedin.com/in/seu-perfil",
    };
  }
  const host = url.hostname.toLowerCase();
  const isLinkedin = host === "linkedin.com" || host.endsWith(".linkedin.com");
  if (url.protocol !== "https:" || !isLinkedin) {
    return {
      ok: false,
      error: "O LinkedIn deve ser um link https://www.linkedin.com/...",
    };
  }
  if (url.pathname.replace(/\//g, "").length === 0) {
    return { ok: false, error: "Informe o link do seu perfil no LinkedIn." };
  }
  return { ok: true, normalized: url.toString() };
}