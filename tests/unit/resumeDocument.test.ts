import { assert, describe, expect, it } from "vitest";
import {
  buildResumeDocument,
  buildResumeMarkup,
  escapeHtml,
  formatResumeFileName,
  type ResumeDocStudent,
} from "../../src/lib/resumeDocument";
import type { ResumeDataInput } from "../../src/lib/resume";

type DocumentInput = Parameters<typeof buildResumeDocument>[0];

const ANO_INGRESSO = 2021;
const ANO_MARATONA = 2023;
const ANO_FORMATURA = 2026;
const ANO_FORMATURA_FALLBACK = 2024;
const ANO_FORMATURA_EGRESSO = 2025;
const SEMESTRE_ATUAL = 8;

const GRADUACAO_CC = "Graduação em Ciência da Computação — UNICAP";

const resume: ResumeDataInput = {
  headline: "Estudante de Ciência da Computação focado em backend",
  summary:
    "Aluno do 8º semestre com experiência em estágio de desenvolvimento web e projetos de extensão em dados.",
  experiences: [
    {
      company: "Acme Ltda",
      role: "Estagiário de Desenvolvimento",
      period: "2024.2 - 2025.1",
      description: "Manutenção de APIs internas em Node.js.",
    },
  ],
  academicHistory: [
    { item: "Ingresso no curso de CC", year: ANO_INGRESSO },
    { item: "Premiação na maratona de programação", year: ANO_MARATONA },
  ],
};

const student: ResumeDocStudent = {
  fullName: "Maria da Silva",
  enrollment: "1234567",
  course: "Ciência da Computação",
  status: "ativo",
  graduationYear: ANO_FORMATURA,
  semester: SEMESTRE_ATUAL,
  location: "Recife/PE",
  linkedinUrl: "https://www.linkedin.com/in/maria-silva",
  portfolioUrl: null,
  availability: ["estagio"],
};

const input = { student, resume };

/** Monta o documento e falha o teste se não for válido (estreita o tipo). */
function buildOkDoc(args: DocumentInput) {
  const doc = buildResumeDocument(args);
  assert(doc.ok, "documento deveria ser válido (ok === true)");
  return doc;
}

/** Monta o documento válido e devolve o HTML correspondente. */
function buildMarkup(args: DocumentInput, options?: { generatedAt?: Date }) {
  return buildResumeMarkup(buildOkDoc(args), options);
}

describe("documento do Currículo Vitae (S2-2)", () => {
  it("preserva os dados do aluno e do currículo sem alterá-los", () => {
    expect(buildOkDoc(input)).toMatchObject({ student, resume });
  });

  it("monta identidade institucional UNICAP", () => {
    expect(buildOkDoc(input)).toMatchObject({
      university: "Universidade Católica de Pernambuco",
      acronym: "UNICAP",
      docTitle: "Currículo Vitae — Banco de Currículos UNICAP",
    });
  });

  it.each([
    ["sem perfil do aluno", { ...input, student: null }, "perfil_inexistente"],
    [
      "sem currículo salvo",
      { ...input, resume: null },
      "curriculo_inexistente",
    ],
    [
      "sem perfil e sem currículo",
      { student: null, resume: null },
      "perfil_inexistente",
    ],
  ] satisfies Array<[string, DocumentInput, string]>)(
    "exige perfil e currículo (sem placeholders): %s",
    (_cenario, args, reason) => {
      expect(buildResumeDocument(args)).toEqual({ ok: false, reason });
    },
  );

  it("headline e resumo aparecem sempre — download fiel (CA 1)", () => {
    expect(buildOkDoc(input)).toMatchObject({
      headline: resume.headline,
      summary: resume.summary,
    });
  });

  it("lista experiências e histórico na ordem do formulário", () => {
    expect(buildOkDoc(input)).toMatchObject({
      experiences: resume.experiences,
      academicHistory: resume.academicHistory,
    });
  });

  it("tolera perfil mínimo: campos opcionais viram null, sem inventar dados", () => {
    const minimal: ResumeDocStudent = {
      fullName: "João Pereira",
      enrollment: "7654321",
      course: "Direção",
      status: "egresso",
      graduationYear: ANO_FORMATURA_EGRESSO,
      semester: null,
      location: null,
      linkedinUrl: null,
      portfolioUrl: null,
      availability: ["freelancer"],
    };
    const doc = buildOkDoc({ student: minimal, resume });
    expect(doc.student).toMatchObject({
      location: null,
      linkedinUrl: null,
      semester: null,
    });
  });

  it.each([
    ["ativo", ["estagio"], "Aluno ativo", "Estágio"],
    ["egresso", ["integral"], "Egresso", "Período integral"],
  ] satisfies Array<
    [
      ResumeDocStudent["status"],
      ResumeDocStudent["availability"],
      string,
      string,
    ]
  >)(
    "labels amigáveis no template para status %s",
    (status, availability, statusLabel, availabilityLabel) => {
      const doc = buildOkDoc({
        student: { ...student, status, availability },
        resume,
      });
      expect(doc).toMatchObject({ statusLabel, availabilityLabel });
    },
  );

  it("inclui fallback da graduação no histórico acadêmico", () => {
    const doc = buildOkDoc({
      student: { ...student, graduationYear: ANO_FORMATURA_FALLBACK },
      resume,
    });
    expect(doc.academicEntries).toEqual([
      ...resume.academicHistory,
      { item: GRADUACAO_CC, year: ANO_FORMATURA_FALLBACK },
    ]);
  });

  it("não duplica fallback quando o aluno já listou a graduação", () => {
    const doc = buildOkDoc({
      student: { ...student, graduationYear: ANO_FORMATURA_FALLBACK },
      resume: {
        ...resume,
        experiences: [],
        academicHistory: [{ item: GRADUACAO_CC, year: ANO_FORMATURA_FALLBACK }],
      },
    });
    expect(doc.academicEntries).toEqual([
      { item: GRADUACAO_CC, year: ANO_FORMATURA_FALLBACK },
    ]);
  });
});

