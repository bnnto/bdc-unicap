/**
 * [ONBOARDING_RECOVERY] Fluxo de "Esqueci minha senha" no frontend:
 *
 * - AuthPage ganha o link que leva a /recuperar-senha.
 * - Sem token na URL: formulário de e-mail → toast de sucesso
 *   ("E-mail de recuperação enviado!").
 * - Com token na URL: nova senha + confirmação → troca no servidor,
 *   toast de sucesso e envio para /login.
 * - Falhas do servidor (token inválido/expirado, senhas diferentes)
 *   viram Toasts amigáveis — nunca erro cru no formulário.
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signIn: vi.fn(), signOut: vi.fn() }),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    passwordResets: {
      requestReset: "mut:passwordResets.requestReset",
      resetPassword: "mut:passwordResets.resetPassword",
    },
  },
}));

import { useMutation } from "convex/react";
import { toast } from "sonner";
import { AuthPage } from "../../src/components/auth/AuthPage";
import { ResetPasswordPage } from "../../src/components/auth/ResetPasswordPage";

const mockedUseMutation = vi.mocked(useMutation);

const requestReset = vi.fn().mockResolvedValue({ ok: true });
const resetPassword = vi.fn().mockResolvedValue({ ok: true });

beforeEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/recuperar-senha");
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:passwordResets.requestReset"
      ? requestReset
      : resetPassword) as never);
});

describe("ResetPasswordPage — pedir recuperação (sem token)", () => {
  it("envia o e-mail e confirma com Toast de sucesso", async () => {
    render(<ResetPasswordPage />);
    const form = screen.getByRole("form", { name: /solicitar recuperação/i });
    expect(form).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/e-mail/i), "Aluna@Unicap.br");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar link de recuperação/i }),
    );

    expect(requestReset).toHaveBeenCalledWith({ email: "Aluna@Unicap.br" });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/e-mail de recuperação enviado/i),
    );
    // Sem enumeração de contas: o estado de sucesso é o mesmo.
    expect(
      screen.getByText(/se existir uma conta com este e-mail/i),
    ).toBeInTheDocument();
  });

  it("falha do servidor vira Toast amigável", async () => {
    requestReset.mockRejectedValueOnce(new Error("Erro inesperado."));
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(/e-mail/i), "aluna@unicap.br");
    await userEvent.click(
      screen.getByRole("button", { name: /enviar link de recuperação/i }),
    );
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("link de volta para o login", async () => {
    render(<ResetPasswordPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /voltar para o login/i }),
    );
    expect(window.location.pathname).toBe("/login");
  });
});

describe("ResetPasswordPage — trocar a senha (com token)", () => {
  beforeEach(() => {
    window.history.pushState({}, "", "/recuperar-senha?token=ABC123");
  });

  it("lê o token da URL e troca a senha com confirmação", async () => {
    render(<ResetPasswordPage />);
    expect(
      screen.getByRole("heading", { name: /recuperar senha/i }),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/^nova senha/i), "SenhaNova456");
    await userEvent.type(
      screen.getByLabelText(/confirmar nova senha/i),
      "SenhaNova456",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /redefinir senha/i }),
    );

    expect(resetPassword).toHaveBeenCalledWith({
      token: "ABC123",
      password: "SenhaNova456",
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/senha redefinida com sucesso/i),
    );
    expect(window.location.pathname).toBe("/login");
  });

  it("senhas diferentes bloqueiam o envio com Toast de erro", async () => {
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(/^nova senha/i), "SenhaNova456");
    await userEvent.type(
      screen.getByLabelText(/confirmar nova senha/i),
      "OutraSenha789",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /redefinir senha/i }),
    );

    expect(resetPassword).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/senhas não coincidem/i),
    );
    expect(window.location.pathname).toBe("/recuperar-senha");
  });

  it("token inválido/expirado do servidor vira Toast legível", async () => {
    resetPassword.mockRejectedValueOnce(
      new Error("Token de recuperação inválido ou expirado."),
    );
    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText(/^nova senha/i), "SenhaNova456");
    await userEvent.type(
      screen.getByLabelText(/confirmar nova senha/i),
      "SenhaNova456",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /redefinir senha/i }),
    );

    expect(toast.error).toHaveBeenCalledWith(
      "Token de recuperação inválido ou expirado.",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/recuperar-senha");
  });
});

describe("AuthPage — link de recuperação", () => {
  it("'Esqueci minha senha' leva a /recuperar-senha", async () => {
    window.history.pushState({}, "", "/login");
    render(<AuthPage />);
    await userEvent.click(
      screen.getByRole("button", { name: /esqueci minha senha/i }),
    );
    expect(window.location.pathname).toBe("/recuperar-senha");
  });
});
