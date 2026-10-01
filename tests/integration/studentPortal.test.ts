/**
 * [REFACTOR_ALUNO] Integração do Portal do Aluno (convex-test):
 * 1. Etapa 3.4 — `openJobs` devolve o Percentual de Compatibilidade
 *    calculado NO SERVIDOR (R8, fonte da verdade) para o mural;
 * 2. Etapa 2.2 — `saveResumeData` aceita os novos blocos do CV (links,
 *    projetos de extensão, certificações) com trim/limite;
 * 3. Etapa 2.2 — nova mutation `saveSkillsAndLanguages` salva skills e
 *    idiomas do construtor (R7 + validações de src/lib/skills);
 * 4. R7 — sem consentimento vigente nada é salvo.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };
const RECRUITER = { email: "recruiter@unicap.br", subject: "recruiter-1" };

async function seedWorld(t: World, options: { withConsent?: boolean } = {}) {
  const withConsent = options.withConsent ?? true;
  return t.run(async (ctx) => {
    const recruiterId = await ctx.db.insert("users", {
      email: RECRUITER.email,
      name: "Recrutador Responsável",
      role: "recrutador",
      active: true,
    });
    const studentUserId = await ctx.db.insert("users", {
      email: STUDENT.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    const studentId = await ctx.db.insert("students", {
      userId: studentUserId,
      fullName: "Maria da Silva",
      enrollment: "1234567",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2026,
      availability: "estagio",
      visibility: "somente_candidaturas",
      showContactToRecruiters: false,
      skills: ["React"],
      languages: [{ name: "Inglês", level: "intermediario" }],
    });
    if (withConsent) {
      await ctx.db.insert("consents", {
        userId: recruiterId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
      await ctx.db.insert("consents", {
        userId: studentUserId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }
    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description:
        "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });
    return { recruiterId, studentUserId, studentId, jobId };
  });
}

function asStudent(t: World, studentUserId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${studentUserId}`,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Etapa 3.4 — match do mural calculado no servidor (R8)", () => {
  it("openJobs devolve cada vaga com matchScore do aluno", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId } = await seedWorld(t);
    const jobs = await asStudent(t, studentUserId).query(
      api.applications.openJobs,
      {},
    );
    expect(jobs).toHaveLength(1);
    const first = jobs[0]!;
    expect(first.title).toBe("Estágio em Desenvolvimento Web");
    // React (obrigatório) atendido = base 90; sem bônus de idioma/disponibilidade.
    expect(first.matchScore).toBe(90);
  });

  it("sem a skill obrigatória o match cai (mesma regra pura do R8)", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId, studentId } = await seedWorld(t);
    await t.run(async (ctx) => {
      await ctx.db.patch(studentId, { skills: [] });
    });
    const jobs = await asStudent(t, studentUserId).query(
      api.applications.openJobs,
      {},
    );
    expect(jobs[0]!.matchScore).toBe(0);
  });
});

describe("Etapa 2.2 — saveResumeData com novos blocos do CV", () => {
  const BASE_ARGS = {
    headline: "Estudante de Ciência da Computação focado em back-end",
    summary:
      "Aluno do 6º período com base em engenharia de software e bancos de dados analíticos.",
    experiences: [],
    academicHistory: [],
  };

  it("persiste links, projetos de extensão e certificações com trim", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId, studentId } = await seedWorld(t);
    await asStudent(t, studentUserId).mutation(api.students.saveResumeData, {
      ...BASE_ARGS,
      links: {
        github: "  https://github.com/maria  ",
        lattes: "http://lattes.cnpq.br/123",
      },
      projectsText: "  Monitoria de Banco de Dados I (2024.2).  ",
      certifications: ["  Cisco CCNA  ", "  Excel Avançado  ", ""],
    });
    const stored = await t.run(
      async (ctx) => (await ctx.db.get(studentId))?.resumeData,
    );
    expect(stored?.links).toEqual({
      github: "https://github.com/maria",
      lattes: "http://lattes.cnpq.br/123",
    });
    expect(stored?.projectsText).toBe(
      "Monitoria de Banco de Dados I (2024.2).",
    );
    expect(stored?.certifications).toEqual(["Cisco CCNA", "Excel Avançado"]);
  });

  it("campos novos são opcionais — CV antigo continua salvando", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId, studentId } = await seedWorld(t);
    await asStudent(t, studentUserId).mutation(api.students.saveResumeData, {
      ...BASE_ARGS,
    });
    const stored = await t.run(
      async (ctx) => (await ctx.db.get(studentId))?.resumeData,
    );
    expect(stored?.headline).toBe(BASE_ARGS.headline);
    expect(stored?.certifications).toBeUndefined();
  });

  it("R7 — sem consentimento vigente o CV não salva", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId } = await seedWorld(t, { withConsent: false });
    await expect(
      asStudent(t, studentUserId).mutation(api.students.saveResumeData, {
        ...BASE_ARGS,
      }),
    ).rejects.toThrow(/consentimento/i);
  });
});

describe("Etapa 2.2 — saveSkillsAndLanguages do construtor", () => {
  it("normaliza e deduplica skills e valida idiomas", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId, studentId } = await seedWorld(t);
    await asStudent(t, studentUserId).mutation(
      api.students.saveSkillsAndLanguages,
      {
        skills: [" react ", "REACT", "python"],
        languages: [{ name: "Inglês", level: "avancado" }],
      },
    );
    const stored = await t.run(async (ctx) => ctx.db.get(studentId));
    expect(stored?.skills).toEqual(["React", "Python"]);
    expect(stored?.languages).toEqual([{ name: "Inglês", level: "avancado" }]);
  });

  it("R7 — sem consentimento vigente não salva", async () => {
    const t = convexTest({ schema, modules });
    const { studentUserId } = await seedWorld(t, { withConsent: false });
    await expect(
      asStudent(t, studentUserId).mutation(
        api.students.saveSkillsAndLanguages,
        { skills: ["React"], languages: [] },
      ),
    ).rejects.toThrow(/consentimento/i);
  });
});
