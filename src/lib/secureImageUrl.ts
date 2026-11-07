/**
 * [HARDENING] Validação mínima de segurança de imagem.
 *
 * - Apenas URLs absolutas que começam com `https://` são consideradas válidas.
 * - O `referrerPolicy="no-referrer"` (aplicado no `<img>`) evita que a imagem
 *   envie referrer ao carregar.
 * - Se a imagem falhar no carregamento (URL http, inválido, redirecionamento,
 *   ou qualquer outro erro), o fallback é renderizado no componente; essa função
 *   apenas decide se um URL é seguro para uso como `src`.
 */
export function safeImageUrl(url: string | null | undefined): url is string {
  return typeof url === "string" && /^https:\/\//i.test(url.trim());
}
