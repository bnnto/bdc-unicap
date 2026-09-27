import { describe, expect, it } from "vitest";
import {
  buildLgpdChecklist,
  hasUnauthorizedContactExposure,
  type ContactExposure,
  type LgpdAuditInput,
} from "../../src/lib/lgpdAudit";

const NOW = Date.parse("2026-09-25T12:00:00Z");

const RELEASED: ContactExposure = {
  applicationId: "app-1",
  contactReleased: true,
  releaseReason: "aceite_no_processo",
  email: "maria@unicap.br",
  phone: "+55 81 91234-0000",
};

const HIDDEN: ContactExposure = {
  applicationId: "app-2",
  contactReleased: false,
  releaseReason: "sem_autorizacao",
};

/** Entrada-base: titular com aceite vigente e nenhuma exposição indevida. */
function baseInput(overrides: Partial<LgpdAuditInput> = {}): LgpdAuditInput {
  return {
    currentTermVersion: "v1.0",
    consents: [{ termVersion: "v1.0", acceptedAt: NOW - 1000 }],
    contactAuthorization: {
      showContactToRecruiters: false,
      processAccepted: false,
      email: "maria@unicap.br",
      phone: "+55 81 91234-0000",
    },
    contactExposures: [],
    rectifySupported: true,
    eraseSupported: true,
    publicDivulgationWhitelist: true,
    ...overrides,
  };
}

describe("checklist LGPD — consentimento versionado (S8-1, R7)", () => {
  it("ok quando há aceite da versão vigente na trilha", () => {
    const report = buildLgpdChecklist(baseInput(), NOW);
    const item = report.items.find((i) => i.id === "consentimento_versionado");
    expect(item?.status).toBe("ok");
    expect(item?.detail).toContain("v1.0");
  });

  it("falha sem nenhum aceite registrado", () => {
    const report = buildLgpdChecklist(baseInput({ consents: [] }), NOW);
    const item = report.items.find((i) => i.id === "consentimento_versionado");
    expect(item?.status).toBe("falha");
    expect(item?.detail).toContain("R7");
  });

  it("falha quando só há aceite de versão antiga do termo", () => {
    const report = buildLgpdChecklist(
      baseInput({
        consents: [{ termVersion: "v0.9", acceptedAt: NOW - 5000 }],
      }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "consentimento_versionado");
    expect(item?.status).toBe("falha");
  });
});

describe("checklist LGPD — contato nunca exposto sem autorização (S8-1, R6)", () => {
  it("ok quando liberação existe com autorização registrada (aceite no processo)", () => {
    const report = buildLgpdChecklist(
      baseInput({ contactExposures: [RELEASED] }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "autorizacao_contato");
    expect(item?.status).toBe("ok");
    expect(item?.detail).toContain("aceite_no_processo");
  });

  it("ok quando exposição sem autorização vem sem contato (omitido, nunca mascarado)", () => {
    const report = buildLgpdChecklist(
      baseInput({ contactExposures: [RELEASED, HIDDEN] }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "autorizacao_contato");
    expect(item?.status).toBe("ok");
    expect(item?.detail).toContain("R6");
  });

  it("FALHA ao detectar vazamento: contato presente sem liberação (R6)", () => {
    const vazamento: ContactExposure = {
      applicationId: "app-3",
      contactReleased: false,
      releaseReason: "sem_autorizacao",
      email: "maria@unicap.br",
    };
    expect(hasUnauthorizedContactExposure([vazamento])).toBe(true);
    const report = buildLgpdChecklist(
      baseInput({ contactExposures: [vazamento] }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "autorizacao_contato");
    expect(item?.status).toBe("falha");
    expect(item?.detail).toContain("Vazamento");
  });

  it("hasUnauthorizedContactExposure ignora telefone indefinido e lista vazia", () => {
    expect(hasUnauthorizedContactExposure([])).toBe(false);
    expect(hasUnauthorizedContactExposure([HIDDEN, RELEASED])).toBe(false);
    expect(
      hasUnauthorizedContactExposure([
        { ...HIDDEN, phone: "+55 81 91234-0000" },
      ]),
    ).toBe(true);
  });

  it("sem exposições, usa a autorização direta do titular como evidência (R6)", () => {
    const report = buildLgpdChecklist(
      baseInput({
        contactAuthorization: {
          showContactToRecruiters: true,
          processAccepted: false,
          email: "maria@unicap.br",
        },
      }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "autorizacao_contato");
    expect(item?.status).toBe("ok");
    expect(item?.detail).toContain("autorizacao_geral");
  });
});

describe("checklist LGPD — direitos do titular (S8-1)", () => {
  it("retificação ok quando o caminho de edição é suportado", () => {
    const report = buildLgpdChecklist(
      baseInput({ rectifySupported: true }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "retificacao");
    expect(item?.status).toBe("ok");
  });

  it("retificação falha quando não há caminho de edição do titular", () => {
    const report = buildLgpdChecklist(
      baseInput({ rectifySupported: false }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "retificacao");
    expect(item?.status).toBe("falha");
  });

  it("exclusão ok quando o caminho de exclusão é suportado", () => {
    const report = buildLgpdChecklist(baseInput({ eraseSupported: true }), NOW);
    const item = report.items.find((i) => i.id === "exclusao");
    expect(item?.status).toBe("ok");
  });

  it("exclusão falha quando não há caminho de exclusão", () => {
    const report = buildLgpdChecklist(
      baseInput({ eraseSupported: false }),
      NOW,
    );
    const item = report.items.find((i) => i.id === "exclusao");
    expect(item?.status).toBe("falha");
  });

  it("minimização na divulgação pública depende da whitelist (R9)", () => {
    const ok = buildLgpdChecklist(
      baseInput({ publicDivulgationWhitelist: true }),
      NOW,
    );
    expect(ok.items.find((i) => i.id === "minimizacao_publica")?.status).toBe(
      "ok",
    );

    const fail = buildLgpdChecklist(
      baseInput({ publicDivulgationWhitelist: false }),
      NOW,
    );
    const item = fail.items.find((i) => i.id === "minimizacao_publica");
    expect(item?.status).toBe("falha");
  });
});

describe("checklist LGPD — resultado consolidado (S8-1)", () => {
  it("passed=true e failed vazio quando todos os itens estão ok", () => {
    const report = buildLgpdChecklist(baseInput(), NOW);
    expect(report.passed).toBe(true);
    expect(report.failed).toEqual([]);
    expect(report.items.length).toBeGreaterThanOrEqual(5);
  });

  it("passed=false e failed lista os ids dos itens em falha", () => {
    const report = buildLgpdChecklist(
      baseInput({ eraseSupported: false, consents: [] }),
      NOW,
    );
    expect(report.passed).toBe(false);
    expect(report.failed).toEqual(["consentimento_versionado", "exclusao"]);
  });
});
