import { describe, expect, it } from "vitest";
import {
  buildResumeDocument,
  buildResumeMarkup,
  escapeHtml,
  formatResumeFileName,
  type ResumeDocStudent,
} from "../../src/lib/resumeDocument";
import type { ResumeDataInput } from "../../src/lib/resume";

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
    { item: "Ingresso no curso de CC", year: 2021 },
    { item: "Premiação na maratona de programação", year: 2023 },
  ],
};

const student: ResumeDocStudent = {
  fullName: "Maria da Silva",
  enrollment: "1234567",
  course: "Ciência da Computação",
  status: "ativo",
  graduationYear: 2026,
  semester: 8,
  location: "Recife/PE",
  linkedinUrl: "https://www.linkedin.com/in/maria-silva",
  portfolioUrl: null,
  availability: "estagio",
};

const input = { student, resume };

describe("documento do Currículo Vitae (S2-2)", () => {
  it("monta cabeçalho institucional com nome, curso e headline", () => {
    const doc = buildResumeDocument(input);
    expect(doc.ok).toBe(true);
    if (!doc.ok) return;
    expect(doc.student).toEqual(student);
    expect(doc.resume).toEqual(resume);
    expect(doc.university).toBe("Universidade Católica de Pernambuco");
    expect(doc.acronym).toBe("UNICAP");
    expect(doc.docTitle).toBe("Currículo Vitae — Banco de Currículos UNICAP");
  });

  it("exige perfil do aluno e currículo salvo (sem placeholders)", () => {
    expect(buildResumeDocument({ ...input, student: null })).toEqual({
      ok: false,
      reason: "perfil_inexistente",
    });
    expect(buildResumeDocument({ ...input, resume: null })).toEqual({
      ok: false,
      reason: "curriculo_inexistente",
    });
    expect(buildResumeDocument({ student: null, resume: null })).toEqual({
      ok: false,
      reason: "perfil_inexistente",
    });
  });

  it("headline e resumo aparecem sempre — download fiel (CA 1)", () => {
    const doc = buildResumeDocument(input);
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.headline).toBe(resume.headline);
    expect(doc.summary).toBe(resume.summary);
  });

  it("lista experiências e histórico na ordem do formulário", () => {
    const doc = buildResumeDocument(input);
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.experiences).toEqual(resume.experiences);
    expect(doc.academicHistory).toEqual(resume.academicHistory);
  });

  it("tolera perfil mínimo: campos opcionais viram null, sem inventar dados", () => {
    const minimal: ResumeDocStudent = {
      fullName: "João Pereira",
      enrollment: "7654321",
      course: "Direção",
      status: "egresso",
      graduationYear: 2025,
      semester: null,
      location: null,
      linkedinUrl: null,
      portfolioUrl: null,
      availability: "freelancer",
    };
    const doc = buildResumeDocument({ student: minimal, resume });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.student.location).toBeNull();
    expect(doc.student.linkedinUrl).toBeNull();
    expect(doc.student.semester).toBeNull();
  });

  it("labels amigáveis para status e disponibilidade no template", () => {
    const doc = buildResumeDocument(input);
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.statusLabel).toBe("Aluno ativo");
    expect(doc.availabilityLabel).toBe("Estágio");
  });

  it("labels para egresso e outras disponibilidades", () => {
    const doc = buildResumeDocument({
      student: { ...student, status: "egresso", availability: "integral" },
      resume,
    });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.statusLabel).toBe("Egresso");
    expect(doc.availabilityLabel).toBe("Período integral");
  });

  it("inclui fallback da graduação no histórico acadêmico", () => {
    const doc = buildResumeDocument({
      student: { ...student, graduationYear: 2024 },
      resume,
    });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.academicEntries).toEqual([
      ...resume.academicHistory,
      { item: "Graduação em Ciência da Computação — UNICAP", year: 2024 },
    ]);
  });

  it("não duplica fallback quando o aluno já listou a graduação", () => {
    const doc = buildResumeDocument({
      student: { ...student, graduationYear: 2024 },
      resume: {
        ...resume,
        experiences: [],
        academicHistory: [
          { item: "Graduação em Ciência da Computação — UNICAP", year: 2024 },
        ],
      },
    });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    expect(doc.academicEntries).toEqual([
      { item: "Graduação em Ciência da Computação — UNICAP", year: 2024 },
    ]);
  });
});

