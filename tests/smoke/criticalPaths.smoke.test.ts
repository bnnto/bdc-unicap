/**
 * [SMOKE] Caminho crítico da versão otimizada (QA pós-performance).
 *
 * Objetivo: provar, de ponta a ponta e com as mutations/queries REAIS do
 * backend (convex-test), que os fluxos essenciais continuam funcionando
 * depois das otimizações de `searchTalent` e que as regras de negócio que
 * elas tocam seguem intactas:
 *
 * 1. Cadastro/perfil do aluno (upsertProfile + visibilidade + contato).
 * 2. Banco de Talentos (searchTalent): R1/R2, paginação, R6, ordenação
 *    pt-BR pelo `Intl.Collator`, chips e busca textual normalizada.
 * 3. Publicação de vaga + envio de candidatura com match no servidor (R8)
 *    e bloqueio por pré-requisito obrigatório (S3-5).
 * 4. Pipeline Kanban: transições válidas, anti-salto, reprovação com
 *    motivo (R5) e reflexo em `myApplications`/`getCandidateProfile`.
 * 5. Guardas de acesso (sem identidade / papel errado).
 *
 * Não substitui a suíte de unidade/integração: é a verificação rápida de
 * que o caminho feliz (e as guardas dele) continua de pé.
 */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";
import { computeMatchScore } from "../../src/lib/matching";
import { TALENT_PAGE_SIZE } from "../../src/lib/talentSearch";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;
const RECRUITER = { email: "recrutador.smoke@unicap.br", subject: "smoke-rec" };
const STUDENT = { email: "aluno.smoke@unicap.br", subject: "smoke-student" };

function asRecruiter(t: World, recruiterId: string) {
  return t.withIdentity({
    ...RECRUITER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${recruiterId}`,
  });
}

function asStudent(t: World, studentUserId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${studentUserId}`,
  });
}

