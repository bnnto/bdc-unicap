import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * [S8-4] Error boundary da aplicação (CA 1 — disponibilidade/robustez).
 *
 * Um erro de renderização não derruba o portal inteiro: o limite captura,
 * registra via `onError` (observação de produção, CA 2) e exibe fallback
 * acessível (role=alert) com botão "Tentar novamente". A recuperação
 * também é reativa: qualquer mudança em `resetKeys` limpa o estado de erro.
 */
type ErrorBoundaryProps = {
  children: ReactNode;
  /** Nome do limite — identifica a região no fallback e no registro. */
  label: string;
  /** Registro do erro (telemetria/observação do deploy). */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Mudou qualquer chave ⇒ estado de erro é limpo (recuperação). */
  resetKeys?: ReadonlyArray<unknown>;
};

type ErrorBoundaryState = { error: Error | null };

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // [S8-4] CA 2 — o erro capturado é entregue à monitoração do deploy.
    this.props.onError?.(error, info);
  }

  override componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.error === null) return;
    const prev = prevProps.resetKeys ?? [];
    const next = this.props.resetKeys ?? [];
    const changed =
      prev.length !== next.length ||
      next.some((key, index) => !Object.is(key, prev[index]));
    if (changed) {
      this.setState({ error: null });
    }
  }

  private handleRetry = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return (
        <div
          role="alert"
          className="mx-auto my-10 max-w-xl rounded-lg border border-danger bg-white p-6 text-center shadow-level1"
        >
          <h2 className="font-serif text-xl font-bold text-danger">
            Algo inesperado aconteceu
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            A região “{this.props.label}” não pôde ser exibida. O registro do
            erro foi enviado para a equipe — nenhuma ação sua é necessária.
          </p>
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-4 rounded border-transparent bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
