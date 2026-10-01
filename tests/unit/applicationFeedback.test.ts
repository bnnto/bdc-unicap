/**
 * [REFACTOR_ALUNO Etapa 4] — feedback claro na aba Minhas Candidaturas.
 * Regras puras (TDD): tonalidade do badge por etapa, mensagem de status
 * por etapa e feedback amigável do motivo de reprovação (R5, enum fixo).
 */
import { describe, expect, it } from "vitest";
import {
  APPLICATION_STAGES,
  REJECTION_REASONS,
  STAGE_BADGE,
  rejectionFeedback,
  stageFeedback,
} from "../../src/lib/application";

describe("applicationFeedback — badge por etapa (Etapa 4.2)", () => {
  it("cada etapa mapeia para um tom de badge válido", () => {
    for (const stage of APPLICATION_STAGES) {
      expect(STAGE_BADGE[stage], stage).toBeDefined();
      expect(["aprovado", "triagem", "reprovado", "andamento"]).toContain(
        STAGE_BADGE[stage],
      );
    }
  });

  it("etapas finais usam os tons de aprovado e reprovado", () => {
    expect(STAGE_BADGE.aprovado).toBe("aprovado");
    expect(STAGE_BADGE.reprovado).toBe("reprovado");
    expect(STAGE_BADGE.inscrito).toBe("andamento");
    expect(STAGE_BADGE.triagem).toBe("triagem");
    expect(STAGE_BADGE.entrevista).toBe("andamento");
  });
});

describe("applicationFeedback — mensagem clara por etapa", () => {
  it("todas as etapas têm mensagem de feedback não vazia", () => {
    for (const stage of APPLICATION_STAGES) {
      const message = stageFeedback(stage);
      expect(message.length, stage).toBeGreaterThan(10);
    }
  });

  it("mensagens explicam o que aconteceu e o que esperar", () => {
    expect(stageFeedback("inscrito")).toMatch(/enviada/i);
    expect(stageFeedback("triagem")).toMatch(/triagem/i);
    expect(stageFeedback("entrevista")).toMatch(/entrevista/i);
    expect(stageFeedback("aprovado")).toMatch(/aprovad/i);
    expect(stageFeedback("reprovado")).toMatch(/reprovad/i);
  });
});

describe("applicationFeedback — motivo de reprovação amigável (Etapa 4.3)", () => {
  it("todos os motivos do enum R5 têm título e conselho acionáveis", () => {
    for (const reason of REJECTION_REASONS) {
      const feedback = rejectionFeedback(reason);
      expect(feedback.headline.length, reason).toBeGreaterThan(0);
      expect(feedback.advice.length, reason).toBeGreaterThan(10);
    }
  });

  it("conselhos são distintos por motivo (o aluno sabe onde melhorar)", () => {
    const advices = REJECTION_REASONS.map(
      (reason) => rejectionFeedback(reason).advice,
    );
    expect(new Set(advices).size).toBe(REJECTION_REASONS.length);
  });

  it("conselhos específicos para os motivos mais comuns", () => {
    expect(rejectionFeedback("requisitos_obrigatorios").advice).toMatch(
      /compet/i,
    );
    expect(rejectionFeedback("idioma_insuficiente").advice).toMatch(/idioma/i);
    expect(rejectionFeedback("vaga_preenchida").advice).toMatch(
      /preenchida|encerrada/i,
    );
    expect(rejectionFeedback("formacao_incompativel").advice).toMatch(
      /formação|curso/i,
    );
  });

  it("usa o rótulo padronizado do enum como base do título", () => {
    const feedback = rejectionFeedback("perfil_duplicado");
    expect(feedback.headline.length).toBeGreaterThan(0);
    expect(feedback.advice).not.toContain("undefined");
  });
});
