import { describe, expect, it } from "vitest";
import {
  contactReleaseDecision,
  contactProjectionForApplication,
} from "../../src/lib/application";

const base = {
  studentId: "s1",
  email: "maria@unicap.br",
  phone: "+55 81 99999-0000",
  showContactToRecruiters: false,
  consentAccepted: false,
  processAccepted: false,
};

describe("liberação de contato LGPD (S4-3, R6)", () => {
  it("sem autorização geral e sem aceite no processo: contato oculto", () => {
    const decision = contactReleaseDecision(base);
    expect(decision).toEqual({
      contactReleased: false,
      reason: "sem_autorizacao",
    });
  });

  it("autorização geral do aluno libera o contato", () => {
    const decision = contactReleaseDecision({
      ...base,
      showContactToRecruiters: true,
    });
    expect(decision).toEqual({
      contactReleased: true,
      reason: "autorizacao_geral",
    });
  });

  it("aceite em participar do processo libera o contato (mesmo sem autorização geral)", () => {
    const decision = contactReleaseDecision({
      ...base,
      processAccepted: true,
    });
    expect(decision).toEqual({
      contactReleased: true,
      reason: "aceite_no_processo",
    });
  });

  it("flag de consentimento LGPD vigente sozinha NÃO libera contato", () => {
    const decision = contactReleaseDecision({
      ...base,
      consentAccepted: true,
    });
    expect(decision.contactReleased).toBe(false);
  });

  it("negação geral + sem aceite = oculto, mesmo com dados presentes", () => {
    const decision = contactReleaseDecision({
      ...base,
      showContactToRecruiters: false,
      email: "x@y.z",
      phone: "123",
    });
    expect(decision.contactReleased).toBe(false);
  });
});

describe("projeção de contato na candidatura (S4-3, CA 1/CA 2)", () => {
  it("liberado: contato incluído e contactReleased=true", () => {
    const projection = contactProjectionForApplication({
      ...base,
      showContactToRecruiters: true,
    });
    expect(projection.contactReleased).toBe(true);
    expect(projection.email).toBe("maria@unicap.br");
    expect(projection.phone).toBe("+55 81 99999-0000");
  });

  it("não liberado: contato OMITIDO (nunca mascarado) e contactReleased=false", () => {
    const projection = contactProjectionForApplication(base);
    expect(projection.contactReleased).toBe(false);
    expect("email" in projection).toBe(false);
    expect("phone" in projection).toBe(false);
  });

  it("aceite no processo libera na candidatura específica", () => {
    const projection = contactProjectionForApplication({
      ...base,
      processAccepted: true,
    });
    expect(projection.contactReleased).toBe(true);
    expect(projection.email).toBe("maria@unicap.br");
  });

  it("aluno sem e-mail/telefone cadastrados: liberado sem dados", () => {
    const projection = contactProjectionForApplication({
      ...base,
      showContactToRecruiters: true,
      email: undefined,
      phone: undefined,
    });
    expect(projection.contactReleased).toBe(true);
    expect(projection.email).toBeUndefined();
    expect(projection.phone).toBeUndefined();
  });
});
