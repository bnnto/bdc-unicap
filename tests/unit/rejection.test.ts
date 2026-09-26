import { describe, expect, it } from "vitest";
import {
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  isRejectionReason,
  rejectionDecision,
} from "../../src/lib/application";

describe("catálogo padronizado de motivos (S4-2, CA 2)", () => {
  it("enum fixo com os motivos de auditoria", () => {
    expect(REJECTION_REASONS).toEqual([
      "requisitos_obrigatorios",
      "formacao_incompativel",
      "disponibilidade_incompativel",
      "idioma_insuficiente",
      "perfil_duplicado",
      "vaga_preenchida",
      "vaga_cancelada",
      "outro",
    ]);
  });

  it("todo motivo tem rótulo pt-BR não vazio (exibição/auditoria)", () => {
    for (const reason of REJECTION_REASONS) {
      expect(REJECTION_REASON_LABELS[reason].length).toBeGreaterThan(0);
    }
    expect(REJECTION_REASON_LABELS.requisitos_obrigatorios).toBe(
      "Não atende aos requisitos obrigatórios da vaga",
    );
  });

  it("guarda do enum: aceita apenas motivos do catálogo", () => {
    for (const reason of REJECTION_REASONS) {
      expect(isRejectionReason(reason)).toBe(true);
    }
    expect(isRejectionReason("nao_gostei_da_cara")).toBe(false);
    expect(isRejectionReason("")).toBe(false);
    expect(isRejectionReason(42)).toBe(false);
    expect(isRejectionReason(null)).toBe(false);
    expect(isRejectionReason(undefined)).toBe(false);
  });
});

describe("regra R5 — reprovação exige motivo (S4-2, CA 1)", () => {
  const from = "triagem" as const;

  it("sem motivo: falha (mutation não pode gravar)", () => {
    const decision = rejectionDecision({ stage: from, reason: undefined });
    expect(decision).toEqual({
      ok: false,
      error: "Motivo de reprovação é obrigatório (R5).",
    });
  });

  it("motivo fora do enum: falha (sem texto livre)", () => {
    const decision = rejectionDecision({
      stage: from,
      reason: "nao_gostei_da_cara",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.error).toContain("Motivo de reprovação inválido");
    }
  });

  it("motivo vazio: falha", () => {
    expect(rejectionDecision({ stage: from, reason: "" })).toEqual({
      ok: false,
      error: "Motivo de reprovação é obrigatório (R5).",
    });
  });

  it("motivo válido e stage ≠ reprovado: reprovação autorizada", () => {
    expect(
      rejectionDecision({ stage: from, reason: "requisitos_obrigatorios" }),
    ).toEqual({ ok: true, nextStage: "reprovado" });
  });

  it("reprovar candidato já reprovado é no-op rejeitado", () => {
    const decision = rejectionDecision({
      stage: "reprovado",
      reason: "outro",
    });
    expect(decision).toEqual({
      ok: false,
      error: "Candidatura já está reprovada.",
    });
  });

  it("aprovado também pode ser reprovado (retroação com motivo)", () => {
    expect(
      rejectionDecision({ stage: "aprovado", reason: "vaga_cancelada" }),
    ).toEqual({ ok: true, nextStage: "reprovado" });
  });
});
