/**
 * [FINAL_UPGRADE Etapa 2/3] — testes de INTEGRAÇÃO do upgrade final:
 *
 * 1. E-mails do Kanban: avanço para "Entrevista"/"Aprovado" agenda a
 *    action `emails.sendStageNotification`; a action usa a API do Resend
 *    quando `RESEND_API_KEY` existe e cai no MOCK com console.log quando
 *    falta; a preferência "Atualizações de Candidatura" desligada corta o
 *    envio; recuos não notificam.
 * 2. Analytics: `applications.myStats` devolve as contas certas
 *    (TDD da math em tests/unit/analytics.test.ts) e
 *    `applications.trackProfileView` incrementa o contador do perfil.
 */
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };
const RECRUITER = { email: "recruiter@unicap.br", subject: "recruiter-1" };

async function seedWorld(
  t: World,
  options: { notifyApplicationUpdates?: boolean } = {},
) {
  const notify = options.notifyApplicationUpdates ?? true;
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
      notifyApplicationUpdates: notify,
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
      showContactToRecruiters: true,
      skills: ["React"],
      languages: [{ name: "Inglês", level: "intermediario" }],
    });
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
    const jobId = await ctx.db.insert("jobs", {
      recruiterId,
      title: "Estágio em Desenvolvimento Web",
      description: "Apoio no desenvolvimento de aplicações web.",
      prerequisites: [{ item: "React", required: true }],
      contractType: "estagio",
      status: "aberta",
      publishedAt: Date.now(),
      expiresAt: Date.now() + 30 * DAY,
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

function asRecruiter(t: World, recruiterId: string) {
  return t.withIdentity({
    ...RECRUITER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${recruiterId}`,
  });
}

/** Candidatura inscrita, pronta para avançar no funil. */
async function applyToJob(
  t: World,
  seed: Awaited<ReturnType<typeof seedWorld>>,
) {
  const { applicationId } = await asStudent(t, seed.studentUserId).mutation(
    api.applications.applyToJob,
    { jobId: seed.jobId },
  );
  return applicationId;
}

describe("[FINAL_UPGRADE Etapa 2] — e-mails atrelados aos avanços do Kanban", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("sem RESEND_API_KEY a action cai no MOCK com console.log (não quebra)", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const applicationId = await applyToJob(t, seed);
    const recruiter = asRecruiter(t, seed.recruiterId);

    // Avanço até Entrevista (inscrito → triagem → entrevista).
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + DAY,
      interviewLink: "https://meet.example.com/unicap-1",
    });

    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    const mockLogs = log.mock.calls.flat().join("\n");
    expect(mockLogs).toContain("email-mock");
    expect(mockLogs).toContain(STUDENT.email);
    expect(mockLogs).toContain("Estágio em Desenvolvimento Web");
    expect(mockLogs).toMatch(/entrevista/i);
  });

  it("com RESEND_API_KEY a action chama a API do Resend (fetch)", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_123");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true } as Response);
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const applicationId = await applyToJob(t, seed);
    const recruiter = asRecruiter(t, seed.recruiterId);

    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + DAY,
      interviewLink: "Auditório do Bloco 2",
    });

    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body as string) as {
      to: string[];
      subject: string;
    };
    expect(body.to).toEqual([STUDENT.email]);
    expect(body.subject).toContain("Estágio em Desenvolvimento Web");
    expect(body.subject).toContain("Entrevista");
  });

  it("avanço para Aprovado também notifica", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const applicationId = await applyToJob(t, seed);
    const recruiter = asRecruiter(t, seed.recruiterId);

    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + DAY,
      interviewLink: "https://meet.example.com/unicap-1",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "aprovado",
      expectedStartDate: Date.now() + 7 * DAY,
    });

    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    const mockLogs = log.mock.calls.flat().join("\n");
    expect(mockLogs).toContain("Aprovado");
  });

  it("etapa intermediária (triagem) NÃO dispara e-mail", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const applicationId = await applyToJob(t, seed);

    await asRecruiter(t, seed.recruiterId).mutation(
      api.applications.moveApplication,
      { applicationId, to: "triagem" },
    );
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    expect(log).not.toHaveBeenCalled();
  });

  it("preferência 'Atualizações de Candidatura' desligada corta o envio", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t, { notifyApplicationUpdates: false });
    const applicationId = await applyToJob(t, seed);
    const recruiter = asRecruiter(t, seed.recruiterId);

    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + DAY,
      interviewLink: "https://meet.example.com/unicap-1",
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    expect(log).not.toHaveBeenCalled();
  });

  it("recuo (desfazer aprovação → entrevista) NÃO notifica", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const applicationId = await applyToJob(t, seed);
    const recruiter = asRecruiter(t, seed.recruiterId);

    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "triagem",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + DAY,
      interviewLink: "https://meet.example.com/unicap-1",
    });
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "aprovado",
      expectedStartDate: Date.now() + 7 * DAY,
    });
    // Executa os 2 e-mails dos avanços legítimos e limpa o spy.
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));
    log.mockClear();

    // Recuo permitido (desfazer): aprovado → entrevista.
    await recruiter.mutation(api.applications.moveApplication, {
      applicationId,
      to: "entrevista",
      interviewDate: Date.now() + 2 * DAY,
      interviewLink: "https://meet.example.com/unicap-2",
    });
    await t.finishAllScheduledFunctions(() => vi.advanceTimersByTime(1));

    expect(log).not.toHaveBeenCalled();
  });
});

describe("[FINAL_UPGRADE Etapa 3] — myStats e trackProfileView", () => {
  it("myStats devolve total, taxa de sucesso, distribuição e visualizações", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);

    // 4 candidaturas com stages variados + contador de visualizações.
    await t.run(async (ctx) => {
      for (const [stage, matchScore] of [
        ["entrevista", 90],
        ["aprovado", 80],
        ["triagem", 40],
        ["reprovado", 50],
      ] as const) {
        await ctx.db.insert("applications", {
          jobId: seed.jobId,
          studentId: seed.studentId,
          stage,
          matchScore,
          appliedAt: Date.now(),
        });
      }
      await ctx.db.patch(seed.studentId, { profileViews: 7 });
    });

    const stats = await asStudent(t, seed.studentUserId).query(
      api.applications.myStats,
    );
    expect(stats).not.toBeNull();
    expect(stats?.total).toBe(4);
    expect(stats?.successRate).toBe(50); // (entrevista + aprovado) / 4
    expect(stats?.byStage).toEqual({
      inscrito: 0,
      triagem: 1,
      entrevista: 1,
      aprovado: 1,
      reprovado: 1,
    });
    expect(stats?.profileViews).toBe(7);
    expect(stats?.averageMatch).toBe(65); // (90+80+40+50)/4
  });

  it("aluno sem candidaturas zera tudo (nunca NaN)", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const stats = await asStudent(t, seed.studentUserId).query(
      api.applications.myStats,
    );
    expect(stats?.total).toBe(0);
    expect(stats?.successRate).toBe(0);
    expect(stats?.averageMatch).toBe(0);
  });

  it("trackProfileView: recrutador dono incrementa; estranho é bloqueado", async () => {
    const t = convexTest({ schema, modules });
    const seed = await seedWorld(t);
    const applicationId = await applyToJob(t, seed);

    const first = await asRecruiter(t, seed.recruiterId).mutation(
      api.applications.trackProfileView,
      { applicationId },
    );
    expect(first).toEqual({ ok: true, profileViews: 1 });

    const second = await asRecruiter(t, seed.recruiterId).mutation(
      api.applications.trackProfileView,
      { applicationId },
    );
    expect(second.profileViews).toBe(2);

    // Aluno não conta visualizações de perfil alheio.
    await expect(
      asStudent(t, seed.studentUserId).mutation(
        api.applications.trackProfileView,
        {
          applicationId,
        },
      ),
    ).rejects.toThrow(/recrutador/i);
  });
});
