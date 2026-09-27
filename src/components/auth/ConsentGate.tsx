import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useAuthState } from "./authContext";
import { useState, type ReactNode } from "react";
import { CONSENT_TERM, CONSENT_TERM_VERSION } from "../../lib/consentTerm";

/**
 * Bloqueio de uso do portal sem aceite vigente (issue [S1-2], R7).
 * Usuário autenticado sem aceite da versão corrente vê apenas o modal de
 * consentimento — nenhuma funcionalidade é renderizada até aceitar.
 * A checagem é reativa via `consents.myStatus` (autoridade: servidor).
 */
export function ConsentGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthState();
  const status = useQuery(api.consents.myStatus, isAuthenticated ? {} : "skip");

  // Visitantes e carga inicial passam direto (AuthPage/ skeletons cuidam deles).
  if (!isAuthenticated || isLoading || status === undefined) {
    return <>{children}</>;
  }

  // Usuário cujo documento ainda não foi resolvido (user null → AuthPage).
  if (!status.authenticated) return <>{children}</>;

  if (status.active) return <>{children}</>;

  return <ConsentRequiredScreen />;
}

function ConsentRequiredScreen() {
  const accept = useMutation(api.consents.acceptCurrentTerm);
  /**
   * [UX-P2] H1-3/H9-3 — o aceite dá feedback de progresso e recupera
   * falhas com alerta acessível (nenhum erro silencioso).
   */
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setError(null);
    setPending(true);
    try {
      await accept({});
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível registrar o aceite agora. Tente novamente.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-2xl">
        <header className="mb-6 text-center">
          <p className="font-serif text-xs uppercase tracking-widest text-secondary">
            Universidade Católica de Pernambuco
          </p>
          <h1 className="mt-2 font-serif text-2xl font-bold text-primary">
            Termo de Consentimento LGPD
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Para usar o Portal de Carreiras e o Setor de Extensão é necessário
            aceitar a versão vigente do termo ({CONSENT_TERM_VERSION}).
          </p>
        </header>

        <div
          className="rounded-lg border border-slate-200 bg-white shadow-level2"
          role="region"
          aria-label="Texto do termo de consentimento"
        >
          <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap px-6 py-4 font-sans text-sm leading-relaxed text-slate-700">
            {CONSENT_TERM}
          </pre>
        </div>

        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => void handleAccept()}
            className="rounded bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#520F1D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Registrando aceite…"
              : `Li e aceito o termo (${CONSENT_TERM_VERSION})`}
          </button>
          {error !== null ? (
            <p
              role="alert"
              className="rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}
          <p className="text-xs text-slate-500">
            O aceite é registrado com versão, data e hora (trilha de auditoria).
            Você pode revogá-lo a qualquer momento pelo Encarregado (DPO).
          </p>
        </div>
      </div>
    </div>
  );
}
