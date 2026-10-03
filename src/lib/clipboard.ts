/**
 * [QUICK_WIN_RECRUITER] Cópia rápida para a área de transferência —
 * o recrutador copia E-mail/Telefone do candidato com 1 clique.
 *
 * Função pequena e defensiva: nunca lança. Resolve `false` quando a API
 * Clipboard não existe (contexto inseguro/antigo) ou quando o navegador
 * nega a permissão — a UI decide o Toast (sucesso ou erro amigável).
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    const clipboard = navigator.clipboard;
    if (clipboard === undefined || typeof clipboard.writeText !== "function") {
      return false;
    }
    await clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
