import { PASSWORD_RESET_PATH } from "./passwordReset";

/**
 * [PERFIL_E_LGPD] Navegação SPA sem router: o AuthGate do App observa a
 * rota pública via `popstate`. `navigateTo` troca a URL com History API
 * e despacha um `popstate` sintético para que a árvore React reaja —
 * assim qualquer componente (shell, dropdown, modal) navega sem props
 * de roteamento nem contexto extra.
 */
export function navigateTo(path: string): void {
  if (window.location.pathname === path) return;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * [ONBOARDING_RECOVERY] Rota pública de recuperação de senha — a fonte
 * única do caminho é `PASSWORD_RESET_PATH` (lib/passwordReset), a mesma
 * usada no link do e-mail; aqui fica só o predicado de rota do AuthGate.
 */
export function isPasswordResetPath(pathname: string): boolean {
  return (
    pathname === PASSWORD_RESET_PATH ||
    pathname.startsWith(`${PASSWORD_RESET_PATH}/`)
  );
}

/**
 * [RECRUITER_VIEW_PROFILE] Rota da página dedicada de perfil do
 * candidato (recrutador/gestor). Única fonte de verdade do caminho —
 * usada pelo Kanban, pelo Banco de Talentos e pelo AuthGate (App).
 */
export function candidateProfilePath(studentId: string): string {
  return `/recrutador/candidato/${encodeURIComponent(studentId)}`;
}

/**
 * [RECRUITER_VIEW_PROFILE] Extrai o studentId da rota
 * `/recrutador/candidato/:studentId`. Retorna null quando a rota não
 * corresponde ou quando o id decodificado não tem formato de id do
 * Convex (só letras/dígitos/hífen/underscore) — barra qualquer tentativa
 * de injeção de caminho (ex.: `%2e%2e%2f`) antes de chegar à query.
 */
export function parseCandidateProfilePath(path: string): string | null {
  const match = /^\/recrutador\/candidato\/([^/]+)$/.exec(path);
  if (match === null) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(match[1] ?? "");
  } catch {
    return null;
  }
  return /^[a-zA-Z0-9_-]+$/.test(decoded) ? decoded : null;
}
