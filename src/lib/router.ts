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
