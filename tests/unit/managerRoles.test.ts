import { describe, expect, it } from "vitest";
import {
  ROLES,
  PUBLIC_SIGNUP_ROLES,
  isPublicSignupRole,
  isRole,
  ROLE_LABELS,
} from "../../src/lib/roles";

/**
 * [REFACTOR_GESTOR] Etapa 3 — o público NÃO cria conta de gestor: apenas
 * aluno e recrutador são escolhíveis no cadastro. Contas de gestor são
 * provisionadas exclusivamente pela coordenação (Convex Dashboard).
 */
describe("REFACTOR_GESTOR — cadastro sem papel gestor (Etapa 3)", () => {
  it("PUBLIC_SIGNUP_ROLES contém apenas aluno e recrutador", () => {
    expect(PUBLIC_SIGNUP_ROLES).toEqual(["aluno", "recrutador"]);
    expect(PUBLIC_SIGNUP_ROLES).not.toContain("gestor");
  });

  it("isPublicSignupRole aceita aluno/recrutador e rejeita gestor", () => {
    expect(isPublicSignupRole("aluno")).toBe(true);
    expect(isPublicSignupRole("recrutador")).toBe(true);
    expect(isPublicSignupRole("gestor")).toBe(false);
    expect(isPublicSignupRole("empresa")).toBe(false);
    expect(isPublicSignupRole(undefined)).toBe(false);
  });

  it("gestor segue existindo no sistema (isRole true) — só não é público no cadastro", () => {
    expect(ROLES).toEqual(["aluno", "recrutador", "gestor"]);
    expect(isRole("gestor")).toBe(true);
    expect(ROLE_LABELS.gestor).toBe("Gestor");
  });
});
