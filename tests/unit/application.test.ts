import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  REJECTION_REASONS,
  STAGE_LABELS,
  canApplyTo,
  buildMatchingCandidateInput,
  moveStageDecision,
} from "../../src/lib/application";

describe("stages da candidatura (S3-4, CA 3)", () => {
  it("stage inicial é 'inscrito' e os stages seguem o pipeline do Kanban (S4-1)", () => {
    expect(APPLICATION_STAGES[0]).toBe("inscrito");
    expect(APPLICATION_STAGES).toEqual([
      "inscrito",
      "triagem",
      "entrevista",
      "aprovado",
      "reprovado",
    ]);
  });

  it("rótulos pt-BR para todos os stages (contraste AA na UI)", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(STAGE_LABELS[stage].length).toBeGreaterThan(0);
    }
    expect(STAGE_LABELS.inscrito).toBe("Inscrito");
  });
});

/**
 * [RECRUITER_WORKFLOW] Etapa 2.2 — decisão pura de movimentação do
 * Kanban: reprovação SEM motivo é bloqueada no servidor (R5 — defesa em
 * profundidade; a UI também exige) e a aprovação marca o preenchimento
 * da vaga para os cálculos de time-to-hire ([S5-2]).
 */
describe("[RECRUITER_WORKFLOW] moveStageDecision — movimentação do Kanban", () => {
  it("transição normal entre colunas é permitida", () => {
    const decision = moveStageDecision({
      stage: "inscrito",
      to: "triagem",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "triagem",
      jobFilled: false,
      jobUnfilled: false,
    });
  });

  it("mover para a própria coluna é rejeitado (no-op)", () => {
    const decision = moveStageDecision({ stage: "triagem", to: "triagem" });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.error).toMatch(/já está nesta coluna/i);
    }
  });

  it("REPROVAÇÃO sem motivo é bloqueada (R5 — furo do moveApplication)", () => {
    const decision = moveStageDecision({
      stage: "entrevista",
      to: "reprovado",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.error).toMatch(/Motivo de reprovação é obrigatório/i);
    }
  });

  it("REPROVAÇÃO com motivo fora do enum fixo é bloqueada (R5)", () => {
    const decision = moveStageDecision({
      stage: "triagem",
      to: "reprovado",
      rejectionReason: "nao_gostei_da_cara",
    });
    expect(decision.ok).toBe(false);
    if (!decision.ok) {
      expect(decision.error).toMatch(/Motivo de reprovação inválido/i);
    }
  });

  it("REPROVAÇÃO com motivo válido do catálogo retorna o motivo a gravar", () => {
    const decision = moveStageDecision({
      stage: "triagem",
      to: "reprovado",
      rejectionReason: "idioma_insuficiente",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "reprovado",
      rejectionReason: "idioma_insuficiente",
      jobFilled: false,
      jobUnfilled: false,
    });
  });

  it("aprovar marca a vaga como preenchida (base do time-to-hire)", () => {
    const decision = moveStageDecision({
      stage: "entrevista",
      to: "aprovado",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "aprovado",
      jobFilled: true,
      jobUnfilled: false,
    });
  });

  it("desfazer aprovação limpa o preenchimento da vaga", () => {
    const decision = moveStageDecision({
      stage: "aprovado",
      to: "entrevista",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "entrevista",
      jobFilled: false,
      jobUnfilled: true,
    });
  });

  it("tirar da coluna Reprovado limpa o motivo gravado (volta ao pipeline)", () => {
    const decision = moveStageDecision({
      stage: "reprovado",
      to: "triagem",
      rejectionReason: "outro",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "triagem",
      rejectionReason: null,
      jobFilled: false,
      jobUnfilled: false,
    });
  });

  it("catálogo de motivos cobre os 8 valores do enum fixo (R5)", () => {
    expect(REJECTION_REASONS).toHaveLength(8);
  });
});

describe("regras de candidatura (S3-4)", () => {
  const openJob = {
    jobId: "j1",
    status: "aberta" as const,
    expiresAt: Date.UTC(2026, 11, 1),
    prerequisites: [{ item: "React", required: true }],
    requiredLanguage: undefined,
    availability: "estagio" as const,
  };

  it("vaga aberta dentro do prazo aceita candidatura", () => {
    const result = canApplyTo(openJob, Date.UTC(2026, 9, 1));
    expect(result.ok).toBe(true);
  });

  it("R4: vaga fechada/encerrada não aceita candidatura", () => {
    expect(canApplyTo({ ...openJob, status: "fechada" }, Date.now()).ok).toBe(
      false,
    );
    expect(canApplyTo({ ...openJob, status: "encerrada" }, Date.now()).ok).toBe(
      false,
    );
  });

  it("R4: vaga aberta vencida não aceita candidatura", () => {
    const result = canApplyTo(openJob, openJob.expiresAt + 1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("vaga_expirada");
  });

  it("vaga sem expiresAt registrado é tratada como aberta (legado)", () => {
    expect(
      canApplyTo({ ...openJob, expiresAt: undefined }, Date.now()).ok,
    ).toBe(true);
  });
});

describe("entrada do matching a partir do perfil (S3-4, R8)", () => {
  it("monta MatchingCandidate a partir do perfil do aluno", () => {
    const input = buildMatchingCandidateInput({
      skills: ["React", "SQL"],
      languages: [{ name: "Inglês", level: "intermediario" }],
      availability: "estagio",
    });
    expect(input).toEqual({
      skills: ["React", "SQL"],
      languages: [{ name: "Inglês", level: "intermediario" }],
      availability: "estagio",
    });
  });

  it("campos ausentes viram listas vazias (nunca undefined)", () => {
    const input = buildMatchingCandidateInput({
      skills: undefined,
      languages: undefined,
      availability: "integral",
    });
    expect(input.skills).toEqual([]);
    expect(input.languages).toEqual([]);
    expect(input.availability).toBe("integral");
  });
});
