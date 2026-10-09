/**
 * [ONBOARDING_RECOVERY] Regras PURAS do fluxo "Esqueci minha senha":
 * link de recuperação, validade do token e conteúdo do e-mail.
 * Sem I/O — a action de e-mail só compõe/transporta (mesmo padrão de
 * src/lib/emailNotify.ts).
 */
import { describe, expect, it } from "vitest";
import {
  PASSWORD_RESET_PATH,
  PASSWORD_RESET_TTL_MS,
  buildPasswordResetEmail,
  buildPasswordResetLink,
} from "../../src/lib/passwordReset";

describe("passwordReset — link de recuperação (puro)", () => {
  it("monta /recuperar-senha?token= com a base sem barra final", () => {
    expect(
      buildPasswordResetLink("https://carreiras.unicap.br/", "ABC123"),
    ).toBe("https://carreiras.unicap.br/recuperar-senha?token=ABC123");
    expect(buildPasswordResetLink("http://localhost:5173", "ABC123")).toBe(
      "http://localhost:5173/recuperar-senha?token=ABC123",
    );
  });

  it("codifica o token (nunca quebra a URL)", () => {
    expect(buildPasswordResetLink("https://x.br", "a+b/c=d")).toContain(
      "token=a%2Bb%2Fc%3D",
    );
  });

  it("validade de 30 minutos e rota única", () => {
    expect(PASSWORD_RESET_TTL_MS).toBe(30 * 60 * 1000);
    expect(PASSWORD_RESET_PATH).toBe("/recuperar-senha");
  });

  it("o e-mail inclui o link de recuperação no texto e no HTML", () => {
    const link = "https://x.br/recuperar-senha?token=T0K";
    const email = buildPasswordResetEmail({ link });
    expect(email.subject).toMatch(/recupera/i);
    expect(email.text).toContain(link);
    expect(email.html).toContain(link);
  });
});
