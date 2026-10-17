/**
 * Validação pura do perfil de aluno (issue [S1-3], R1).
 * Sem I/O — usada no frontend (formulário) e no backend (upsertProfile).
 */

export const ENROLLMENT_STATUS = ["ativo", "egresso", "inativo"] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUS)[number];

export const AVAILABILITY = [
  "estagio",
  "integral",
  "meio_periodo",
  "freelancer",
] as const;
export type Availability = (typeof AVAILABILITY)[number];

export type StudentProfileInput = {
  fullName: string;
  enrollment: string;
  status: EnrollmentStatus;
  course: string;
  graduationYear: number;
  semester?: number;
  location?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  /** [QUICK_WIN_MULTI] multi-seleção: uma ou mais opções oficiais. */
  availability: Availability[];
};

/** Nome completo: ao menos dois termos com conteúdo. */
export function isValidName(name: string): boolean {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0);
  return parts.length >= 2;
}

/** Matrícula: 6–12 dígitos após remover pontuação/espaços. */
export function isValidEnrollment(enrollment: string): boolean {
  const digits = normalizeEnrollment(enrollment);
  return /^\d{6,12}$/.test(digits);
}

/** Normaliza matrícula para o índice único: apenas dígitos. */
export function normalizeEnrollment(enrollment: string): string {
  return enrollment.replace(/\D+/g, "");
}

/** URL https obrigatória (LGPD/segurança); undefined/vazia é aceitável. */
export function isValidUrl(url: string | undefined): boolean {
  if (url === undefined) return true;
  const trimmed = url.trim();
  if (trimmed.length === 0) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

const CURRENT_YEAR = new Date().getFullYear();

export type ProfileValidation =
  | { ok: true; normalized: StudentProfileInput }
  | { ok: false; errors: string[] };

/**
 * Valida o perfil completo e devolve versão normalizada
 * (matrícula em dígitos, nomes trimados) ou lista de erros agregados.
 */
export function validateStudentProfile(
  input: StudentProfileInput,
): ProfileValidation {
  const errors: string[] = [];

  const fullName = input.fullName.trim();
  if (!isValidName(fullName)) {
    errors.push("Informe o nome completo (nome e sobrenome).");
  }

  if (!isValidEnrollment(input.enrollment)) {
    errors.push("Matrícula inválida: informe de 6 a 12 dígitos.");
  }

  if (!ENROLLMENT_STATUS.includes(input.status)) {
    errors.push("Status de vínculo inválido.");
  }

  const course = input.course.trim();
  if (course.length < 2) {
    errors.push("Informe o curso.");
  }

  if (
    !Number.isInteger(input.graduationYear) ||
    input.graduationYear < 2000 ||
    input.graduationYear > CURRENT_YEAR + 10
  ) {
    errors.push("Ano de formação fora do intervalo plausível.");
  }

  if (
    input.semester !== undefined &&
    (!Number.isInteger(input.semester) ||
      input.semester < 1 ||
      input.semester > 12)
  ) {
    errors.push("Semestre deve estar entre 1 e 12.");
  }

  if (!isValidUrl(input.linkedinUrl)) {
    errors.push("URL do LinkedIn deve usar https://.");
  }
  if (!isValidUrl(input.portfolioUrl)) {
    errors.push("URL de GitHub/Portfólio deve usar https://.");
  }

  // [QUICK_WIN_MULTI] multi-seleção: exige ao menos uma opção, todas da
  // whitelist e sem repetição (o normalizador preserva a ordem).
  if (
    !Array.isArray(input.availability) ||
    input.availability.length === 0 ||
    input.availability.some((entry) => !AVAILABILITY.includes(entry)) ||
    new Set(input.availability).size !== input.availability.length
  ) {
    errors.push("Disponibilidade inválida.");
  }

  if (errors.length > 0) return { ok: false, errors };

  const location = input.location?.trim();

  return {
    ok: true,
    normalized: {
      ...input,
      fullName,
      enrollment: normalizeEnrollment(input.enrollment),
      course,
      semester: input.semester,
      location:
        location !== undefined && location.length > 0 ? location : undefined,
      linkedinUrl: emptyToUndefined(input.linkedinUrl),
      portfolioUrl: emptyToUndefined(input.portfolioUrl),
    },
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed !== undefined && trimmed.length > 0 ? trimmed : undefined;
}
