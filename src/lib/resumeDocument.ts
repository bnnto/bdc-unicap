/**
 * Montagem do documento de Currículo Vitae (issue [S2-2]).
 * Regra pura (TDD) compartilhada entre o template imprimível e testes:
 * garante download fiel aos dados do formulário (CA 1) e identidade
 * institucional UNICAP (CA 2) sem depender de libs pesadas de PDF —
 * a impressão em PDF é feita pelo navegador via `window.print()`.
 */
import type { ResumeDataInput } from "./resume";

export type ResumeDocStudent = {
  fullName: string;
  enrollment: string;
  course: string;
  status: "ativo" | "egresso" | "inativo";
  graduationYear: number;
  semester: number | null;
  location: string | null;
  /** [CV_LAYOUT_V2] telefone (students.phone) e e-mail (users.email). */
  phone?: string | null;
  email?: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  /** [QUICK_WIN_MULTI] multi-seleção (PDF junta com " · "). */
  availability: Array<"estagio" | "integral" | "meio_periodo" | "freelancer">;
  /** [REFACTOR_ALUNO Etapa 2] — competências e idiomas do perfil. */
  skills?: string[];
  languages?: Array<{ name: string; level: string }>;
};

type ResumeDocumentInput = {
  student: ResumeDocStudent | null;
  resume: ResumeDataInput | null;
};

type ResumeDocument =
  | {
      ok: true;
      university: string;
      acronym: string;
      docTitle: string;
      student: ResumeDocStudent;
      resume: ResumeDataInput;
      headline: string;
      summary: string;
      experiences: ResumeDataInput["experiences"];
      academicHistory: ResumeDataInput["academicHistory"];
      /** Histórico + fallback da graduação (quando o aluno não a listou). */
      academicEntries: Array<{ item: string; year: number }>;
      statusLabel: string;
      availabilityLabel: string;
    }
  | { ok: false; reason: "perfil_inexistente" | "curriculo_inexistente" };

const RESUME_UNIVERSITY = "Universidade Católica de Pernambuco";
const RESUME_ACRONYM = "UNICAP";
const RESUME_DOC_TITLE = "Currículo Vitae — Banco de Currículos UNICAP";

const STATUS_LABELS: Record<ResumeDocStudent["status"], string> = {
  ativo: "Aluno ativo",
  egresso: "Egresso",
  inativo: "Inativo",
};

const AVAILABILITY_LABELS: Record<
  "estagio" | "integral" | "meio_periodo" | "freelancer",
  string
> = {
  estagio: "Estágio",
  integral: "Período integral",
  meio_periodo: "Meio período",
  freelancer: "Freelancer",
};

/** Níveis de idioma em texto legível no documento (enum → label). */
const LANGUAGE_LABELS: Record<string, string> = {
  basico: "Básico",
  intermediario: "Intermediário",
  avancado: "Avançado",
  fluente: "Fluente",
  nativo: "Nativo",
};

