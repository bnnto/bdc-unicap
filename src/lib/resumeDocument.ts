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
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  availability: "estagio" | "integral" | "meio_periodo" | "freelancer";
  /** [REFACTOR_ALUNO Etapa 2] — competências e idiomas do perfil. */
  skills?: string[];
  languages?: Array<{ name: string; level: string }>;
};

export type ResumeDocumentInput = {
  student: ResumeDocStudent | null;
  resume: ResumeDataInput | null;
};

export type ResumeDocument =
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

export const RESUME_UNIVERSITY = "Universidade Católica de Pernambuco";
export const RESUME_ACRONYM = "UNICAP";
export const RESUME_DOC_TITLE = "Currículo Vitae — Portal de Carreiras UNICAP";

const STATUS_LABELS: Record<ResumeDocStudent["status"], string> = {
  ativo: "Aluno ativo",
  egresso: "Egresso",
  inativo: "Inativo",
};

const AVAILABILITY_LABELS: Record<ResumeDocStudent["availability"], string> = {
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
    availabilityLabel: AVAILABILITY_LABELS[student.availability],
  };
}

function slugify(value: string): string {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Nome de arquivo estável: curriculo-<nome>-<curso>-<ano>.pdf */
export function formatResumeFileName(
  fullName: string,
  course: string,
  graduationYear: number,
): string {
  const parts = [
    slugify(fullName),
    slugify(course),
    graduationYear > 0 ? String(graduationYear) : "",
  ].filter((part) => part.length > 0);
  const base = ["curriculo", ...parts].join("-");
  return base === "curriculo" ? "curriculo-unicap.pdf" : `${base}.pdf`;
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

/** Data pt-BR determinística (dd/mm/aaaa) — independe do locale do runtime. */
function formatDateBR(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getFullYear()}`;
}

function safeHref(url: string): string | null {
  return /^https?:\/\//i.test(url) ? url : null;
}

function anchor(label: string, url: string): string {
  const href = safeHref(url);
  if (href === null) return escapeHtml(label);
  return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
}

/**
 * Template HTML do documento (compartilhado pela prévia na tela e pela
 * impressão/PDF). Todo texto dinâmico passa por `escapeHtml` (CA 1 —
 * download fiel e seguro); a identidade UNICAP vem do documento (CA 2).
 *
 * [REFACTOR_ALUNO Etapa 2.3] — o markup envolvido em `.unicap-resume-doc`
 * (as regras do template são descendentes dessa classe — sem o wrapper o
 * PDF saía sem estilo), com cabeçalho em banda bordô (exige
 * `print-color-adjust: exact`) e corpo em grid de duas colunas que o
 * `@media print` preserva — o PDF é o espelho exato da prévia.
 */
export function buildResumeMarkup(
  doc: Extract<ResumeDocument, { ok: true }>,
  options: { generatedAt?: Date } = {},
): string {
  const generatedAt = options.generatedAt ?? new Date();
  const meta = [
    doc.student.semester !== null ? `${doc.student.semester}º semestre` : null,
    doc.availabilityLabel,
    `Matrícula ${doc.student.enrollment}`,
    doc.student.location,
  ]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(" · ");

  const contacts: string[] = [];
  if (doc.student.linkedinUrl !== null) {
    contacts.push(anchor("LinkedIn", doc.student.linkedinUrl));
  }
  if (doc.student.portfolioUrl !== null) {
    contacts.push(anchor("Portfólio", doc.student.portfolioUrl));
  }
  if (doc.resume.links?.github !== undefined) {
    contacts.push(anchor("GitHub", doc.resume.links.github));
  }
  if (doc.resume.links?.lattes !== undefined) {
    contacts.push(anchor("Lattes", doc.resume.links.lattes));
  }

  // Coluna lateral (skills, idiomas, certificações) — vazia ⇒ grid de
  // uma coluna para o documento não abrir um terço em branco.
  const sideSections: string[] = [];
  const skills = doc.student.skills ?? [];
  if (skills.length > 0) {
    sideSections.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Competências & Tecnologias</h2>`,
      `<ul class="unicap-resume-chips">`,
      ...skills.map((skill) => `<li>${escapeHtml(skill)}</li>`),
      `</ul>`,
      `</section>`,
    );
  }
  const languages = doc.student.languages ?? [];
  if (languages.length > 0) {
    sideSections.push(
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
  const certifications = doc.resume.certifications ?? [];
  if (certifications.length > 0) {
    sideSections.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Certificações & Atividades</h2>`,
      `<ul class="unicap-resume-list">`,
      ...certifications.map((item) => `<li>${escapeHtml(item)}</li>`),
      `</ul>`,
      `</section>`,
    );
  }
  const gridClass =
    sideSections.length === 0
      ? "unicap-resume-grid unicap-resume-grid--single"
      : "unicap-resume-grid";

  const parts: string[] = [];
  parts.push(`<div class="unicap-resume-doc">`);
  parts.push(
    `<header class="unicap-resume-header">`,
    `<div>`,
    `<p class="unicap-resume-brand">${escapeHtml(doc.university)}</p>`,
    `<p class="unicap-resume-doc-title">${escapeHtml(doc.docTitle)}</p>`,
    `</div>`,
    `<p class="unicap-resume-acronym" aria-hidden="true">${escapeHtml(doc.acronym)}</p>`,
    `</header>`,
    `<div class="unicap-resume-identity">`,
    `<h1 class="unicap-resume-name">${escapeHtml(doc.student.fullName)}</h1>`,
    `<p class="unicap-resume-headline">${escapeHtml(doc.headline)}</p>`,
    `<p class="unicap-resume-meta">${escapeHtml(meta)}</p>`,
  );
  if (contacts.length > 0) {
    parts.push(`<p class="unicap-resume-contacts">${contacts.join(" · ")}</p>`);
  }
  parts.push(`</div>`, `<div class="${gridClass}">`);

  // Coluna lateral.
  parts.push(`<div class="unicap-resume-col unicap-resume-col-side">`);
  parts.push(...sideSections);
  parts.push(`</div>`);

  // Coluna principal.
  parts.push(`<div class="unicap-resume-col unicap-resume-col-main">`);
  parts.push(
    `<section class="unicap-resume-section">`,
    `<h2 class="unicap-resume-section-title">Resumo</h2>`,
    `<p class="unicap-resume-summary">${escapeHtml(doc.summary)}</p>`,
    `</section>`,
  );

  if (doc.experiences.length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Experiência profissional</h2>`,
    );
    for (const exp of doc.experiences) {
      parts.push(
        `<article class="unicap-resume-item">`,
        `<h3 class="unicap-resume-item-title">${escapeHtml(exp.role)}</h3>`,
        `<p class="unicap-resume-item-sub">${escapeHtml(`${exp.company} · ${exp.period}`)}</p>`,
        `<p class="unicap-resume-item-desc">${escapeHtml(exp.description)}</p>`,
        `</article>`,
      );
    }
    parts.push(`</section>`);
  }

  parts.push(
    `<section class="unicap-resume-section">`,
    `<h2 class="unicap-resume-section-title">Formação e histórico acadêmico</h2>`,
    `<ul class="unicap-resume-list">`,
  );
  for (const entry of doc.academicEntries) {
    parts.push(`<li>${escapeHtml(`${entry.item} (${entry.year})`)}</li>`);
  }
  parts.push(`</ul>`, `</section>`);

  const projectsText = doc.resume.projectsText;
  if (projectsText !== undefined && projectsText.trim().length > 0) {
    parts.push(
      `<section class="unicap-resume-section">`,
      `<h2 class="unicap-resume-section-title">Experiências & Projetos de Extensão</h2>`,
      `<p class="unicap-resume-summary">${escapeHtml(projectsText)}</p>`,
      `</section>`,
    );
  }

  parts.push(`</div>`, `</div>`); // col-main, grid
  parts.push(
    `<p class="unicap-resume-footer">Documento gerado pelo Portal de Carreiras — ${escapeHtml(doc.acronym)} em ${formatDateBR(generatedAt)}.</p>`,
    `</div>`, // wrapper .unicap-resume-doc
  );

  return parts.join("");
}
