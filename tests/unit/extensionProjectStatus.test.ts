/**
 * [S7-2] Regra pura do acompanhamento ativo/não ativo — TDD.
 *
 * CA — toggle de status registrado com timestamp: a decisão central
 * (deve gravar? qual estado? qual momento?) vive aqui, pura e testável;
 * a mutation Convex apenas persiste o que a regra devolve.
 */
import { describe, expect, it } from "vitest";
import { evaluateStatusChange } from "../../src/lib/extensionProjectStatus";

const T0 = 1_750_000_000_000;
const T1 = T0 + 5_000;

describe("[S7-2] evaluateStatusChange (regra pura)", () => {
  it("ativa um projeto não ativo e registra o timestamp", () => {
    const result = evaluateStatusChange(
      { active: false, statusChangedAt: T0 },
      true,
      T1,
    );
    expect(result).toEqual({ ok: true, active: true, statusChangedAt: T1 });
  });

  it("desativa um projeto ativo e registra o timestamp", () => {
    const result = evaluateStatusChange(
      { active: true, statusChangedAt: T0 },
      false,
      T1,
    );
    expect(result).toEqual({ ok: true, active: false, statusChangedAt: T1 });
  });

  it("toggle sem mudança de estado é idempotente (não regrava o timestamp)", () => {
    const same = evaluateStatusChange(
      { active: true, statusChangedAt: T0 },
      true,
      T1,
    );
    expect(same).toEqual({ ok: false, errors: [] });
  });

  it("statusChangedAt anterior ao atual é rejeitado (sem retroagir)", () => {
    const result = evaluateStatusChange(
      { active: false, statusChangedAt: T1 },
      true,
      T0,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.join(" ")).toMatch(/data/i);
    }
  });

  it("timestamp no mesmo milissegundo da última mudança é aceito", () => {
    const result = evaluateStatusChange(
      { active: false, statusChangedAt: T0 },
      true,
      T0,
    );
    expect(result).toEqual({ ok: true, active: true, statusChangedAt: T0 });
  });
});
