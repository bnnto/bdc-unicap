/**
 * Auditoria LGPD end-to-end (issue [S8-1], R6/R7) — regra pura.
 *
 * Consolida o checklist exigido pelo CA da issue:
 * - consentimento versionado (R7) — trilha com aceite da versão vigente;
 * - contato nunca exposto sem autorização (R6) — deteção de vazamento
 *   nas exposições reais projetadas pelo servidor;
 * - retificação e exclusão de dados — caminhos do titular suportados;
 * - minimização na divulgação pública (R9 — whitelist de projeção).
 *
 * Sem I/O: usada pela query `lgpd.runAudit` (convex/lgpd.ts) e pela UI
 * do gestor, com os mesmos resultados. TDD — fonte dos testes em
 * tests/unit/lgpdAudit.test.ts.
 */

/** Aceite registrado na trilha de auditoria de consentimentos. */
export type ConsentAuditRecord = {
  termVersion: string;
  acceptedAt: number;
};

/**
 * Exposição de contato observada no servidor (uma por candidatura
 * projetada em `applications.jobBoard`). `email`/`phone` presentes com
 * `contactReleased: false` caracterizam vazamento (R6).
 */
export type ContactExposure = {
  applicationId: string;
  contactReleased: boolean;
  releaseReason: "autorizacao_geral" | "aceite_no_processo" | "sem_autorizacao";
  email?: string;
  phone?: string;
};

export type LgpdChecklistItemId =
  | "consentimento_versionado"
  | "autorizacao_contato"
  | "retificacao"
  | "exclusao"
  | "minimizacao_publica";

export type LgpdChecklistItem = {
  id: LgpdChecklistItemId;
  title: string;
  status: "ok" | "falha";
  detail: string;
};

export type LgpdAuditInput = {
  /** Versão vigente do termo (fonte: consentTerms). */
  currentTermVersion: string;
  /** Trilha de aceites do titular (consents). */
  consents: readonly ConsentAuditRecord[];
  /**
   * Autorização direta do titular para contato (perfil). Usada como
   * evidência quando não há exposições projetadas para auditar.
   */
  contactAuthorization: {
    showContactToRecruiters: boolean;
    processAccepted: boolean;
    email?: string;
    phone?: string;
  };
  /** Exposições reais projetadas pelo servidor (board do recrutador). */
  contactExposures: readonly ContactExposure[];
  /** Retificação: existe caminho do titular para corrigir os dados? */
  rectifySupported: boolean;
  /** Exclusão: existe caminho do titular para apagar os dados? */
  eraseSupported: boolean;
  /** R9 — divulgação pública usa whitelist de projeção? */
  publicDivulgationWhitelist: boolean;
};

export type LgpdChecklistReport = {
  items: LgpdChecklistItem[];
  passed: boolean;
  /** Ids dos itens em falha (vazio quando o checklist passa). */
  failed: LgpdChecklistItemId[];
};

/**
 * R6 — vazamento: dados de contato presentes no payload projetado sem
 * liberação (`contactReleased: false`). A projeção correta OMITTE os
 * campos (nunca os mascara), então qualquer valor presente é exposição.
 */
export function hasUnauthorizedContactExposure(
  exposures: readonly ContactExposure[],
): boolean {
  return exposures.some(
    (e) =>
      !e.contactReleased && (e.email !== undefined || e.phone !== undefined),
  );
}

/**
 * Checklist LGPD consolidado do titular (CA 1 da [S8-1]).
 * Determinístico: `now` é parâmetro para testes; aceites "no futuro"
 * (defasagem de relógio, tolerância de 60s) continuam válidos.
 */
export function buildLgpdChecklist(
  input: LgpdAuditInput,
  now: number,
): LgpdChecklistReport {
  const items: LgpdChecklistItem[] = [];

  // R7 — consentimento versionado: trilha contém a versão vigente.
  const version = input.currentTermVersion.trim();
  const consentActive = input.consents.some(
    (c) => c.termVersion === version && c.acceptedAt <= now + 60_000,
  );
  items.push({
    id: "consentimento_versionado",
    title: "Consentimento versionado (R7)",
    status: consentActive ? "ok" : "falha",
    detail: consentActive
      ? `Trilha de auditoria registra aceite da versão vigente ${version}.`
      : "Sem aceite da versão vigente do Termo de Consentimento LGPD (R7).",
  });

  // R6 — contato nunca exposto sem autorização.
  let contactItem: LgpdChecklistItem;
  if (hasUnauthorizedContactExposure(input.contactExposures)) {
    const leaked = input.contactExposures
      .filter(
        (e) =>
          !e.contactReleased &&
          (e.email !== undefined || e.phone !== undefined),
      )
      .map((e) => e.applicationId);
    contactItem = {
      id: "autorizacao_contato",
      title: "Contato nunca exposto sem autorização (R6)",
      status: "falha",
      detail: `Vazamento de contato em ${leaked.join(", ")} — dados presentes sem liberação do titular.`,
    };
  } else if (input.contactExposures.length > 0) {
    const reasons = [
      ...new Set(
        input.contactExposures
          .filter((e) => e.contactReleased)
          .map((e) => e.releaseReason),
      ),
    ];
    contactItem = {
      id: "autorizacao_contato",
      title: "Contato nunca exposto sem autorização (R6)",
      status: "ok",
      detail:
        (reasons.length > 0
          ? `Exposições respeitam a autorização do titular — liberações por ${reasons.join(", ")}`
          : "Exposições projetadas respeitam a autorização do titular") +
        " — contato omitido quando não liberado (R6).",
    };
  } else {
    const { showContactToRecruiters, processAccepted } =
      input.contactAuthorization;
    const released = showContactToRecruiters || processAccepted;
    contactItem = {
      id: "autorizacao_contato",
      title: "Contato nunca exposto sem autorização (R6)",
      status: "ok",
      detail: released
        ? `Liberação registrada (${
            showContactToRecruiters ? "autorizacao_geral" : "aceite_no_processo"
          }) — exposição apenas com autorização do titular (R6).`
        : "Sem autorização de contato: dados permanecem omitidos nas projeções (R6).",
    };
  }
  items.push(contactItem);

  // Retificação — caminho do titular para corrigir dados (perfil editável).
  items.push({
    id: "retificacao",
    title: "Retificação de dados (art. 18, III)",
    status: input.rectifySupported ? "ok" : "falha",
    detail: input.rectifySupported
      ? "Titular corrige os próprios dados pela edição do perfil (upsertProfile)."
      : "Sem caminho do titular para corrigir dados incompletos ou desatualizados.",
  });

  // Exclusão — caminho do titular para apagar dados (direito ao esquecimento).
  items.push({
    id: "exclusao",
    title: "Exclusão de dados (art. 18, VI)",
    status: input.eraseSupported ? "ok" : "falha",
    detail: input.eraseSupported
      ? "Titular pode solicitar a eliminação dos próprios dados (deleteMyProfile)."
      : "Sem caminho do titular para eliminação dos dados.",
  });

  // R9 — minimização na divulgação pública (whitelist de projeção).
  items.push({
    id: "minimizacao_publica",
    title: "Minimização na divulgação pública (R9)",
    status: input.publicDivulgationWhitelist ? "ok" : "falha",
    detail: input.publicDivulgationWhitelist
      ? "Divulgação pública usa whitelist de campos — nenhum dado sensível é exposto além do necessário."
      : "Divulgação pública sem whitelist de projeção — exposição além do necessário.",
  });

  const failed = items.filter((i) => i.status === "falha").map((i) => i.id);
  return { items, passed: failed.length === 0, failed };
}
