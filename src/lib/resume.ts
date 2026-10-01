/**
 * Validação pura do Currículo Vitae (issue [S2-1]).
 * Compartilhada entre o formulário e a mutation `saveResumeData` — TDD.
 */

export const MAX_EXPERIENCES = 10;
export const MAX_ACADEMIC = 15;
export const HEADLINE_MIN = 10;
export const HEADLINE_MAX = 120;
export const SUMMARY_MIN = 30;
export const SUMMARY_MAX = 1000;
/** [REFACTOR_ALUNO Etapa 2] — novos blocos do construtor de currículo. */
export const PROJECTS_TEXT_MAX = 2000;
export const MAX_CERTIFICATIONS = 20;
export const MAX_LINK_LENGTH = 200;

const CURRENT_YEAR = new Date().getFullYear();

export type ExperienceEntry = {
  company: string;
  role: string;
  period: string;
  description: string;
};

export type AcademicEntry = {
  item: string;
  year: number;
};

/** Links profissionais (bloco 3): GitHub e Lattes (opcionais). */
export type ResumeLinks = {
  github?: string;
  lattes?: string;
};

export type ResumeDataInput = {
  headline: string;
  summary: string;
  experiences: ExperienceEntry[];
  academicHistory: AcademicEntry[];
  /** Bloco 3 — links profissionais (opcional, ausente em CVs antigos). */
  links?: ResumeLinks;
  /** Bloco 6 — experiências/projetos de extensão em texto livre. */
  projectsText?: string;
  /** Bloco 7 — certificações e atividades complementares. */
  certifications?: string[];
};

export type ResumeValidation =
  { ok: true; normalized: ResumeDataInput } | { ok: false; errors: string[] };

/** Valida o CV completo e devolve versão normalizada (trim) ou erros. */
export function validateResumeData(input: ResumeDataInput): ResumeValidation {
  const errors: string[] = [];

  const headline = input.headline.trim();
  if (headline.length < HEADLINE_MIN || headline.length > HEADLINE_MAX) {
    errors.push(
      `Headline deve ter entre ${HEADLINE_MIN} e ${HEADLINE_MAX} caracteres.`,
    );
  }

  const summary = input.summary.trim();
  if (summary.length < SUMMARY_MIN || summary.length > SUMMARY_MAX) {
    errors.push(
      `Resumo deve ter entre ${SUMMARY_MIN} e ${SUMMARY_MAX} caracteres.`,
    );
  }

  if (input.experiences.length > MAX_EXPERIENCES) {
    errors.push(`Máximo de ${MAX_EXPERIENCES} experiências.`);
  }
  const experiences: ExperienceEntry[] = [];
  input.experiences.forEach((exp, i) => {
    const company = exp.company.trim();
    const role = exp.role.trim();
    const period = exp.period.trim();
    const description = exp.description.trim();
    if (company.length === 0) {
      errors.push(`Experiência ${i + 1}: informe a Empresa.`);
    }
    if (role.length === 0) {
      errors.push(`Experiência ${i + 1}: informe o Cargo.`);
    }
    if (period.length === 0) {
      errors.push(`Experiência ${i + 1}: informe o Período.`);
    }
    if (company.length > 0 && role.length > 0 && period.length > 0) {
      experiences.push({
        company,
        role,
        period,
        description: description.length > 0 ? description : "Sem descrição.",
      });
    }
  });

  if (input.academicHistory.length > MAX_ACADEMIC) {
    errors.push(`Máximo de ${MAX_ACADEMIC} itens no histórico acadêmico.`);
  }
  const academicHistory: AcademicEntry[] = [];
  input.academicHistory.forEach((entry, i) => {
    const item = entry.item.trim();
    const year = entry.year;
    if (item.length === 0) {
      errors.push(`Histórico ${i + 1}: informe o item.`);
    }
    if (!Number.isInteger(year) || year < 2000 || year > CURRENT_YEAR + 10) {
      errors.push(`Histórico ${i + 1}: ano fora do intervalo plausível.`);
    }
    if (
      item.length > 0 &&
      Number.isInteger(year) &&
      year >= 2000 &&
      year <= CURRENT_YEAR + 10
    ) {
      academicHistory.push({ item, year });
    }
  });

  const optional = normalizeOptionalBlocks(input, errors);

  return errors.length > 0
    ? { ok: false, errors }
    : {
        ok: true,
        normalized: {
          headline,
          summary,
          experiences,
          academicHistory,
          ...optional,
        },
      };
}

/**
 * Normaliza os blocos NOVOS do construtor (Etapa 2): trim, descarte de
 * vazios e limites. Ausentes no input (CVs antigos) → permanecem
 * ausentes no output, sem inventar dados.
 */
function normalizeOptionalBlocks(
  input: ResumeDataInput,
  errors: string[],
): Pick<ResumeDataInput, "links" | "projectsText" | "certifications"> {
  const optional: Pick<
    ResumeDataInput,
    "links" | "projectsText" | "certifications"
  > = {};

  if (input.links !== undefined) {
    const links: ResumeLinks = {};
    const github = (input.links.github ?? "").trim();
    const lattes = (input.links.lattes ?? "").trim();
    if (github.length > 0) {
      if (github.length > MAX_LINK_LENGTH) {
        errors.push(`GitHub: máximo de ${MAX_LINK_LENGTH} caracteres.`);
      } else {
        links.github = github;
      }
    }
    if (lattes.length > 0) {
      if (lattes.length > MAX_LINK_LENGTH) {
        errors.push(`Lattes: máximo de ${MAX_LINK_LENGTH} caracteres.`);
      } else {
        links.lattes = lattes;
      }
    }
    if (Object.keys(links).length > 0) optional.links = links;
  }

  if (input.projectsText !== undefined) {
    const text = input.projectsText.trim();
    if (text.length > PROJECTS_TEXT_MAX) {
      errors.push(
        `Projetos de extensão: máximo de ${PROJECTS_TEXT_MAX} caracteres.`,
      );
    } else if (text.length > 0) {
      optional.projectsText = text;
    }
  }

  if (input.certifications !== undefined) {
    const certifications = input.certifications
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
    if (certifications.length > MAX_CERTIFICATIONS) {
      errors.push(`Máximo de ${MAX_CERTIFICATIONS} certificações.`);
    } else if (certifications.length > 0) {
      optional.certifications = certifications;
    }
  }

  return optional;
}
