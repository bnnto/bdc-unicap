/**
 * Regras puras de visibilidade e contato (issue [S1-4], R2 e R6).
 * Aplicadas no servidor (projeção segura das queries) e no frontend
 * (toggles e textos explicativos). Funções puras, determinísticas — TDD.
 */

/** R2 — escolha do aluno sobre onde o perfil aparece. */
export const VISIBILITY_OPTIONS = ["publico", "somente_candidaturas"] as const;
export type StudentVisibility = (typeof VISIBILITY_OPTIONS)[number];

type VisibilitySubject = {
  /** R1 — apenas ativos/egressos participam das buscas. */
  status: "ativo" | "egresso" | "inativo";
  visibility: StudentVisibility;
  /** R6 — autorização geral de contato para recrutadores. */
  showContactToRecruiters: boolean;
  /** R6 — vagas onde o aluno liberou contato (candidatura aceita). */
  contactReleasedTo: readonly string[];
};

/**
 * R2 — o perfil aparece para recrutadores quando:
 * (a) vínculo válido (R1) e visibilidade "publico"; ou
 * (b) vínculo válido e há candidatura ativa na vaga informada
 *     (`jobId` null = busca geral do banco de talentos).
 */
export function canRecruiterSeeProfile(
  subject: VisibilitySubject,
  jobId: string | null,
): boolean {
  if (subject.status === "inativo") return false; // R1
  if (subject.visibility === "publico") return true;
  return jobId !== null && subject.contactReleasedTo.includes(jobId);
}

/**
 * R6 — contato visível apenas com autorização do aluno (flag geral ou
 * liberação na vaga) e somente se o perfil já estiver visível (R2).
 */
export function canRecruiterSeeContact(
  subject: VisibilitySubject,
  jobId: string | null,
): boolean {
  if (!canRecruiterSeeProfile(subject, jobId)) return false;
  return (
    subject.showContactToRecruiters ||
    (jobId !== null && subject.contactReleasedTo.includes(jobId))
  );
}

/** Campos de contato — presentes apenas quando autorizado. */
type ContactFields = {
  email?: string;
  phone?: string;
};

type RecruitableView = ContactFields & {
  fullName: string;
  course: string;
  visibility: StudentVisibility;
};

/**
 * Projeção segura: monta o objeto que o recrutador pode ver.
 * Perfil invisível → null (nem dados básicos vazam); contato omitido
 * (não mascarado) quando não autorizado, para nunca chegar ao cliente.
 */
export function recruiterProjection<
  T extends VisibilitySubject & {
    fullName: string;
    course: string;
  } & ContactFields,
>(subject: T, jobId: string | null): RecruitableView | null {
  if (!canRecruiterSeeProfile(subject, jobId)) return null;
  const showContact = canRecruiterSeeContact(subject, jobId);
  return {
    fullName: subject.fullName,
    course: subject.course,
    visibility: subject.visibility,
    ...(showContact ? { email: subject.email, phone: subject.phone } : {}),
  };
}
