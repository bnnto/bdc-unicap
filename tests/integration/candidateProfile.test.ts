/**
 * [RECRUITER_VIEW_PROFILE] Testes de INTEGRAÇÃO da query
 * `students.getCandidateProfile` (spec Etapa 1/4) contra o mock oficial
 * do backend Convex (convex-test).
 *
 * CAs de segurança:
 *  - apenas recrutador/gestor autenticado com consentimento vigente (R7);
 *  - o perfil só aparece se o aluno for "público" (Banco de Talentos)
 *    OU se houver candidatura do aluno em vaga DESTE recrutador;
 *  - aluno "somente_candidaturas" sem candidatura com o recrutador → null;
 *  - contato (R6: e-mail/LinkedIn/portfólio) omitido sem autorização.
 */
import { convexTest } from "convex-test";
import { assert, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;
type SeedOptions = NonNullable<Parameters<typeof seedWorld>[1]>;

const DAY = 86_400_000;
const JOB_VALIDITY = 30 * DAY;
const ANO_FORMATURA = 2026;
const ANO_FANTASMA = 2030;
const SEMESTRE = 6;
const MATCH_TRIAGEM = 85;
const MATCH_OUTRO = 70;

/** Telefone do cadastro de usuário (users.phone) e telefone privado do aluno. */
const PHONE_USUARIO = "81988887777";
const PHONE_ALUNO_PRIVADO = "81999990000";

const RECRUITER = { email: "recruiter@unicap.br", subject: "r-1" };
const STUDENT_USER = { email: "aluno@unicap.br", subject: "s-1" };
const GESTOR = { email: "gestor@unicap.br", subject: "g-1" };

const RESUME = {
  headline: "Estudante de Sistemas focado em back-end",
  summary: "Perfil profissional completo do candidato.",
  experiences: [
    {
      company: "UNICAP",
      role: "Monitor",
      period: "2023–2024",
      description: "Monitoria de Banco de Dados I.",
    },
  ],
  academicHistory: [{ item: "Bacharelado em Sistemas", year: ANO_FORMATURA }],
  links: {
    github: "https://github.com/maria",
    lattes: "http://lattes.cnpq.br/1",
  },
  projectsText: "Feira de Ciências — oficina de Python",
  certifications: ["Cisco CCNA"],
};

async function seedWorld(
  t: World,
  options: {
    visibility?: "publico" | "somente_candidaturas";
    showContact?: boolean;
    status?: "ativo" | "egresso" | "inativo";
    withApplication?: boolean;
    processAccepted?: boolean;
    withOtherRecruiterApplication?: boolean;
    withGestor?: boolean;
  } = {},
) {
  const visibility = options.visibility ?? "somente_candidaturas";
  const showContact = options.showContact ?? false;
  const status = options.status ?? "ativo";
  const withApplication = options.withApplication ?? false;
  const withOther = options.withOtherRecruiterApplication ?? false;

  return t.run(async (ctx) => {
    const recruiterId = await ctx.db.insert("users", {
      email: RECRUITER.email,
      name: "Recrutador Responsável",
      role: "recrutador",
      active: true,
    });
    const otherRecruiterId = await ctx.db.insert("users", {
      email: "other@unicap.br",
      name: "Outro Recrutador",
      role: "recrutador",
      active: true,
    });
    const studentUserId = await ctx.db.insert("users", {
      email: STUDENT_USER.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
      phone: PHONE_USUARIO,
    });
    const studentId = await ctx.db.insert("students", {
      userId: studentUserId,
      fullName: "Maria da Silva",
      enrollment: "1234567",
      status,
      course: "Ciência da Computação",
      graduationYear: ANO_FORMATURA,
      semester: SEMESTRE,
      location: "Recife, PE",
      availability: ["estagio"],
      visibility,
      showContactToRecruiters: showContact,
      linkedinUrl: "https://www.linkedin.com/in/maria",
      portfolioUrl: "https://maria.dev",
      skills: ["React", "Node"],
      languages: [{ name: "Inglês", level: "intermediario" }],
      resumeData: RESUME,
    });

    for (const userId of [recruiterId, otherRecruiterId, studentUserId]) {
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }

    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description: "Apoio ao time de web da universidade.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + JOB_VALIDITY,
    });

    if (withApplication) {
      await ctx.db.insert("applications", {
        jobId,
        studentId,
        stage: "triagem",
        matchScore: MATCH_TRIAGEM,
        appliedAt: Date.now(),
        ...(options.processAccepted === true ? { processAccepted: true } : {}),
      });
    }

    if (withOther) {
      const otherJobId = await ctx.db.insert("jobs", {
        recruiterId: otherRecruiterId,
        title: "Vaga de outro recrutador",
        description: "Candidatura em vaga que não é deste recrutador.",
        prerequisites: [],
        contractType: "clt",
        status: "aberta",
        publishedAt: Date.now(),
        expiresAt: Date.now() + JOB_VALIDITY,
      });
      await ctx.db.insert("applications", {
        jobId: otherJobId,
        studentId,
        stage: "inscrito",
        matchScore: MATCH_OUTRO,
        appliedAt: Date.now(),
      });
    }

    let gestorId: string | null = null;
    if (options.withGestor === true) {
      gestorId = await ctx.db.insert("users", {
        email: GESTOR.email,
        name: "Coordenação",
        role: "gestor",
        active: true,
      });
      await ctx.db.insert("consents", {
        userId: gestorId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }

    return {
      recruiterId,
      otherRecruiterId,
      studentUserId,
      studentId,
      jobId,
      gestorId,
    };
  });
}

function identity(email: string, subject: string, userId: string) {
  return {
    email,
    subject,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${userId}`,
  };
}

/** Consulta o perfil como o recrutador indicado (pode devolver null). */
function profileAsRecruiter(
  t: World,
  recruiterId: string,
  studentId: Id<"students">,
) {
  return t
    .withIdentity(identity(RECRUITER.email, RECRUITER.subject, recruiterId))
    .query(api.students.getCandidateProfile, { studentId });
}

/** Como `profileAsRecruiter`, mas falha o teste se o perfil não for visível. */
async function visibleProfileAsRecruiter(
  t: World,
  recruiterId: string,
  studentId: Id<"students">,
) {
  const profile = await profileAsRecruiter(t, recruiterId, studentId);
  assert(profile, "o perfil deveria estar visível para o recrutador");
  return profile;
}

describe("RECRUITER_VIEW_PROFILE — students.getCandidateProfile", () => {
  describe("recrutador dono da candidatura vê o currículo completo", () => {
    async function ownerProfile() {
      const t = convexTest({ schema, modules });
      const { recruiterId, studentId } = await seedWorld(t, {
        withApplication: true,
      });
      return visibleProfileAsRecruiter(t, recruiterId, studentId);
    }

    it("dados pessoais, competências e idiomas", async () => {
      const profile = await ownerProfile();

      expect(profile).toMatchObject({
        fullName: "Maria da Silva",
        course: "Ciência da Computação",
        headline: RESUME.headline,
        skills: ["React", "Node"],
        languages: [{ name: "Inglês", level: "intermediario" }],
      });
    });

    it("experiência, formação e links do currículo", async () => {
      const profile = await ownerProfile();

      expect(profile.resume).toMatchObject({
        experiences: [{ company: "UNICAP" }],
        academicHistory: [{ item: "Bacharelado em Sistemas" }],
        links: { github: "https://github.com/maria" },
      });
    });

    it("[QUICK_WIN_RECRUITER] matrícula, semestre e local presentes mesmo sem liberação de contato", async () => {
      // A matrícula é usada pelo template de impressão ("Matrícula …") do PDF.
      const profile = await ownerProfile();

      expect(profile).toMatchObject({
        enrollment: "1234567",
        semester: SEMESTRE,
        location: "Recife, PE",
      });
    });
  });

  it("aluno público (Banco de Talentos) é visível mesmo sem candidatura", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "publico",
      withApplication: false,
    });

    const profile = await profileAsRecruiter(t, recruiterId, studentId);

    expect(profile).toMatchObject({ fullName: "Maria da Silva" });
  });

  it.each([
    [
      "aluno privado SEM candidatura com o recrutador (R2)",
      { visibility: "somente_candidaturas", withApplication: false },
    ],
    [
      "candidatura em vaga de OUTRO recrutador não libera o acesso",
      {
        visibility: "somente_candidaturas",
        withOtherRecruiterApplication: true,
      },
    ],
    [
      "aluno inativo não aparece mesmo sendo público, sem candidatura (R1)",
      { visibility: "publico", status: "inativo", withApplication: false },
    ],
  ] satisfies Array<[string, SeedOptions]>)(
    "perfil não visível → null: %s",
    async (_caso, options) => {
      const t = convexTest({ schema, modules });
      const { recruiterId, studentId } = await seedWorld(t, options);

      const profile = await profileAsRecruiter(t, recruiterId, studentId);

      expect(profile).toBeNull();
    },
  );

  it("aluno logado (papel aluno) é barrado", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId, studentId } = await seedWorld(t, {
      withApplication: true,
    });

    await expect(
      t
        .withIdentity(
          identity(STUDENT_USER.email, STUDENT_USER.subject, studentUserId),
        )
        .query(api.students.getCandidateProfile, { studentId }),
    ).rejects.toThrow(/recrutadores e gestores/i);
  });

  it("recrutador sem consentimento LGPD é barrado (R7)", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "publico",
    });
    await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("consents")
        .withIndex("by_user", (q) => q.eq("userId", recruiterId))
        .collect();
      for (const row of rows) await ctx.db.delete(row._id);
    });

    await expect(
      profileAsRecruiter(t, recruiterId, studentId),
    ).rejects.toThrow(/consentimento/i);
  });

  it("sem identidade autenticada é barrado", async () => {
    const t = convexTest({ schema, modules });
    const { studentId } = await seedWorld(t, { visibility: "publico" });

    await expect(
      t.query(api.students.getCandidateProfile, { studentId }),
    ).rejects.toThrow(/autenticado/i);
  });

  describe("contato do aluno (R6)", () => {
    it("omitido sem autorização", async () => {
      const t = convexTest({ schema, modules });
      const { recruiterId, studentId } = await seedWorld(t, {
        visibility: "publico",
        showContact: false,
      });

      const profile = await visibleProfileAsRecruiter(t, recruiterId, studentId);

      expect(profile.contactReleased).toBe(false);
      expect({
        email: profile.email,
        linkedinUrl: profile.linkedinUrl,
        portfolioUrl: profile.portfolioUrl,
      }).toEqual({});
      expect(profile).not.toHaveProperty("phone");
    });

    it("e-mail, LinkedIn e portfólio presentes com autorização geral", async () => {
      const t = convexTest({ schema, modules });
      const { recruiterId, studentId } = await seedWorld(t, {
        visibility: "publico",
        showContact: true,
      });

      const profile = await visibleProfileAsRecruiter(t, recruiterId, studentId);

      expect(profile).toMatchObject({
        contactReleased: true,
        email: STUDENT_USER.email,
        linkedinUrl: "https://www.linkedin.com/in/maria",
        portfolioUrl: "https://maria.dev",
      });
      // [QUICK_WIN_RECRUITER] o telefone não é projetado junto do e-mail.
      expect(profile).not.toHaveProperty("phone");
    });

    it("aceite no processo (processAccepted) libera o contato mesmo sem autorização geral", async () => {
      const t = convexTest({ schema, modules });
      const { recruiterId, studentId } = await seedWorld(t, {
        visibility: "somente_candidaturas",
        showContact: false,
        withApplication: true,
        processAccepted: true,
      });

      const profile = await profileAsRecruiter(t, recruiterId, studentId);

      expect(profile).toMatchObject({
        contactReleased: true,
        email: STUDENT_USER.email,
      });
    });

    it("o telefone privado do aluno (students.phone) nunca chega ao recrutador", async () => {
      const t = convexTest({ schema, modules });
      const { recruiterId, studentId } = await seedWorld(t, {
        visibility: "publico",
        showContact: true,
      });
      await t.run(async (ctx) => {
        await ctx.db.patch(studentId, { phone: PHONE_ALUNO_PRIVADO });
      });

      const profile = await visibleProfileAsRecruiter(t, recruiterId, studentId);
      const serialized = JSON.stringify(profile);

      expect(profile.contactReleased).toBe(true);
      expect(serialized).not.toContain(PHONE_ALUNO_PRIVADO);
      expect(serialized).not.toContain(PHONE_USUARIO);
    });
  });

  it("gestor autenticado com consentimento também visualiza perfis públicos", async () => {
    const t = convexTest({ schema, modules });
    const { gestorId, studentId } = await seedWorld(t, {
      visibility: "publico",
      withGestor: true,
    });
    assert(gestorId !== null, "o gestor deveria ter sido criado");

    const profile = await t
      .withIdentity(identity(GESTOR.email, GESTOR.subject, gestorId))
      .query(api.students.getCandidateProfile, { studentId });

    expect(profile).toMatchObject({ fullName: "Maria da Silva" });
  });

  it("studentId inexistente → null", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "publico",
    });
    const missing = await t.run(async (ctx) =>
      ctx.db.insert("students", {
        userId: (await ctx.db.get(studentId))!.userId,
        fullName: "Fantasma",
        enrollment: "0000000",
        status: "inativo",
        course: "Nada",
        graduationYear: ANO_FANTASMA,
        availability: ["estagio"],
        visibility: "somente_candidaturas",
      }),
    );
    await t.run(async (ctx) => ctx.db.delete(missing));

    const profile = await profileAsRecruiter(t, recruiterId, missing);

    expect(profile).toBeNull();
  });
});