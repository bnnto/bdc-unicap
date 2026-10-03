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
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

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
  academicHistory: [{ item: "Bacharelado em Sistemas", year: 2026 }],
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
      email: "recruiter@unicap.br",
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
      email: "aluno@unicap.br",
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    const studentId = await ctx.db.insert("students", {
      userId: studentUserId,
      fullName: "Maria da Silva",
      enrollment: "1234567",
      status,
      course: "Ciência da Computação",
      graduationYear: 2026,
      semester: 6,
      location: "Recife, PE",
      availability: "estagio",
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
      expiresAt: Date.now() + 30 * DAY,
    });

    if (withApplication) {
      await ctx.db.insert("applications", {
        jobId,
        studentId,
        stage: "triagem",
        matchScore: 85,
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
        expiresAt: Date.now() + 30 * DAY,
      });
      await ctx.db.insert("applications", {
        jobId: otherJobId,
        studentId,
        stage: "inscrito",
        matchScore: 70,
        appliedAt: Date.now(),
      });
    }

    let gestorId: string | null = null;
    if (options.withGestor === true) {
      gestorId = await ctx.db.insert("users", {
        email: "gestor@unicap.br",
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

describe("RECRUITER_VIEW_PROFILE — students.getCandidateProfile", () => {
  it("recrutador dono da candidatura vê o currículo completo", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      withApplication: true,
    });
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });

    expect(profile).not.toBeNull();
    expect(profile?.fullName).toBe("Maria da Silva");
    expect(profile?.course).toBe("Ciência da Computação");
    expect(profile?.headline).toBe("Estudante de Sistemas focado em back-end");
    expect(profile?.resume?.experiences[0]?.company).toBe("UNICAP");
    expect(profile?.resume?.academicHistory[0]?.item).toBe(
      "Bacharelado em Sistemas",
    );
    expect(profile?.resume?.links?.github).toBe("https://github.com/maria");
    expect(profile?.skills).toEqual(["React", "Node"]);
    expect(profile?.languages).toEqual([
      { name: "Inglês", level: "intermediario" },
    ]);
    expect(profile?.semester).toBe(6);
    expect(profile?.location).toBe("Recife, PE");
  });

  it("aluno público (Banco de Talentos) é visível mesmo sem candidatura", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "publico",
      withApplication: false,
    });
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile?.fullName).toBe("Maria da Silva");
  });

  it("aluno privado SEM candidatura com o recrutador → null (R2)", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "somente_candidaturas",
      withApplication: false,
    });
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile).toBeNull();
  });

  it("candidatura em vaga de OUTRO recrutador não libera o acesso", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "somente_candidaturas",
      withOtherRecruiterApplication: true,
    });
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile).toBeNull();
  });

  it("aluno inativo não aparece mesmo sendo público, sem candidatura (R1)", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "publico",
      status: "inativo",
      withApplication: false,
    });
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile).toBeNull();
  });

  it("aluno logado (papel aluno) é barrado", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId, studentId, recruiterId } = await seedWorld(t, {
      withApplication: true,
    });
    await expect(
      t
        .withIdentity(identity("aluno@unicap.br", "s-1", studentUserId))
        .query(api.students.getCandidateProfile, { studentId }),
    ).rejects.toThrow(/recrutadores e gestores/i);
    // Sanity: o dono do processo continua vendo.
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile).not.toBeNull();
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
      t
        .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
        .query(api.students.getCandidateProfile, { studentId }),
    ).rejects.toThrow(/consentimento/i);
  });

  it("sem identidade autenticada é barrado", async () => {
    const t = convexTest({ schema, modules });
    const { studentId } = await seedWorld(t, { visibility: "publico" });
    await expect(
      t.query(api.students.getCandidateProfile, { studentId }),
    ).rejects.toThrow(/autenticado/i);
  });

  it("contato omitido sem autorização (R6) e presente com autorização geral", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "publico",
      showContact: false,
    });
    const semContato = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(semContato?.contactReleased).toBe(false);
    expect(semContato?.email).toBeUndefined();
    expect(semContato?.linkedinUrl).toBeUndefined();
    expect(semContato?.portfolioUrl).toBeUndefined();

    await t.run(async (ctx) => {
      await ctx.db.patch(studentId, {
        showContactToRecruiters: true,
      });
    });
    const comContato = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(comContato?.contactReleased).toBe(true);
    expect(comContato?.email).toBe("aluno@unicap.br");
    expect(comContato?.linkedinUrl).toBe("https://www.linkedin.com/in/maria");
    expect(comContato?.portfolioUrl).toBe("https://maria.dev");
  });

  it("aceite no processo (processAccepted) libera o contato mesmo sem autorização geral", async () => {
    const t = convexTest({ schema, modules });
    const { recruiterId, studentId } = await seedWorld(t, {
      visibility: "somente_candidaturas",
      showContact: false,
      withApplication: true,
      processAccepted: true,
    });
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile?.contactReleased).toBe(true);
    expect(profile?.email).toBe("aluno@unicap.br");
  });

  it("gestor autenticado com consentimento também visualiza perfis públicos", async () => {
    const t = convexTest({ schema, modules });
    const { gestorId, studentId } = await seedWorld(t, {
      visibility: "publico",
      withGestor: true,
    });
    const profile = await t
      .withIdentity(identity("gestor@unicap.br", "g-1", gestorId as string))
      .query(api.students.getCandidateProfile, { studentId });
    expect(profile?.fullName).toBe("Maria da Silva");
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
        graduationYear: 2030,
        availability: "estagio",
        visibility: "somente_candidaturas",
      }),
    );
    await t.run(async (ctx) => ctx.db.delete(missing));
    const profile = await t
      .withIdentity(identity("recruiter@unicap.br", "r-1", recruiterId))
      .query(api.students.getCandidateProfile, { studentId: missing });
    expect(profile).toBeNull();
  });
});
