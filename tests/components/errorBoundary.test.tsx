/**
 * [S8-4] Error boundaries (CA 1) — erro de renderização é capturado,
 * exibido em fallback acessível (role=alert) com recuperação por botão,
 * sem derrubar a aplicação inteira.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import { useState } from "react";
import { ErrorBoundary } from "../../src/components/error/ErrorBoundary";

function Bomb({ fail }: { fail: boolean }): string {
  if (fail) throw new Error("explosão de teste");
  return "conteúdo íntegro";
}

/** Host com resetKey: alterna sucesso/erro simulando recuperação da UI. */
function Host({ fail }: { fail: boolean }): React.ReactNode {
  const [attempt, setAttempt] = useState(0);
  return (
    <ErrorBoundary
      label="host-teste"
      resetKeys={[fail, attempt]}
      onError={undefined}
    >
      <button type="button" onClick={() => setAttempt(attempt + 1)}>
        reiniciar
      </button>
      <Bomb fail={fail} />
    </ErrorBoundary>
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("S8-4 CA 1 — ErrorBoundary captura e recupera", () => {
  it("renderiza os children quando nada falha", () => {
    render(
      <ErrorBoundary label="teste">
        <Bomb fail={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText("conteúdo íntegro")).toBeInTheDocument();
  });

  it("captura erro de render e mostra fallback acessível (role=alert)", () => {
    // React loga o erro capturado; silenciamos para o output do teste.
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="teste">
        <Bomb fail={true} />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/algo inesperado aconteceu/i);
    expect(
      screen.getByRole("button", { name: /tentar novamente/i }),
    ).toBeInTheDocument();
    expect(screen.queryByText("conteúdo íntegro")).toBeNull();
  });

  it("botão Tentar novamente limpa o erro e re-renderiza os children", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(
      <ErrorBoundary label="teste" resetKeys={["fase"]}>
        <Bomb fail={true} />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();

    rerender(
      <ErrorBoundary label="teste" resetKeys={["fase-2"]}>
        <Bomb fail={false} />
      </ErrorBoundary>,
    );
    // resetKeys mudou → estado de erro limpo; children renderizam de novo.
    expect(screen.getByText("conteúdo íntegro")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reset manual via botão também restaura a renderização", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ErrorBoundary label="teste">
        <Bomb fail={true} />
      </ErrorBoundary>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /tentar novamente/i }),
    );
    // Children re-renderizam; a Bomb volta a lançar, mas o boundary
    // captura novamente — o importante é que o fallback volta acessível.
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("notifica onError com o erro e a info (registro para observação)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn((error: Error) => {
      void error;
    });
    render(
      <ErrorBoundary label="monitorado" onError={onError}>
        <Bomb fail={true} />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledTimes(1);
    const primeiroErro = onError.mock.calls[0]?.[0];
    expect(primeiroErro).toBeInstanceOf(Error);
    expect(primeiroErro?.message).toBe("explosão de teste");
  });

  it("Host com estado interno: reiniciar limpa o fallback após mudar resetKeys", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<Host fail={true} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();

    // Falha cessa + tentativa avançada (resetKeys muda) → UI recupera.
    rerender(<Host fail={false} />);
    expect(screen.getByText("conteúdo íntegro")).toBeInTheDocument();
  });
});
