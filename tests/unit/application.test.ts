import { assert, describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  REJECTION_REASONS,
  STAGE_LABELS,
  canApplyTo,
  buildMatchingCandidateInput,
  moveStageDecision,
  type ApplicationStage,
} from "../../src/lib/application";

// Constantes nomeadas (evitam "magic numbers" e documentam a intenção).
const SETE_DIAS_MS = 604_800_000; // 7 dias em milissegundos
const TOTAL_MOTIVOS_REPROVACAO = 8;
const EXPIRA_EM = new Date("2026-12-01T00:00:00Z").getTime();
const ANTES_DO_PRAZO = new Date("2026-10-01T00:00:00Z").getTime();

type Decision = ReturnType<typeof moveStageDecision>;

/**
 * Helper fora do corpo dos testes: falha se a decisão NÃO foi bloqueada e,
 * graças ao `assert`, estreita o tipo para ler `decision.error` sem `if`.
 */
function expectBlocked(decision: Decision, error: RegExp) {
  assert(!decision.ok, "esperava uma decisão bloqueada (ok === false)");
  expect(decision.error).toMatch(error);
}

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
    expectBlocked(
      moveStageDecision({ stage: "triagem", to: "triagem" }),
      /já está nesta coluna/i,
    );
  });

  it("REPROVAÇÃO sem motivo é bloqueada (R5 — furo do moveApplication)", () => {
    expectBlocked(
      moveStageDecision({ stage: "entrevista", to: "reprovado" }),
      /Motivo de reprovação é obrigatório/i,
    );
  });

  it("REPROVAÇÃO com motivo fora do enum fixo é bloqueada (R5)", () => {
    expectBlocked(
      moveStageDecision({
        stage: "triagem",
        to: "reprovado",
        rejectionReason: "nao_gostei_da_cara",
      }),
      /Motivo de reprovação inválido/i,
    );
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

  it("aprovar sem a data de início prevista é bloqueado (contratação auditável)", () => {
    expectBlocked(
      moveStageDecision({ stage: "entrevista", to: "aprovado" }),
      /Data de início prevista é obrigatória/i,
    );
  });

  it("aprovar com data de início prevista marca a vaga como preenchida", () => {
    const decision = moveStageDecision({
      stage: "entrevista",
      to: "aprovado",
      expectedStartDate: Date.now() + SETE_DIAS_MS,
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "aprovado",
      jobFilled: true,
      jobUnfilled: false,
    });
  });

  it("ENTREVISTA sem data/hora é bloqueada (auditoria)", () => {
    expectBlocked(
      moveStageDecision({
        stage: "triagem",
        to: "entrevista",
        interviewLink: "https://meet.example.com/unicap",
      }),
      /Data e hora da entrevista é obrigatória/i,
    );
  });

  it("ENTREVISTA com link em branco é bloqueada (auditoria)", () => {
    expectBlocked(
      moveStageDecision({
        stage: "triagem",
        to: "entrevista",
        interviewDate: Date.now(),
        interviewLink: "   ",
      }),
      /Link ou local da entrevista é obrigatório/i,
    );
  });

  it("ENTREVISTA com data e local é permitida", () => {
    const decision = moveStageDecision({
      stage: "triagem",
      to: "entrevista",
      interviewDate: Date.now(),
      interviewLink: "Auditório do Bloco 2",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "entrevista",
      jobFilled: false,
      jobUnfilled: false,
    });
  });

  const saltos: Array<[ApplicationStage, ApplicationStage]> = [
    ["inscrito", "entrevista"],
    ["inscrito", "aprovado"],
    ["triagem", "aprovado"],
  ];
  it.each(saltos)(
    "SALTO %s → %s é bloqueado no servidor (anti-cheat)",
    (stage, to) => {
      expectBlocked(
        moveStageDecision({ stage, to }),
        /avance no máximo uma etapa por vez/i,
      );
    },
  );

  it("aprovar vindo de Reprovado é bloqueado (só reinicia em 'inscrito')", () => {
    expectBlocked(
      moveStageDecision({ stage: "reprovado", to: "aprovado" }),
      /só reinicia em "inscrito"/i,
    );
  });

  it("Reprovado → Triagem (fora do início) é bloqueado", () => {
    const decision = moveStageDecision({ stage: "reprovado", to: "triagem" });
    expect(decision.ok).toBe(false);
  });

  it("desfazer aprovação limpa o preenchimento da vaga", () => {
    const decision = moveStageDecision({
      stage: "aprovado",
      to: "entrevista",
      interviewDate: Date.now(),
      interviewLink: "https://meet.example.com/unicap",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "entrevista",
      jobFilled: false,
      jobUnfilled: true,
    });
  });

  // Este teste cobre também o "reinício" Reprovado → Inscrito, que antes
  // estava duplicado dentro do teste "reprovado só reinicia em 'inscrito'".
  it("tirar da coluna Reprovado limpa o motivo gravado (reinício auditável)", () => {
    const decision = moveStageDecision({
      stage: "reprovado",
      to: "inscrito",
      rejectionReason: "outro",
    });
    expect(decision).toEqual({
      ok: true,
      nextStage: "inscrito",
      rejectionReason: null,
      jobFilled: false,
      jobUnfilled: false,
    });
  });

  it("catálogo de motivos cobre todos os valores do enum fixo (R5)", () => {
    expect(REJECTION_REASONS).toHaveLength(TOTAL_MOTIVOS_REPROVACAO);
  });
});

describe("regras de candidatura (S3-4)", () => {
  const openJob = {
    jobId: "j1",
    status: "aberta" as const,
    expiresAt: EXPIRA_EM,
    prerequisites: [{ item: "React", required: true }],
    requiredLanguage: undefined,
    availability: "estagio" as const,
  };

  it("vaga aberta dentro do prazo aceita candidatura", () => {
    const result = canApplyTo(openJob, ANTES_DO_PRAZO);
    expect(result.ok).toBe(true);
  });

  it("R4: vaga fechada não aceita candidatura", () => {
    expect(canApplyTo({ ...openJob, status: "fechada" }, Date.now()).ok).toBe(
      false,
    );
  });

  it("R4: vaga encerrada não aceita candidatura", () => {
    expect(canApplyTo({ ...openJob, status: "encerrada" }, Date.now()).ok).toBe(
      false,
    );
  });

  it("R4: vaga aberta vencida não aceita candidatura", () => {
    const result = canApplyTo(openJob, openJob.expiresAt + 1);
    expect(result).toMatchObject({ ok: false, reason: "vaga_expirada" });
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
      availability: ["estagio"],
    });
    expect(input).toEqual({
      skills: ["React", "SQL"],
      languages: [{ name: "Inglês", level: "intermediario" }],
      availability: ["estagio"],
    });
  });

  it("campos ausentes viram listas vazias (nunca undefined)", () => {
    const input = buildMatchingCandidateInput({
      skills: undefined,
      languages: undefined,
      availability: ["integral"],
    });
    expect(input.skills).toEqual([]);
    expect(input.languages).toEqual([]);
    expect(input.availability).toEqual(["integral"]);
  });
});