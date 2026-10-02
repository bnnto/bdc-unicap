/**
 * [UX_REFINEMENT] Etapa 1 — erros de autenticação saem das caixas
 * cruas (`[CONVEX A(auth:signIn)]…`) e viram Toast global com mensagem
 * amigável traduzida. O campo senha NUNCA carrega o erro (H9-2
 * preservado) e a validação de consentimento continua inline.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInMock = vi.fn();

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: signInMock }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

import { toast } from "sonner";
import { AuthPage } from "../../src/components/auth/AuthPage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthPage — erros de login via Toast amigável (Etapa 1)", () => {
  it("falha de login vira toast amigável e não deixa erro cru no form", async () => {
    signInMock.mockRejectedValueOnce(
      new Error(
        "[CONVEX A(auth:signIn)] [Request Failed] Uncaught (in promise) Error: E-mail ou senha incorretos.\n" +
          "    at signIn (http://localhost:8080/main.js:1:1)",
      ),
    );

    render(<AuthPage />);

    await userEvent.type(screen.getByLabelText(/E-mail/i), "aluno@unicap.br");
    await userEvent.type(screen.getByLabelText(/Senha/i), "senha-errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(toast.error).toHaveBeenCalledWith("E-mail ou senha incorretos.");
    // Nenhuma caixa de erro crua no formulário (Etapa 1).
    expect(screen.queryByText(/CONVEX/i)).not.toBeInTheDocument();
    expect(
      screen
        .queryAllByRole("alert")
        .some((alert) =>
          alert.textContent?.includes("E-mail ou senha incorretos"),
        ),
    ).toBe(false);

    // O campo senha NÃO carrega o erro de credenciais (H9-2).
    const password = screen.getByLabelText(/Senha/i);
    expect(password).not.toHaveAttribute("aria-invalid");
    expect(password).not.toHaveAttribute("aria-describedby");
  });

  it("login com sucesso confirma com toast e sem erro", async () => {
    signInMock.mockResolvedValueOnce(undefined);
    render(<AuthPage />);

    await userEvent.type(screen.getByLabelText(/E-mail/i), "aluno@unicap.br");
    await userEvent.type(screen.getByLabelText(/Senha/i), "senha-correta");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
