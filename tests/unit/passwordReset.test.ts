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

describe("passwordReset — template HTML com identidade UNICAP [UI_OVERHAUL]", () => {
  const link = "https://carreiras.unicap.br/recuperar-senha?token=T0K";

  it("é um documento de e-mail completo (doctype + html)", () => {
    const { html } = buildPasswordResetEmail({ link });
    expect(html).toMatch(/<!DOCTYPE html>/i);
    expect(html).toMatch(/<html[\s>]/i);
    expect(html).toContain("</html>");
  });

  it("usa a identidade UNICAP (bordô #6B1426 e dourado #C89D3C)", () => {
    const { html } = buildPasswordResetEmail({ link });
    expect(html).toContain("#6B1426");
    expect(html).toContain("#C89D3C");
    expect(html).toMatch(/UNICAP/i);
  });

  it("tem um CTA <a> estilizado apontando para o link de recuperação", () => {
    const { html } = buildPasswordResetEmail({ link });
    // âncora com href real + botão visual inline (client-safe)
    expect(html).toContain(`href="${link}"`);
    expect(html).toMatch(/<a[^>]+style=/i);
  });

  it("mantém o aviso LGPD (ignore este e-mail) e a validade de 30 min", () => {
    const { html } = buildPasswordResetEmail({ link });
    expect(html).toMatch(/30 minutos/i);
    expect(html).toMatch(/ignore este e-mail/i);
  });

  it("aplica o mesmo shell de marca à notificação de etapa [consistência]", async () => {
    const { buildStageNotificationEmail } =
      await import("../../src/lib/emailNotify");
    const email = buildStageNotificationEmail({
      studentName: "Maria",
      jobTitle: "Estágio",
      stage: "aprovado",
    });
    expect(email.html).toContain("#6B1426");
    expect(email.html).toMatch(/<html[\s>]/i);
  });
});
