import { describe, expect, it } from "vitest";
import {
  REJECTION_REASONS,
  REJECTION_REASON_LABELS,
  isRejectionReason,
  rejectionDecision,
} from "../../src/lib/application";

const SEM_MOTIVO = {
  ok: false,
  error: "Motivo de reprovação é obrigatório (R5).",
};

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

  it.each(REJECTION_REASONS)(
    "motivo %s tem rótulo pt-BR não vazio (exibição/auditoria)",
    (reason) => {
      expect(REJECTION_REASON_LABELS[reason].length).toBeGreaterThan(0);
    },
  );

  it("rótulo de requisitos_obrigatorios é o texto de auditoria", () => {
    expect(REJECTION_REASON_LABELS.requisitos_obrigatorios).toBe(
      "Não atende aos requisitos obrigatórios da vaga",
    );
  });

  it.each(REJECTION_REASONS)("guarda do enum aceita %s", (reason) => {
    expect(isRejectionReason(reason)).toBe(true);
  });

  it.each(["nao_gostei_da_cara", "", 42, null, undefined])(
    "guarda do enum rejeita %j",
    (value) => {
      expect(isRejectionReason(value)).toBe(false);
    },
  );
});

describe("regra R5 — reprovação exige motivo (S4-2, CA 1)", () => {
  const from = "triagem" as const;

  it("sem motivo: falha (mutation não pode gravar)", () => {
    const decision = rejectionDecision({ stage: from, reason: undefined });

    expect(decision).toEqual(SEM_MOTIVO);
  });

  it("motivo fora do enum: falha (sem texto livre)", () => {
    const decision = rejectionDecision({
      stage: from,
      reason: "nao_gostei_da_cara",
    });

    expect(decision).toMatchObject({ ok: false });
    const message = decision.ok ? "" : decision.error;
    expect(message).toContain("Motivo de reprovação inválido");
  });

  it("motivo vazio: falha", () => {
    expect(rejectionDecision({ stage: from, reason: "" })).toEqual(SEM_MOTIVO);
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