/** Recrutador com aceite LGPD vigente (R7). */
async function seedRecruiter(t: World): Promise<string> {
  return await t.run(async (ctx) => {
    const recruiterId = await ctx.db.insert("users", {
      email: RECRUITER.email,
      name: "Recrutadora Smoke",
      role: "recrutador",
      active: true,
    });
    await ctx.db.insert("consents", {
      userId: recruiterId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    return recruiterId;
  });
}

/** Conta do aluno (o perfil nasce pela mutation real). */
async function seedStudentAccount(t: World): Promise<string> {
  return await t.run(async (ctx) => {
    const studentUserId = await ctx.db.insert("users", {
      email: STUDENT.email,
      name: "Aluno Smoke",
      role: "aluno",
      active: true,
    });
    await ctx.db.insert("consents", {
      userId: studentUserId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    return studentUserId;
  });
}

/** Vaga publicada pelo caminho real da UI do recrutador. */
async function publishJob(
  t: World,
  recruiterId: string,
  overrides: { title?: string; prerequisite?: string } = {},
): Promise<{ jobId: Id<"jobs">; title: string; status: string }> {
  const title = overrides.title ?? "Estágio em Desenvolvimento Web";
  const prerequisite = overrides.prerequisite ?? "React";
  const created = await asRecruiter(t, recruiterId).mutation(
    api.jobs.upsertJob,
    {
      title,
      description:
        "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
      prerequisites: [{ item: prerequisite, required: true }],
      contractType: "estagio",
      location: "Recife",
    },
  );
  return { jobId: created.jobId, title, status: created.status };
}

describe("Smoke — caminho crítico da versão otimizada", () => {
  it("1. cadastro do aluno: cria perfil, expõe no Banco de Talentos e autoriza contato", async () => {
    const t = convexTest(schema, modules);
    const recruiterId = await seedRecruiter(t);
    const studentUserId = await seedStudentAccount(t);
    const student = asStudent(t, studentUserId);
    const recruiter = asRecruiter(t, recruiterId);

    // Sem perfil, ninguém aparece para o recrutador.
    const beforeProfile = await recruiter.query(api.students.searchTalent, {
      page: 0,
    });
    expect(beforeProfile.items).toHaveLength(0);

    const saved = await student.mutation(api.students.upsertProfile, {
      fullName: "Álvaro Nunes de Souza",
      enrollment: "2026001",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2027,
      semester: 5,
      location: "Recife",
      linkedinUrl: "https://linkedin.com/in/alvaro-smoke",
      availability: ["estagio"],
      skills: ["React", "TypeScript"],
      languages: [{ name: "Inglês", level: "avancado" }],
    });
    expect(saved.created).toBe(true);

    const profile = await student.query(api.students.myProfile, {});
    expect(profile?.fullName).toBe("Álvaro Nunes de Souza");
    expect(profile?.email).toBe(STUDENT.email);

    // R2 — default seguro: privado até o aluno optar por se expor.
    expect(profile?.visibility).toBe("somente_candidaturas");
    const hidden = await recruiter.query(api.students.searchTalent, {
      page: 0,
    });
    expect(hidden.items).toHaveLength(0);

    await student.mutation(api.students.setVisibility, {
      visibility: "publico",
    });
    await student.mutation(api.students.setContactConsent, { allow: true });

    const visible = await recruiter.query(api.students.searchTalent, {
      search: "alvaro",
      page: 0,
    });
    expect(visible.items).toHaveLength(1);
    expect(visible.items[0]?.fullName).toBe("Álvaro Nunes de Souza");
    expect(visible.items[0]?.contactAllowed).toBe(true);
    expect(visible.items[0]?.linkedinUrl).toBe(
      "https://linkedin.com/in/alvaro-smoke",
    );
  });

  it("2. Banco de Talentos: R1/R2, R6, ordenação pt-BR, chips, texto e paginação", async () => {
    const t = convexTest(schema, modules);
    const recruiterId = await seedRecruiter(t);

    await t.run(async (ctx) => {
      const owner = await ctx.db.insert("users", {
        email: "seed.smoke@unicap.br",
        name: "Seed Smoke",
        role: "aluno",
        active: true,
      });
      const base = {
        userId: owner,
        course: "Ciência da Computação",
        graduationYear: 2026,
        availability: ["estagio"] as Array<
          "estagio" | "integral" | "meio_periodo" | "freelancer"
        >,
        status: "ativo" as const,
        visibility: "publico" as const,
        skills: ["React", "SQL"],
        languages: [{ name: "Inglês", level: "fluente" as const }],
      };
      // Ordem alfabética pt-BR: Álvaro < Bianca < Carla.
      await ctx.db.insert("students", {
        ...base,
        fullName: "Álvaro Pereira",
        enrollment: "0000001",
      });
      await ctx.db.insert("students", {
        ...base,
        fullName: "Bianca Lima",
        enrollment: "0000002",
      });
      await ctx.db.insert("students", {
        ...base,
        fullName: "Carla Menezes",
        enrollment: "0000003",
        linkedinUrl: "https://linkedin.com/in/carla",
        showContactToRecruiters: true,
      });
      // R2 — privado: não pode aparecer.
      await ctx.db.insert("students", {
        ...base,
        fullName: "Diego Privado",
        enrollment: "0000004",
        visibility: "somente_candidaturas",
      });
      // R1 — inativo: não pode aparecer nem sendo público.
      await ctx.db.insert("students", {
        ...base,
        fullName: "Eduardo Inativo",
        enrollment: "0000005",
        status: "inativo",
      });
    });

    const recruiter = asRecruiter(t, recruiterId);

    const page = await recruiter.query(api.students.searchTalent, { page: 0 });
    expect(page.items).toHaveLength(3);
    expect(page.total).toBe(3);
    expect(page.pageCount).toBe(1);
    expect(page.items.map((item) => item.fullName)).toEqual(
      expect.arrayContaining([
        "Álvaro Pereira",
        "Bianca Lima",
        "Carla Menezes",
      ]),
    );
    expect(page.items.some((item) => item.fullName.includes("Privado"))).toBe(
      false,
    );
    expect(page.items.some((item) => item.fullName.includes("Inativo"))).toBe(
      false,
    );

    // Ordenação pt-BR/base pelo `Intl.Collator`: a acentuada vem primeiro.
    const byName = await recruiter.query(api.students.searchTalent, {
      sort: "nome",
      page: 0,
    });
    expect(byName.items.map((item) => item.fullName)).toEqual([
      "Álvaro Pereira",
      "Bianca Lima",
      "Carla Menezes",
    ]);

    // R6 — contato projetado por candidato, sem vazamento.
    const carla = byName.items.find(
      (item) => item.fullName === "Carla Menezes",
    );
    const alvaro = byName.items.find(
      (item) => item.fullName === "Álvaro Pereira",
    );
    expect(carla?.contactAllowed).toBe(true);
    expect(carla?.linkedinUrl).toBe("https://linkedin.com/in/carla");
    expect(alvaro?.contactAllowed).toBe(false);
    expect(alvaro?.linkedinUrl).toBeNull();

    // Chips: contagem de matches por card continua correta.
    const chips = await recruiter.query(api.students.searchTalent, {
      skills: ["React", "SQL", "Python"],
      page: 0,
    });
    expect(chips.items).toHaveLength(3);
    expect(chips.items.every((item) => item.skillMatches === 2)).toBe(true);

    // Busca textual normalizada (sem acento/caixa).
    const text = await recruiter.query(api.students.searchTalent, {
      search: "ALVARO",
      page: 0,
    });
    expect(text.items.map((item) => item.fullName)).toEqual(["Álvaro Pereira"]);

    // Paginação: página fora do range é limitada à última existente.
    expect(TALENT_PAGE_SIZE).toBe(10);
    const outOfRange = await recruiter.query(api.students.searchTalent, {
      page: 5,
    });
    expect(outOfRange.items).toHaveLength(3);
    expect(outOfRange.page).toBe(0);
  });

  it("3. vaga publicada + candidatura com match no servidor e gate de pré-requisito", async () => {
    const t = convexTest(schema, modules);
    const recruiterId = await seedRecruiter(t);
    const studentUserId = await seedStudentAccount(t);
    const student = asStudent(t, studentUserId);

    await student.mutation(api.students.upsertProfile, {
      fullName: "Aluno Smoke",
      enrollment: "2026010",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2027,
      availability: ["estagio"],
      skills: ["React", "TypeScript"],
      languages: [{ name: "Inglês", level: "avancado" }],
    });

    const job = await publishJob(t, recruiterId);
    expect(job.status).toBe("aberta");
    const storedJob = await t.run(async (ctx) => ctx.db.get(job.jobId));
    expect(storedJob?.recruiterId).toBe(recruiterId);

    const applied = await student.mutation(api.applications.applyToJob, {
      jobId: job.jobId,
    });
    expect(applied.matchScore).toBeGreaterThanOrEqual(0);
    expect(applied.matchScore).toBeLessThanOrEqual(100);

    // R8 — o score persistido é o da regra pura, não o do cliente.
    const expectedScore = computeMatchScore(
      {
        skills: ["React", "TypeScript"],
        languages: [{ name: "Inglês", level: "avancado" }],
        availability: ["estagio"],
      },
      {
        prerequisites: [{ item: "React", required: true }],
        requiredLanguage: undefined,
        availability: undefined,
      },
    );
    expect(applied.matchScore).toBe(expectedScore);

    const stored = await t.run(async (ctx) =>
      ctx.db.get(applied.applicationId),
    );
    expect(stored?.stage).toBe("inscrito");

    // Candidatura duplicada é bloqueada.
    await expect(
      student.mutation(api.applications.applyToJob, { jobId: job.jobId }),
    ).rejects.toThrow(/já se candidatou/i);

    // Pré-requisito obrigatório que o aluno não possui: bloqueia no servidor.
    const strictJob = await publishJob(t, recruiterId, {
      title: "Estágio em Análise de Dados",
      prerequisite: "Python",
    });
    await expect(
      student.mutation(api.applications.applyToJob, {
        jobId: strictJob.jobId,
      }),
    ).rejects.toThrow(/pré-requisito|Python/i);
  });

  it("4. Kanban: transições em ordem, anti-salto, reprovação com motivo e visão do aluno", async () => {
    const t = convexTest(schema, modules);
    const recruiterId = await seedRecruiter(t);
    const studentUserId = await seedStudentAccount(t);
    const student = asStudent(t, studentUserId);
    const recruiter = asRecruiter(t, recruiterId);

    // Pré-condição do fluxo: o aluno precisa de perfil para se candidatar.
    await student.mutation(api.students.upsertProfile, {
      fullName: "Aluno Smoke",
      enrollment: "2026020",
      status: "ativo",
      course: "Ciência da Computação",
      graduationYear: 2027,
      availability: ["estagio"],
      skills: ["React", "TypeScript"],
      languages: [{ name: "Inglês", level: "avancado" }],
    });

    const job = await publishJob(t, recruiterId);
    const applied = await student.mutation(api.applications.applyToJob, {
      jobId: job.jobId,
    });
    const applicationId = applied.applicationId;

    // Caminho feliz do pipeline.
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + 2 * DAY,
      interviewLink: "https://meet.example.com/smoke",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "aprovado",
      expectedStartDate: Date.now() + 15 * DAY,
    });

    const approved = await t.run(async (ctx) => ctx.db.get(applicationId));
    expect(approved?.stage).toBe("aprovado");

    // Anti-salto: nova candidatura não pula direto para entrevista.
    const secondJob = await publishJob(t, recruiterId, {
      title: "Estágio em Suporte",
    });
    const second = await student.mutation(api.applications.applyToJob, {
      jobId: secondJob.jobId,
    });
    await expect(
      recruiter.mutation(api.applications.moveApplication, {
        applicationId: second.applicationId,
        to: "entrevista",
        interviewDate: Date.now() + DAY,
        interviewLink: "https://meet.example.com/skip",
      }),
    ).rejects.toThrow();

    // Reprovação exige motivo (R5).
    await expect(
      recruiter.mutation(api.applications.moveApplication, {
        applicationId: second.applicationId,
        to: "reprovado",
      }),
    ).rejects.toThrow(/motivo/i);

    await recruiter.mutation(api.applications.moveApplication, {
      applicationId: second.applicationId,
      to: "reprovado",
      rejectionReason: "requisitos_obrigatorios",
    });

    // O aluno enxerga o estágio final das duas candidaturas.
    const mine = await student.query(api.applications.myApplications, {});
    const first = mine.find((item) => item.jobId === job.jobId);
    const rejected = mine.find((item) => item.jobId === secondJob.jobId);
    expect(first?.stage).toBe("aprovado");
    expect(first?.jobTitle).toBe(job.title);
    expect(rejected?.stage).toBe("reprovado");
    expect(rejected?.rejectionReason).toBe("requisitos_obrigatorios");

    // Recrutador dono da vaga abre o perfil do candidato (tem candidatura).
    if (approved === null) throw new Error("Candidatura não encontrada.");
    const candidate = await recruiter.query(api.students.getCandidateProfile, {
      studentId: approved.studentId,
    });
    expect(candidate?.fullName).toBe("Aluno Smoke");
    // R6 — contato não autorizado não sai do servidor.
    expect(candidate?.contactReleased).toBe(false);
    expect(candidate?.email).toBeUndefined();
  });

  it("5. guardas de acesso continuam ativas (sem identidade / papel errado)", async () => {
    const t = convexTest(schema, modules);
    const recruiterId = await seedRecruiter(t);
    const studentUserId = await seedStudentAccount(t);

    await expect(
      t.query(api.students.searchTalent, { page: 0 }),
    ).rejects.toThrow(/autenticado/i);

    // Aluno não acessa o Banco de Talentos (exclusivo de recrutador/gestor).
    await expect(
      asStudent(t, studentUserId).query(api.students.searchTalent, { page: 0 }),
    ).rejects.toThrow(/recrutadores|Banco de Talentos/i);

    // Recrutador não se candidata (exclusivo de aluno).
    const job = await publishJob(t, recruiterId);
    await expect(
      asRecruiter(t, recruiterId).mutation(api.applications.applyToJob, {
        jobId: job.jobId,
      }),
    ).rejects.toThrow(/Apenas alunos/i);
  });
});