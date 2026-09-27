/**
 * [UX-P2] H9-2 — Erros de autenticação (credenciais inválidas, conta
 * inexistente) são do FORMULÁRIO, não do campo senha: devem aparecer
 * como alerta no topo do form, sem aria-describedby no campo de senha.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signInMock = vi.fn();

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: signInMock }),
}));

import { AuthPage } from "../../src/components/auth/AuthPage";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AuthPage — erro de autenticação no topo do formulário (H9-2)", () => {
  it("falha de login exibe role=alert no form e não anexa erro ao campo senha", async () => {
    signInMock.mockRejectedValueOnce(
      new Error("E-mail ou senha incorretos. Verifique e tente novamente."),
    );

    render(<AuthPage />);

    await userEvent.type(screen.getByLabelText(/E-mail/i), "aluno@unicap.br");
    await userEvent.type(screen.getByLabelText(/Senha/i), "senha-errada");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    const alerts = screen.getAllByRole("alert");
    expect(
      alerts.some((alert) =>
        alert.textContent?.includes("E-mail ou senha incorretos"),
      ),
    ).toBe(true);

    // O campo senha NÃO carrega o erro de credenciais (H9-2).
    const password = screen.getByLabelText(/Senha/i);
    expect(password).not.toHaveAttribute("aria-invalid");
    expect(password).not.toHaveAttribute("aria-describedby");
  });

  it("login com sucesso não exibe alerta", async () => {
    signInMock.mockResolvedValueOnce(undefined);
    render(<AuthPage />);

    await userEvent.type(screen.getByLabelText(/E-mail/i), "aluno@unicap.br");
    await userEvent.type(screen.getByLabelText(/Senha/i), "senha-correta");
    await userEvent.click(screen.getByRole("button", { name: "Entrar" }));

    // Nenhum alerta de erro visível no fluxo de sucesso.
    const alerts = screen.queryAllByRole("alert");
    const errored = alerts.filter((alert) =>
      alert.textContent?.includes("E-mail ou senha incorretos"),
    );
    expect(errored).toHaveLength(0);
  });
});
