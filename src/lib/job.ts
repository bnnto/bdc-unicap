/**
 * Validação pura de Vagas (issues [S3-1]/[S3-4]).
 * Compartilhada entre o formulário do recrutador e a mutation Convex
 * (`jobs.upsertJob`) — TDD, sem I/O.
 */
import { canonicalSkill, dictionaryKey, type LanguageLevel } from "./skills";
import type { Availability } from "./studentProfile";

/** Tipos de contrato suportados (CEREBRO.md §4.2 — tabela `jobs`). */
export const CONTRACT_TYPES = ["estagio", "clt", "pj", "temporario"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Máximo de pré-requisitos por vaga (base para R3/R8). */
export const MAX_PREREQS = 15;

/** Tamanho máximo do texto de um requisito descritivo. */
export const PREREQ_TEXT_MAX = 120;

const TITLE_MIN = 5;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 30;
const DESCRIPTION_MAX = 4000;
const SALARY_MAX = 1_000_000;

export type PrerequisiteKind = "skill" | "text";

export type JobPrerequisite = {
  item: string;
  required: boolean;
  kind?: PrerequisiteKind;
};

/** O sistema consegue conferir este pré-requisito contra as competências do aluno? */
export function isVerifiablePrerequisite(p: JobPrerequisite): boolean {
  return p.kind !== "text" && canonicalSkill(p.item) !== null;
}

export type JobInput = {
  title: string;
  description: string;
  prerequisites: JobPrerequisite[];
  contractType: ContractType;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  /** [S3-4] Insumos do matching (R8): idioma mínimo e disponibilidade. */
  requiredLanguage?: { name: string; level: LanguageLevel };
  availability?: Availability;
};

type JobValidation =
  { ok: true; normalized: JobInput } | { ok: false; errors: string[] };

/** BRL inteiro, sem centavos — ex.: 1200 → "R$ 1.200". */
function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR")}`;
}

/**
 * Faixa salarial para exibição no card da vaga:
 * min+max → faixa; só min → "a partir de"; só max → "até"; nenhum →
 * "A combinar".
 */
export function formatSalaryRange(
  salaryMin: number | null,
  salaryMax: number | null,
): string {
  if (salaryMin !== null && salaryMax !== null) {
    return `${formatBRL(salaryMin)} – ${formatBRL(salaryMax)}`;
  }
  if (salaryMin !== null) {
    return `A partir de ${formatBRL(salaryMin)}`;
  }
  if (salaryMax !== null) {
    return `Até ${formatBRL(salaryMax)}`;
  }
  return "A combinar";
}

/** Rótulos amigáveis dos tipos de contrato (contraste AA no template). */
export const CONTRACT_LABELS: Record<ContractType, string> = {
  estagio: "Estágio",
  clt: "CLT",
  pj: "PJ",
  temporario: "Temporário",
};

/** Valida a vaga completa e devolve versão normalizada (trim) ou erros. */
export function validateJob(input: JobInput): JobValidation {
  const errors: string[] = [];

  const title = input.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.push(
      `Título deve ter entre ${TITLE_MIN} e ${TITLE_MAX} caracteres.`,
    );
  }

  const description = input.description.trim();
  if (
    description.length < DESCRIPTION_MIN ||
    description.length > DESCRIPTION_MAX
  ) {
    errors.push(
      `Descrição deve ter entre ${DESCRIPTION_MIN} e ${DESCRIPTION_MAX} caracteres.`,
    );
  }

  if (!CONTRACT_TYPES.includes(input.contractType)) {
    errors.push("Tipo de contrato inválido.");
  }

  const { salaryMin, salaryMax } = input;
  for (const [label, value] of [
    ["Salário mínimo", salaryMin],
    ["Salário máximo", salaryMax],
  ] as const) {
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value <= 0 || value > SALARY_MAX)
    ) {
      errors.push(
        `${label} deve ser um valor inteiro positivo (até ${formatBRL(SALARY_MAX)}).`,
      );
    }
  }
  if (
    salaryMin !== undefined &&
    salaryMax !== undefined &&
    Number.isInteger(salaryMin) &&
    Number.isInteger(salaryMax) &&
    salaryMin > salaryMax
  ) {
    errors.push("Salário mínimo não pode ser maior que o máximo.");
  }

  if (input.prerequisites.length === 0) {
    errors.push("Informe pelo menos um pré-requisito.");
  }
  if (input.prerequisites.length > MAX_PREREQS) {
    errors.push(`Máximo de ${MAX_PREREQS} pré-requisitos.`);
  }
  const prerequisites: JobPrerequisite[] = [];
  const seenSkills = new Set<string>();
  input.prerequisites.forEach((prereq, i) => {
    const n = i + 1;
    const item = prereq.item.trim().replace(/\s+/g, " ");
    if (item.length === 0) {
      errors.push(`Pré-requisito ${n}: informe o item.`);
      return;
    }
    const canonical = canonicalSkill(item);
    // Sem `kind` (chamadores antigos): do dicionário = competência; o resto = texto.
    const kind: PrerequisiteKind =
      prereq.kind ?? (canonical !== null ? "skill" : "text");

    if (kind === "text") {
      if (item.length > PREREQ_TEXT_MAX) {
        errors.push(
          `Pré-requisito ${n}: o texto deve ter até ${PREREQ_TEXT_MAX} caracteres.`,
        );
        return;
      }
      // Descritivo é informativo: nunca obrigatório, nunca bloqueia.
      prerequisites.push({ item, required: false, kind: "text" });
      return;
    }

    if (canonical === null) {
      errors.push(
        `Pré-requisito ${n}: "${item}" não está no dicionário de competências. Escolha da lista ou use "Requisito descritivo".`,
      );
      return;
    }
    const key = dictionaryKey(canonical);
    if (seenSkills.has(key)) {
      errors.push(`Pré-requisito ${n}: "${canonical}" está repetido.`);
      return;
    }
    seenSkills.add(key);
    prerequisites.push({
      item: canonical,
      required: prereq.required === true,
      kind: "skill",
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  // [S3-4] Idioma exigido: nome obrigatório quando informado (nível sempre válido).
  const requiredLanguageName = input.requiredLanguage?.name?.trim() ?? "";
  if (
    input.requiredLanguage !== undefined &&
    requiredLanguageName.length === 0
  ) {
    errors.push("Informe o nome do idioma exigido (ou remova a exigência).");
  }

  if (errors.length > 0) return { ok: false, errors };

  const location = input.location?.trim();

  return {
    ok: true,
    normalized: {
      title,
      description,
      prerequisites,
      contractType: input.contractType,
      salaryMin,
      salaryMax,
      location:
        location !== undefined && location.length > 0 ? location : undefined,
      requiredLanguage:
        input.requiredLanguage !== undefined && requiredLanguageName.length > 0
          ? { name: requiredLanguageName, level: input.requiredLanguage.level }
          : undefined,
      availability: input.availability,
    },
  };
}
