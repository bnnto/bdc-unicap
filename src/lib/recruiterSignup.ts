/**
 * [MODERACAO_RECRUTADOR] Validação pura do LinkedIn exigido no cadastro
 * público do recrutador. Compartilhada entre a UI e o servidor.
 */
type LinkedinValidation =
  { ok: true; normalized: string } | { ok: false; error: string };

type WebsiteValidation =
  { ok: true; normalized: string | undefined } | { ok: false; error: string };

const WEBSITE_ERROR =
  "Informe um site válido (ex.: https://suaempresa.com.br).";

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
      error:
        "URL do LinkedIn inválida. Use https://www.linkedin.com/in/seu-perfil",
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

export function validateRecruiterWebsite(raw: unknown): WebsiteValidation {
  if (raw === undefined || raw === null)
    return { ok: true, normalized: undefined };
  if (typeof raw !== "string") return { ok: false, error: WEBSITE_ERROR };
  const text = raw.trim();
  if (text.length === 0) return { ok: true, normalized: undefined };
  if (text.length > 200 || /\s/.test(text)) {
    return { ok: false, error: WEBSITE_ERROR };
  }
  const withProtocol = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    return { ok: false, error: WEBSITE_ERROR };
  }
  const host = url.hostname.toLowerCase();
  const looksLikeDomain = /^(?=.{4,253}$)([a-z0-9-]+\.)+[a-z]{2,}$/.test(host);
  if (!looksLikeDomain || url.username !== "" || url.password !== "") {
    return { ok: false, error: WEBSITE_ERROR };
  }
  return {
    ok: true,
    normalized: `https://${host}${url.pathname.replace(/\/+$/, "")}`,
  };
}