describe("nome de arquivo do currículo (S2-2)", () => {
  it.each([
    [
      "gera arquivo slugificado com os primeiros nomes",
      "Maria da Silva",
      "Ciência da Computação",
      ANO_FORMATURA,
      "curriculo-maria-da-silva.pdf",
    ],
    [
      "remove acentos e caracteres especiais",
      "José  Ébano Júnior",
      "Administração",
      ANO_FORMATURA_EGRESSO,
      "curriculo-jose-ebano-junior.pdf",
    ],
  ])("%s", (_cenario, nome, curso, ano, esperado) => {
    expect(formatResumeFileName(nome, curso, ano)).toBe(esperado);
  });

  it("tolera campos vazios com fallback mínimo", () => {
    expect(formatResumeFileName("")).toBe("curriculo-unicap.pdf");
  });
});

describe("template HTML do currículo (S2-2)", () => {
  it.each([
    [
      `<img src=x onerror="alert('x')">`,
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
    ],
    ["A & B", "A &amp; B"],
  ])("escapeHtml neutraliza markup: %s", (entrada, esperado) => {
    expect(escapeHtml(entrada)).toBe(esperado);
  });

  describe("cabeçalho institucional e seções", () => {
    const markup = buildMarkup(input);

    it.each([
      "unicap-resume-doc",
      resume.headline,
      resume.summary,
      "Acme Ltda",
      `Ingresso no curso de CC (${ANO_INGRESSO})`,
      `${GRADUACAO_CC} (${ANO_FORMATURA})`,
    ])("contém %s", (fragmento) => {
      expect(markup).toContain(fragmento);
    });
  });

  describe("escape de todo texto dinâmico vindo do aluno", () => {
    const markup = buildMarkup({
      student: { ...student, fullName: `Maria <b>"XSS"</b>` },
      resume: {
        ...resume,
        headline: "Headline com <script>alert(1)</script>",
      },
    });

    it.each(["<script>alert(1)</script>", "<b>"])(
      "não emite %s sem escape",
      (perigoso) => {
        expect(markup).not.toContain(perigoso);
      },
    );

    it("emite o script escapado", () => {
      expect(markup).toContain("&lt;script&gt;");
    });
  });

  it("inclui links apenas com esquema http(s) (sem javascript:)", () => {
    const markup = buildMarkup({
      student: {
        ...student,
        linkedinUrl: "javascript:alert(1)",
        portfolioUrl: "https://portfolio.example",
      },
      resume,
    });
    expect(markup).not.toContain('href="javascript:');
    expect(markup).toContain('href="https://portfolio.example"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("omite seção de experiência quando o aluno não tem experiências", () => {
    const markup = buildMarkup({
      student,
      resume: { ...resume, experiences: [] },
    });
    expect(markup).not.toContain("Experiência");
    expect(markup).toContain("Formação");
  });

  it("ignora generatedAt (rodapé com data foi removido do layout)", () => {
    const markup = buildMarkup(input, {
      generatedAt: new Date("2026-09-25"),
    });
    expect(markup).not.toContain("25/09/2026");
  });
});