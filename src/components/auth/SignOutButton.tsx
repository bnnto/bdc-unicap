import { useAuthActions } from "@convex-dev/auth/react";
import { LogOut } from "lucide-react";

/**
 * Botão de encerrar sessão (issue [S1-1]).
 * Componente separado para que o acesso ao ConvexAuthActionsContext
 * (via useAuthActions) só aconteça em árvores autenticadas — renderizado
 * apenas quando `isAuthenticated` é verdadeiro.
 */
export function SignOutButton() {
  const { signOut } = useAuthActions();

  return (
    <button
      type="button"
      onClick={() => void signOut()}
      className="inline-flex items-center gap-2 rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary transition-all duration-200 ease-in-out hover:-translate-y-px hover:bg-[#FDF2F4] hover:shadow-sm active:translate-y-0 active:scale-[0.98]"
    >
      <LogOut className="h-4 w-4" aria-hidden="true" />
      Sair
    </button>
  );
}
