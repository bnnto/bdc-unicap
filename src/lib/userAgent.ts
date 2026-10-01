/**
 * [UX_REFINEMENT] Etapa 4 — humanização do User-Agent das sessões
 * recentes: "Chrome no Windows", "Safari no Mobile"… A UI nunca exibe
 * IDs criptográficos; quando o User-Agent não é reconhecido (ou não
 * existe), devolve `null` e a UI mostra o fallback "Sessão ativa em
 * outro dispositivo".
 */

/**
 * Rótulo amigável `<Navegador> no <Sistema>` ou `null` quando o
 * User-Agent não é reconhecido.
 *
 * Ordem das checagens importa: Edg/ antes de Chrome (ambos contêm
 * "Chrome"), Android antes de Linux e iOS antes de macOS (iPhone
 * declara "Mac OS X").
 */
export function describeUserAgent(
  userAgent: string | null | undefined,
): string | null {
  if (typeof userAgent !== "string" || userAgent.trim().length === 0) {
    return null;
  }
  const ua = userAgent;

  let browser: string | null = null;
  if (/Edg\//.test(ua)) browser = "Edge";
  else if (/Firefox\//.test(ua)) browser = "Firefox";
  else if (/Chrome\//.test(ua)) browser = "Chrome";
  else if (/Safari\//.test(ua)) browser = "Safari";
  if (browser === null) return null;

  let os: string | null = null;
  if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "Mobile";
  else if (/Windows/.test(ua)) os = "Windows";
  else if (/Mac OS X/.test(ua)) os = "macOS";
  else if (/Linux/.test(ua)) os = "Linux";
  if (os === null) return null;

  return `${browser} no ${os}`;
}
