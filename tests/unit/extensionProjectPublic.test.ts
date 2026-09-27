/**
 * [S7-3] Regra pura da divulgação pública — TDD.
 *
 * R9 — divulgação para estudantes, professores e público externo.
 * CA 2 — nenhum dado restrito exposto: a projeção whitelist devolve
 * APENAS os campos públicos; qualquer campo interno do documento é
 * descartado por construção (não por blacklist).
 */
import { describe, expect, it } from "vitest";
import {
  isProjectPubliclyVisible,
  toPublicProjectView,
  type PublicProjectView,
} from "../../src/lib/extensionProjectPublic";

const INTERNAL = {
  title: "Escola de Verão de Computação para Escolas Públicas",
  description:
    "Oficinas de programação para estudantes de escolas públicas do Recife.",
  coordinatorId: "jx00000000000000000000000a" as never,
  area: "educacao" as const,
  targetAudience: "Estudantes do ensino médio da rede pública",
  createdAt: 1_750_000_000_000,
  active: true,
  statusChangedAt: 1_750_000_000_000,
  _id: "jx00000000000000000000000b" as never,
  _creationTime: 1_750_000_000_000,
};

describe("[S7-3] isProjectPubliclyVisible (regra de visibilidade)", () => {
  it("projeto ativo é visível publicamente", () => {
    expect(isProjectPubliclyVisible({ active: true })).toBe(true);
  });

  it("projeto não ativo NUNCA é divulgado (R9)", () => {
    expect(isProjectPubliclyVisible({ active: false })).toBe(false);
  });
});

describe("[S7-3] toPublicProjectView (projeção whitelist — CA 2)", () => {
  it("devolve apenas os campos públicos, na ordem exata do contrato", () => {
    const view = toPublicProjectView(INTERNAL);
    expect(Object.keys(view).sort()).toEqual([
      "area",
      "createdAt",
      "description",
      "statusChangedAt",
      "targetAudience",
      "title",
    ]);
  });

  it("nunca expõe coordinatorId nem ids internos (whitelist por construção)", () => {
    const view = toPublicProjectView(INTERNAL) as Record<string, unknown>;
    expect(view).not.toHaveProperty("coordinatorId");
    expect(view).not.toHaveProperty("_id");
    expect(view).not.toHaveProperty("_creationTime");
    expect(view).not.toHaveProperty("active");
  });

  it("campos públicos preservam o conteúdo original", () => {
    const view = toPublicProjectView(INTERNAL);
    expect(view.title).toBe(INTERNAL.title);
    expect(view.description).toBe(INTERNAL.description);
    expect(view.area).toBe("educacao");
    expect(view.targetAudience).toBe(INTERNAL.targetAudience);
    expect(view.createdAt).toBe(INTERNAL.createdAt);
    expect(view.statusChangedAt).toBe(INTERNAL.statusChangedAt);
  });

  it("o resultado satisfaz o tipo público PublicProjectView", () => {
    const view: PublicProjectView = toPublicProjectView(INTERNAL);
    expect(view.title.length).toBeGreaterThan(0);
  });
});
