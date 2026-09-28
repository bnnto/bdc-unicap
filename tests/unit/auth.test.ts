import { describe, expect, it } from "vitest";
import { normalizeEmail, isValidEmail } from "../../src/lib/auth";
import { ROLE_LABELS, isRole } from "../../src/lib/roles";
import { hashPassword, verifyPassword } from "../../convex/password";

describe("auth helpers (S1-1)", () => {
  it("normaliza o e-mail para busca insensível a caixa", () => {
    expect(normalizeEmail("  Maria.Silva@Unicap.Br ")).toBe(
      "maria.silva@unicap.br",
    );
  });

  it("valida formato básico de e-mail", () => {
    expect(isValidEmail("aluno@unicap.br")).toBe(true);
    expect(isValidEmail("sem-arroba")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("hash de senha — PBKDF2 (S1-1, R7)", () => {
  it("gera hash verificável e sem a senha em claro", async () => {
    const hash = await hashPassword("senhaForte123");
    expect(hash).not.toContain("senhaForte123");
    expect(hash.startsWith("pbkdf2$")).toBe(true);
    await expect(verifyPassword("senhaForte123", hash)).resolves.toBe(true);
    await expect(verifyPassword("errada", hash)).resolves.toBe(false);
  });

  it("usa salt único por senha", async () => {
    const h1 = await hashPassword("mesmaSenha");
    const h2 = await hashPassword("mesmaSenha");
    expect(h1).not.toBe(h2);
  });

  it("rejeita hashes malformados", async () => {
    await expect(verifyPassword("x", "bcrypt$abc")).resolves.toBe(false);
    await expect(verifyPassword("x", "")).resolves.toBe(false);
  });
});

describe("papéis (S1-1)", () => {
  it("valida papéis conhecidos", () => {
    expect(isRole("aluno")).toBe(true);
    expect(isRole("recrutador")).toBe(true);
    expect(isRole("gestor")).toBe(true);
    // [REFACTOR_UI] O papel "empresa" foi descontinuado.
    expect(isRole("empresa")).toBe(false);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });

  it("expõe rótulos legíveis para todos os papéis", () => {
    expect(ROLE_LABELS.aluno).toBe("Aluno");
    expect(ROLE_LABELS.recrutador).toBe("Recrutador");
    expect(ROLE_LABELS).not.toHaveProperty("empresa");
  });
});