/** Remove acentos e caixa para comparações tolerantes (ex.: "Graduação"). */
function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Monta o documento do CV ou explica por que não é possível gerá-lo. */
export function buildResumeDocument(
  input: ResumeDocumentInput,
): ResumeDocument {
  const { student, resume } = input;
  if (student === null) {
    return { ok: false, reason: "perfil_inexistente" };
  }
  if (resume === null) {
    return { ok: false, reason: "curriculo_inexistente" };
  }

  // Fallback fiel: a graduação (curso + ano de conclusão do cadastro) entra
  // no histórico acadêmico quando o aluno não a listou explicitamente.
  const hasGraduationEntry = resume.academicHistory.some((entry) =>
    normalizeText(entry.item).includes("graduacao"),
  );
  const academicEntries = hasGraduationEntry
    ? [...resume.academicHistory]
    : [
        ...resume.academicHistory,
        {
          item: `Graduação em ${student.course} — ${RESUME_ACRONYM}`,
          year: student.graduationYear,
        },
      ];

  return {
    ok: true,
    university: RESUME_UNIVERSITY,
    acronym: RESUME_ACRONYM,
    docTitle: RESUME_DOC_TITLE,
    student,
    resume,
    headline: resume.headline,
    summary: resume.summary,
    experiences: resume.experiences,
    academicHistory: resume.academicHistory,
    academicEntries,
    statusLabel: STATUS_LABELS[student.status],
    availabilityLabel: student.availability
      .map((entry) => AVAILABILITY_LABELS[entry])
      .join(" · "),
  };
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nome de arquivo estável: curriculo-<três primeiros nomes>.pdf */
export function formatResumeFileName(
  fullName: string,
  _course?: string,
  _graduationYear?: number,
): string {
  const nameSlug = slugify(fullName)
    .split("-")
    .filter((part) => part.length > 0)
    .slice(0, 3)
    .join("-");
  return nameSlug.length > 0
    ? `curriculo-${nameSlug}.pdf`
    : "curriculo-unicap.pdf";
}

/** Escapa texto dinâmico antes de interpolá-lo no template HTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

function anchor(label: string, url: string): string {
  const href = safeHref(url);
  if (href === null) return escapeHtml(label);
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

/** Formata telefone BR como "+55 (81) 99999-9999". Se não reconhecer, devolve o original. */
export function formatPhoneBR(value: string): string {
  let digits = value.replace(/\D/g, "");
  // Remove o código do país se o aluno já digitou (55 + DDD + número).
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2);
  }
  if (digits.length === 11) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+55 (${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value.trim();
}

/**
 * Template HTML do documento (compartilhado pela prévia na tela e pela
 * impressão/PDF). Todo texto dinâmico passa por `escapeHtml` (CA 1 —
 * download fiel e seguro); a identidade UNICAP segue na paleta bordô/dourado
 * (CA 2).
 *
 * [CV_LAYOUT_V2] Layout de coluna única, sem banda de cabeçalho. Ordem:
 * Nome → Headline → contatos (local · telefone / e-mail · LinkedIn …) →
 * Resumo → Competências → Experiência → Projetos e Atividades → Formação →
 * Idiomas. Seções sem conteúdo simplesmente não aparecem. O markup fica
 * envolvido em `.unicap-resume-doc` (as regras do template são descendentes
 * dessa classe) e o `@media print` o preserva — PDF = espelho da prévia.
 */
export function buildResumeMarkup(
  doc: Extract<ResumeDocument, { ok: true }>,
  // Mantido por compatibilidade: o rodapé com data foi removido do layout.
  _options: { generatedAt?: Date } = {},
): string {
  const clean = (value: string | null | undefined): string =>
    value === null || value === undefined ? "" : value.trim();

  // Linha 1: LOCAL · TELEFONE.
  const phone = clean(doc.student.phone);
  const locationPhone = [
    clean(doc.student.location),
    phone.length > 0 ? formatPhoneBR(phone) : "",
  ]

  // Linha 2: E-MAIL · LINKEDIN (+ demais links do perfil, se existirem).
  const emailLinks: string[] = [];
  const email = clean(doc.student.email);
  if (email.length > 0) {
    emailLinks.push(
      `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`,
    );
  }
  if (doc.student.linkedinUrl) {
    emailLinks.push(anchor("LinkedIn", doc.student.linkedinUrl));
  }
  if (doc.student.portfolioUrl) {
    emailLinks.push(anchor("Portfólio", doc.student.portfolioUrl));
  }
  if (doc.resume.links?.github) {
    emailLinks.push(anchor("GitHub", doc.resume.links.github));
  }
  if (doc.resume.links?.lattes) {
    emailLinks.push(anchor("Lattes", doc.resume.links.lattes));
  }

  const parts: string[] = [];
  parts.push(`<div class="unicap-resume-doc">`);

  // Identidade.
  parts.push(
    `<header class="unicap-resume-identity">`,
    `<h1 class="unicap-resume-name">${escapeHtml(doc.student.fullName)}</h1>`,
  );
  if (clean(doc.headline).length > 0) {
    parts.push(
      `<p class="unicap-resume-headline">${escapeHtml(doc.headline)}</p>`,
    );
  }
  if (locationPhone.length > 0) {
    parts.push(
      `<p class="unicap-resume-contacts">${locationPhone.join(" · ")}</p>`,
    );
  }
  if (emailLinks.length > 0) {
    parts.push(
      `<p class="unicap-resume-contacts">${emailLinks.join(" · ")}</p>`,
    );
  }
  parts.push(`</header>`);

  // Resumo.
  if (clean(doc.summary).length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Resumo</h2>`,
      `<p class="unicap-resume-summary">${escapeHtml(doc.summary)}</p>`,
      `</section>`,
    );
  }

  // Competências.
  const skills = doc.student.skills ?? [];
  if (skills.length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Competências</h2>`,
      `<ul class="unicap-resume-chips">`,
      ...skills.map((skill) => `<li>${escapeHtml(skill)}</li>`),
      `</ul>`,
      `</section>`,
    );
  }

  // Experiência — só aparece quando o aluno tem experiências.
  if (doc.experiences.length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Experiência</h2>`,
    );
    for (const exp of doc.experiences) {
      parts.push(
        `<article class="unicap-resume-item">`,
        `<h3 class="unicap-resume-item-title">${escapeHtml(exp.role)} <span class="unicap-resume-item-sub">${escapeHtml(`· ${exp.company} · ${exp.period}`)}</span></h3>`,
        `<p class="unicap-resume-item-desc">${escapeHtml(exp.description)}</p>`,
        `</article>`,
      );
    }
    parts.push(`</section>`);
  }

  // Projetos e Atividades = projetos de extensão (texto) + certificações/atividades.
  const projectsText = clean(doc.resume.projectsText);
  const certifications = doc.resume.certifications ?? [];
  if (projectsText.length > 0 || certifications.length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Projetos e Atividades</h2>`,
    );
    if (projectsText.length > 0) {
      parts.push(
        `<p class="unicap-resume-summary unicap-resume-projects">${escapeHtml(projectsText)}</p>`,
      );
    }
    if (certifications.length > 0) {
      parts.push(
        `<ul class="unicap-resume-list">`,
        ...certifications.map((item) => `<li>${escapeHtml(item)}</li>`),
        `</ul>`,
      );
    }
    parts.push(`</section>`);
  }

  // Formação.
  if (doc.academicEntries.length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Formação</h2>`,
      `<ul class="unicap-resume-list">`,
      ...doc.academicEntries.map(
        (entry) => `<li>${escapeHtml(`${entry.item} (${entry.year})`)}</li>`,
      ),
      `</ul>`,
      `</section>`,
    );
  }

  // Idiomas.
  const languages = doc.student.languages ?? [];
  if (languages.length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Idiomas</h2>`,
      `<ul class="unicap-resume-list">`,
      ...languages.map(
        (language) =>
          `<li>${escapeHtml(
            `${language.name} — ${LANGUAGE_LABELS[language.level] ?? language.level}`,
          )}</li>`,
      ),
      `</ul>`,
      `</section>`,
    );
  }

  parts.push(`</div>`); // wrapper .unicap-resume-doc
  return parts.join("");
}