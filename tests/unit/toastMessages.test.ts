/**
 * [UX_REFINEMENT] Etapa 1 — tradução de erros de servidor para
 * mensagens amigáveis exibidas nos Toasts. Nenhuma mensagem crua
 * (`[CONVEX A(auth:signIn)]…`, stacks, TypeErrors) chega ao utilizador.
 */
import { describe, expect, it } from "vitest";
import {
  GENERIC_ERROR,
  friendlyErrorMessage,
} from "../../src/lib/toastMessages";

describe("[UX_REFINEMENT] friendlyErrorMessage — erros amigáveis", () => {
  it("remove o prefixo [CONVEX …], o stack e traduz credenciais inválidas", () => {
    const raw =
      "[CONVEX A(auth:signIn)] [Request Failed] Uncaught (in promise) Error: E-mail ou senha incorretos.\n" +
      "    at signIn (http://localhost:8080/main.js:1:1)\n" +
      "    at async AuthPage (http://localhost:8080/App.js:2:2)";
    expect(friendlyErrorMessage(raw)).toBe("E-mail ou senha incorretos.");
  });

  it("credenciais em inglês caem na mesma mensagem canônica", () => {
    expect(friendlyErrorMessage("Invalid credentials")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(friendlyErrorMessage("Incorrect email or password")).toBe(
      "E-mail ou senha incorretos.",
    );
  });

  it("[FINAL_UPGRADE] erros literais de senha incorreta do Convex", () => {
    expect(friendlyErrorMessage("Incorrect password")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(friendlyErrorMessage("Password is incorrect")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(friendlyErrorMessage("Wrong password")).toBe(
      "E-mail ou senha incorretos.",
    );
    expect(
      friendlyErrorMessage("[CONVEX A(auth:signIn)] Error: Invalid password"),
    ).toBe("E-mail ou senha incorretos.");
  });

  it("conta duplicada e conta desativada têm mensagens próprias", () => {
    expect(friendlyErrorMessage("Já existe conta com este e-mail.")).toBe(
      "Já existe uma conta com este e-mail.",
    );
    expect(
      friendlyErrorMessage("Conta desativada. Procure a coordenação."),
    ).toBe("Conta desativada. Procure a coordenação.");
  });

  it("sessão expirada e consentimento ausente viram conselhos claros", () => {
    expect(
      friendlyErrorMessage(new Error("Sessão expirada. Entre novamente.")),
    ).toBe("Sua sessão expirou. Entre novamente.");
    expect(
      friendlyErrorMessage("Aceite o Termo de Consentimento LGPD vigente."),
    ).toBe("Aceite o Termo de Consentimento LGPD vigente para continuar.");
  });

  it("falhas de rede viram orientação de conexão", () => {
    expect(friendlyErrorMessage("TypeError: Failed to fetch")).toMatch(
      /sem conexão/i,
    );
    expect(friendlyErrorMessage("network error")).toMatch(/sem conexão/i);
  });

  it("erros internos genéricos caem no fallback (nunca expor detalhes)", () => {
    expect(
      friendlyErrorMessage(
        "TypeError: Cannot read properties of undefined (reading 'x')",
      ),
    ).toBe(GENERIC_ERROR);
    expect(
      friendlyErrorMessage("[CONVEX U(users:delete)] Handler failed"),
    ).toBe(GENERIC_ERROR);
    expect(friendlyErrorMessage("")).toBe(GENERIC_ERROR);
    expect(friendlyErrorMessage(undefined)).toBe(GENERIC_ERROR);
    expect(friendlyErrorMessage(null)).toBe(GENERIC_ERROR);
    expect(friendlyErrorMessage(42)).toBe(GENERIC_ERROR);
  });

  it("mensagem humana em português já amigável é repassada", () => {
    expect(friendlyErrorMessage("Informe seu nome completo.")).toBe(
      "Informe seu nome completo.",
    );
  });

  it("erros em inglês sem tradução específica nunca vazam em inglês", () => {
    expect(friendlyErrorMessage("User already exists")).toBe(GENERIC_ERROR);
    expect(friendlyErrorMessage("Please enter a valid email address")).toBe(
      GENERIC_ERROR,
    );
    expect(friendlyErrorMessage("Password must be at least 8 characters")).toBe(
      GENERIC_ERROR,
    );
    expect(friendlyErrorMessage("No account found for pedro@unicap.br")).toBe(
      "E-mail ou senha incorretos.",
    );
  });
});