describe("nome de arquivo do currículo (S2-2)", () => {
  it("gera arquivo slugificado com nome, curso e ano", () => {
    expect(
      formatResumeFileName("Maria da Silva", "Ciência da Computação", 2026),
    ).toBe("curriculo-maria-da-silva-ciencia-da-computacao-2026.pdf");
  });

  it("remove acentos e caracteres especiais", () => {
    expect(
      formatResumeFileName("José  Ébano Júnior", "Administração", 2025),
    ).toBe("curriculo-jose-ebano-junior-administracao-2025.pdf");
  });

  it("tolera campos vazios com fallback mínimo", () => {
    expect(formatResumeFileName("", "", 0)).toBe("curriculo-unicap.pdf");
  });
});

describe("template HTML do currículo (S2-2)", () => {
  it("escapeHtml neutraliza injeção de markup", () => {
    expect(escapeHtml(`<img src=x onerror="alert('x')">`)).toBe(
      "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;",
    );
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });

  it("gera cabeçalho institucional e seções com os dados do formulário", () => {
    const doc = buildResumeDocument(input);
    if (!doc.ok) throw new Error("documento deveria ser válido");
    const markup = buildResumeMarkup(doc);
    expect(markup).toContain("unicap-resume-doc");
    expect(markup).toContain("Universidade Católica de Pernambuco");
    expect(markup).toContain(resume.headline);
    expect(markup).toContain(resume.summary);
    expect(markup).toContain("Acme Ltda");
    expect(markup).toContain("Ingresso no curso de CC (2021)");
    expect(markup).toContain(
      "Graduação em Ciência da Computação — UNICAP (2026)",
    );
  });

  it("escapa todo texto dinâmico vindo do aluno", () => {
    const doc = buildResumeDocument({
      student: { ...student, fullName: `Maria <b>"XSS"</b>` },
      resume: {
        ...resume,
        headline: "Headline com <script>alert(1)</script>",
      },
    });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    const markup = buildResumeMarkup(doc);
    expect(markup).not.toContain("<script>alert(1)</script>");
    expect(markup).not.toContain("<b>");
    expect(markup).toContain("&lt;script&gt;");
  });

  it("inclui links apenas com esquema http(s) (sem javascript:)", () => {
    const doc = buildResumeDocument({
      student: {
        ...student,
        linkedinUrl: "javascript:alert(1)",
        portfolioUrl: "https://portfolio.example",
      },
      resume,
    });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    const markup = buildResumeMarkup(doc);
    expect(markup).not.toContain('href="javascript:');
    expect(markup).toContain('href="https://portfolio.example"');
    expect(markup).toContain('rel="noopener noreferrer"');
  });

  it("omite seção de experiência quando o aluno não tem experiências", () => {
    const doc = buildResumeDocument({
      student,
      resume: { ...resume, experiences: [] },
    });
    if (!doc.ok) throw new Error("documento deveria ser válido");
    const markup = buildResumeMarkup(doc);
    expect(markup).not.toContain("Experiência profissional");
    expect(markup).toContain("Formação e histórico acadêmico");
  });

  it("aceita data fixa para o rodapé (testável)", () => {
    const doc = buildResumeDocument(input);
    if (!doc.ok) throw new Error("documento deveria ser válido");
    const markup = buildResumeMarkup(doc, {
      generatedAt: new Date(2026, 8, 25),
    });
    expect(markup).toContain("em 25/09/2026");
  });
});
