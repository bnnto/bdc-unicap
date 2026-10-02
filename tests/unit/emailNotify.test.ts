/**
 * [FINAL_UPGRADE Etapa 2] — TDD da regra pura de notificação por e-mail
 * do Kanban: QUANDO notificar (avanço de etapa para Entrevista/Aprovado)
 * e O QUE o e-mail diz. Funções puras em src/lib/emailNotify.ts — a
 * action do Convex só faz o I/O (Resend/mock).
 */
import { describe, expect, it } from "vitest";
import {
  buildStageNotificationEmail,
  shouldNotifyStageAdvance,
} from "../../src/lib/emailNotify";

describe("[FINAL_UPGRADE] shouldNotifyStageAdvance — quando enviar e-mail", () => {
  it("avanço para Entrevista e para Aprovado notificam", () => {
    expect(shouldNotifyStageAdvance("triagem", "entrevista")).toBe(true);
    expect(shouldNotifyStageAdvance("entrevista", "aprovado")).toBe(true);
  });

  it("etapas intermediárias/finalizadas não notificam", () => {
    expect(shouldNotifyStageAdvance("inscrito", "triagem")).toBe(false);
    expect(shouldNotifyStageAdvance("triagem", "reprovado")).toBe(false);
    expect(shouldNotifyStageAdvance("inscrito", "reprovado")).toBe(false);
  });

  it("recuos (desfazer) e movimentos ilegais não notificam", () => {
    expect(shouldNotifyStageAdvance("aprovado", "entrevista")).toBe(false);
    expect(shouldNotifyStageAdvance("entrevista", "triagem")).toBe(false);
    expect(shouldNotifyStageAdvance("reprovado", "inscrito")).toBe(false);
    // mesmo valor (no-op rejeitado pela mutation) nunca notifica
    expect(shouldNotifyStageAdvance("entrevista", "entrevista")).toBe(false);
  });
});

describe("[FINAL_UPGRADE] buildStageNotificationEmail — conteúdo do e-mail", () => {
  it("assunto cita a etapa e a vaga", () => {
    const email = buildStageNotificationEmail({
      studentName: "Maria da Silva",
      jobTitle: "Estágio em Desenvolvimento Web",
      stage: "entrevista",
    });
    expect(email.subject).toContain("Entrevista");
    expect(email.subject).toContain("Estágio em Desenvolvimento Web");
  });

  it("corpo cumprimenta pelo nome, parabeniza e mostra a etapa atual", () => {
    const email = buildStageNotificationEmail({
      studentName: "Maria da Silva",
      jobTitle: "Estágio em Desenvolvimento Web",
      stage: "aprovado",
    });
    expect(email.text).toContain("Maria da Silva");
    expect(email.text).toMatch(/parabéns/i);
    expect(email.text).toContain("Estágio em Desenvolvimento Web");
    expect(email.text).toContain("Aprovado");
  });

  it("text e html coerentes (mesma informação nos dois formatos)", () => {
    const email = buildStageNotificationEmail({
      studentName: "João Pereira",
      jobTitle: "Bolsista PIBIC",
      stage: "entrevista",
    });
    expect(email.html).toContain("João Pereira");
    expect(email.html).toContain("Bolsista PIBIC");
    expect(email.html).toContain("Entrevista");
    expect(email.html).toContain("<");
  });
});
