import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  STAGE_LABELS,
  canApplyTo,
  buildMatchingCandidateInput,
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
