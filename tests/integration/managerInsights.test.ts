/**
 * [GESTOR_BACKEND] Testes de INTEGRAÇÃO das agregações dos Insights
 * Estratégicos do Painel do Gestor — queries gestor-only de
 * convex/manager.ts executadas contra o mock oficial do backend Convex
 * (convex-test), com identidades autenticadas.
 *
 * CAs do plano:
 * 1. getRejectionInsights — contagem de candidaturas reprovadas agrupada
 *    por motivo (R5), com filtro por curso;
 * 2. getSkillsRadar — demanda (vagas) × oferta (alunos) por competência;
 * 3. getEngagementMetrics — perfis incompletos e sem currículo (R1).
 * Guard: acesso blindado ao papel gestor com consentimento vigente.
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import schema from "../../convex/schema";
import { CURRENT_TERM_VERSION } from "../../convex/consentTerms";

const modules = import.meta.glob("../../convex/**/*.*s");

type World = ReturnType<typeof convexTest>;

const DAY = 24 * 60 * 60 * 1000;

const MANAGER = { email: "gestor@unicap.br", subject: "gestor-1" };
const STUDENT = { email: "aluno@unicap.br", subject: "aluno-1" };
const RECRUITER = { email: "rh@empresa.com", subject: "rh-1" };

type RejectionReason =
  | "requisitos_obrigatorios"
  | "formacao_incompativel"
  | "disponibilidade_incompativel"
  | "idioma_insuficiente"
  | "perfil_duplicado"
  | "vaga_preenchida"
  | "vaga_cancelada"
  | "outro";

type SeedStudent = {
  fullName: string;
  enrollment: string;
  status: "ativo" | "egresso" | "inativo";
  course: string;
  skills?: string[];
  withResume?: boolean;
};

type SeedJob = {
  title: string;
  status: "aberta" | "encerrada";
  prerequisites: { item: string; required: boolean }[];
};

/**
 * Semeia o mundo de teste: gestor com consentimento, um usuário-aluno
 * "ator" (identidade das queries de guard), alunos com variedade de
 * status/skills/currículo e vagas com pré-requisitos.
 */
async function seedWorld(
  t: World,
  options: {
    students?: SeedStudent[];
    jobs?: SeedJob[];
    withManagerConsent?: boolean;
  } = {},
) {
  const students = options.students ?? [];
  const jobs = options.jobs ?? [];
  const withManagerConsent = options.withManagerConsent ?? true;
  return t.run(async (ctx) => {
    const managerId = await ctx.db.insert("users", {
      email: MANAGER.email,
      name: "Gestora UNICAP",
      role: "gestor",
      active: true,
    });
    const recruiterUserId = await ctx.db.insert("users", {
      email: RECRUITER.email,
      name: "Alpha Tech",
      role: "recrutador",
      active: true,
    });
    // Recrutador com aceite vigente (cenário real do portal) — o guard
    // passa por R7 e chega ao bloqueio de papel (só gestor acessa).
    await ctx.db.insert("consents", {
      userId: recruiterUserId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });
    if (withManagerConsent) {
      await ctx.db.insert("consents", {
        userId: managerId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
    }

    // Ator aluno (resolve pelo e-mail da identidade de teste, fallback do
    // getCurrentUser — mesmo padrão de tests/integration/operational.test.ts).
    const studentActorUserId = await ctx.db.insert("users", {
      email: STUDENT.email,
      name: "Maria da Silva",
      role: "aluno",
      active: true,
    });
    await ctx.db.insert("consents", {
      userId: studentActorUserId,
      termVersion: CURRENT_TERM_VERSION,
      acceptedAt: Date.now(),
    });

    const studentIds: Id<"students">[] = [];
    for (const seed of students) {
      const userId = await ctx.db.insert("users", {
        email: `${seed.enrollment}@aluno.unicap.br`,
        name: seed.fullName,
        role: "aluno",
        active: true,
      });
      await ctx.db.insert("consents", {
        userId,
        termVersion: CURRENT_TERM_VERSION,
        acceptedAt: Date.now(),
      });
      const studentId = await ctx.db.insert("students", {
        userId,
        fullName: seed.fullName,
        enrollment: seed.enrollment,
        status: seed.status,
        course: seed.course,
        graduationYear: 2026,
        availability: "estagio",
        visibility: "publico",
        ...(seed.skills !== undefined ? { skills: seed.skills } : {}),
        ...(seed.withResume === true
          ? {
              resumeData: {
                headline: "Desenvolvedora",
                summary: "Resumo",
                experiences: [],
                academicHistory: [],
              },
            }
          : {}),
      });
      studentIds.push(studentId);
    }

    const jobIds: Id<"jobs">[] = [];
    for (const seed of jobs) {
      const jobId = await ctx.db.insert("jobs", {
        recruiterId: recruiterUserId,
        title: seed.title,
        description: "Descrição da vaga.",
        prerequisites: seed.prerequisites,
        contractType: "estagio",
        status: seed.status,
        publishedAt: Date.now(),
        expiresAt: Date.now() + 30 * DAY,
      });
      jobIds.push(jobId);
    }

    return {
      managerId,
      recruiterUserId,
      studentActorUserId,
      studentIds,
      jobIds,
    };
  });
}

async function seedApplication(
  t: World,
  input: {
    jobId: Id<"jobs">;
    studentId: Id<"students">;
    stage: "inscrito" | "triagem" | "entrevista" | "aprovado" | "reprovado";
    rejectionReason?: RejectionReason;
  },
) {
  await t.run(async (ctx) => {
    await ctx.db.insert("applications", {
      jobId: input.jobId,
      studentId: input.studentId,
      stage: input.stage,
      matchScore: 50,
      appliedAt: Date.now(),
      ...(input.rejectionReason !== undefined
        ? { rejectionReason: input.rejectionReason }
        : {}),
    });
  });
}

function asManager(t: World, managerId: string) {
  return t.withIdentity({
    ...MANAGER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${managerId}`,
  });
}

function asStudent(t: World, userId: string) {
  return t.withIdentity({
    ...STUDENT,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${userId}`,
  });
}

function asRecruiter(t: World, userId: string) {
  return t.withIdentity({
    ...RECRUITER,
    emailVerificationTime: Date.now(),
    tokenIdentifier: `tid-${userId}`,
  });
}

describe("[GESTOR_BACKEND] getRejectionInsights — motivos de reprovação (R5)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 1 — contagem agrupada por motivo, ordenada do maior para o menor", async () => {
    const t = convexTest(schema, modules);
    const { managerId, studentIds, jobIds } = await seedWorld(t, {
      students: [
        {
          fullName: "Maria",
          enrollment: "1000001",
          status: "ativo",
          course: "Ciência da Computação",
        },
        {
          fullName: "João",
          enrollment: "1000002",
          status: "ativo",
          course: "Direito",
        },
      ],
      jobs: [{ title: "Vaga A", status: "encerrada", prerequisites: [] }],
    });
    const [jobA] = jobIds;
    const [maria, joao] = studentIds;

    // 2 reprovados por requisitos, 1 por idioma, 1 por outro;
    // aprovado e triagem NÃO entram (só stage = reprovado).
    await seedApplication(t, {
      jobId: jobA!,
      studentId: maria!,
      stage: "reprovado",
      rejectionReason: "requisitos_obrigatorios",
    });
    await seedApplication(t, {
      jobId: jobA!,
      studentId: joao!,
      stage: "reprovado",
      rejectionReason: "requisitos_obrigatorios",
    });
    await seedApplication(t, {
      jobId: jobA!,
      studentId: maria!,
      stage: "reprovado",
      rejectionReason: "idioma_insuficiente",
    });
    await seedApplication(t, {
      jobId: jobA!,
      studentId: joao!,
      stage: "reprovado",
      rejectionReason: "outro",
    });
    await seedApplication(t, {
      jobId: jobA!,
      studentId: maria!,
      stage: "aprovado",
    });
    await seedApplication(t, {
      jobId: jobA!,
      studentId: joao!,
      stage: "triagem",
    });

    const result = await asManager(t, managerId).query(
      api.manager.getRejectionInsights,
      {},
    );

    expect(result.total).toBe(4);
    // Empate (1×1) resolve por ordem alfabética do motivo; rótulo R5
    // pronto para exibição (REJECTION_LABELS).
    expect(result.rows).toEqual([
      {
        reason: "requisitos_obrigatorios",
        label: "Requisitos obrigatórios",
        count: 2,
        percent: 50,
      },
      {
        reason: "idioma_insuficiente",
        label: "Idioma insuficiente",
        count: 1,
        percent: 25,
      },
      { reason: "outro", label: "Outros", count: 1, percent: 25 },
    ]);
  });

  it("filtro por curso restringe as candidaturas agregadas", async () => {
    const t = convexTest(schema, modules);
    const { managerId, studentIds, jobIds } = await seedWorld(t, {
      students: [
        {
          fullName: "Maria",
          enrollment: "1000001",
          status: "ativo",
          course: "Ciência da Computação",
        },
        {
          fullName: "João",
          enrollment: "1000002",
          status: "ativo",
          course: "Direito",
        },
      ],
      jobs: [{ title: "Vaga A", status: "encerrada", prerequisites: [] }],
    });
    const [jobA] = jobIds;
    const [maria, joao] = studentIds;
    await seedApplication(t, {
      jobId: jobA!,
      studentId: maria!,
      stage: "reprovado",
      rejectionReason: "requisitos_obrigatorios",
    });
    await seedApplication(t, {
      jobId: jobA!,
      studentId: joao!,
      stage: "reprovado",
      rejectionReason: "idioma_insuficiente",
    });

    const result = await asManager(t, managerId).query(
      api.manager.getRejectionInsights,
      { course: "Ciência da Computação" },
    );

    expect(result.total).toBe(1);
    expect(result.rows).toEqual([
      {
        reason: "requisitos_obrigatorios",
        label: "Requisitos obrigatórios",
        count: 1,
        percent: 100,
      },
    ]);
  });

  it("sem reprovados → total 0 e lista vazia", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const result = await asManager(t, managerId).query(
      api.manager.getRejectionInsights,
      {},
    );

    expect(result.total).toBe(0);
    expect(result.rows).toEqual([]);
  });
});

describe("[GESTOR_BACKEND] getSkillsRadar — demanda × oferta", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 2 — compara requisitos das vagas com skills dos alunos", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      students: [
        {
          fullName: "Maria",
          enrollment: "2000001",
          status: "ativo",
          course: "Ciência da Computação",
          skills: ["React", "Python"],
        },
        {
          fullName: "João",
          enrollment: "2000002",
          status: "egresso",
          course: "Ciência da Computação",
          skills: ["React"],
        },
        {
          fullName: "Ana",
          enrollment: "2000003",
          status: "inativo", // R1 — nunca entra na oferta
          course: "Ciência da Computação",
          skills: ["React", "SQL"],
        },
      ],
      jobs: [
        {
          title: "Front",
          status: "aberta",
          prerequisites: [
            { item: "React", required: true },
            { item: "SQL", required: false },
          ],
        },
        {
          title: "Backend",
          status: "encerrada",
          prerequisites: [{ item: "react", required: true }],
        },
      ],
    });

    const radar = await asManager(t, managerId).query(
      api.manager.getSkillsRadar,
      {},
    );

    // Demanda: React em 2 vagas, SQL em 1. Oferta (R1): React 2, Python 1.
    expect(radar).toEqual([
      { skill: "React", demand: 2, supply: 2 },
      { skill: "SQL", demand: 1, supply: 0 },
      { skill: "Python", demand: 0, supply: 1 },
    ]);
  });

  it("limit reduz ao Top N após a ordenação por demanda", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      students: [
        {
          fullName: "Maria",
          enrollment: "2000001",
          status: "ativo",
          course: "Ciência da Computação",
          skills: ["React", "SQL", "Python", "Docker"],
        },
      ],
      jobs: [
        {
          title: "Vaga",
          status: "aberta",
          prerequisites: [
            { item: "React", required: true },
            { item: "SQL", required: true },
            { item: "Python", required: true },
          ],
        },
      ],
    });

    const radar = await asManager(t, managerId).query(
      api.manager.getSkillsRadar,
      { limit: 2 },
    );

    // Empate total (demanda 1, oferta 1) resolve por ordem alfabética.
    expect(radar).toEqual([
      { skill: "Python", demand: 1, supply: 1 },
      { skill: "React", demand: 1, supply: 1 },
    ]);
  });

  it("filtro por curso limita a OFERTA (alunos), nunca a demanda", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      students: [
        {
          fullName: "Maria",
          enrollment: "2000001",
          status: "ativo",
          course: "Ciência da Computação",
          skills: ["React"],
        },
        {
          fullName: "João",
          enrollment: "2000002",
          status: "ativo",
          course: "Direito",
          skills: ["SQL"],
        },
      ],
      jobs: [
        {
          title: "Front",
          status: "aberta",
          prerequisites: [
            { item: "React", required: true },
            { item: "SQL", required: true },
          ],
        },
      ],
    });

    const radar = await asManager(t, managerId).query(
      api.manager.getSkillsRadar,
      { course: "Ciência da Computação" },
    );

    expect(radar).toEqual([
      { skill: "React", demand: 1, supply: 1 },
      { skill: "SQL", demand: 1, supply: 0 },
    ]);
  });

  it("sem vagas e sem alunos → lista vazia", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const radar = await asManager(t, managerId).query(
      api.manager.getSkillsRadar,
      {},
    );
    expect(radar).toEqual([]);
  });
});

describe("[GESTOR_BACKEND] getEngagementMetrics — perfis incompletos", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("CA 3 — conta total (R1), perfis sem skills e alunos sem currículo", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      students: [
        {
          fullName: "Completa",
          enrollment: "3000001",
          status: "ativo",
          course: "Ciência da Computação",
          skills: ["React"],
          withResume: true,
        },
        {
          fullName: "SemCV",
          enrollment: "3000002",
          status: "ativo",
          course: "Ciência da Computação",
          skills: ["React"],
        },
        {
          fullName: "SemSkills",
          enrollment: "3000003",
          status: "ativo",
          course: "Direito",
          skills: [],
        },
        {
          fullName: "Egresso",
          enrollment: "3000004",
          status: "egresso",
          course: "Ciência da Computação",
        },
        {
          fullName: "Inativa",
          enrollment: "3000005",
          status: "inativo", // R1 — fora de todas as contas
          course: "Ciência da Computação",
        },
      ],
    });

    const metrics = await asManager(t, managerId).query(
      api.manager.getEngagementMetrics,
      {},
    );

    expect(metrics).toEqual({
      total: 4,
      incompleteProfiles: 2, // SemSkills e Egresso (sem skills)
      noResume: 3, // SemCV, SemSkills e Egresso
    });
  });

  it("filtro por curso restringe o universo do termômetro", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, {
      students: [
        {
          fullName: "SemCV",
          enrollment: "3000002",
          status: "ativo",
          course: "Ciência da Computação",
          skills: ["React"],
        },
        {
          fullName: "SemSkills",
          enrollment: "3000003",
          status: "ativo",
          course: "Direito",
          skills: [],
        },
      ],
    });

    const metrics = await asManager(t, managerId).query(
      api.manager.getEngagementMetrics,
      { course: "Direito" },
    );

    expect(metrics).toEqual({ total: 1, incompleteProfiles: 1, noResume: 1 });
  });

  it("sem alunos elegíveis → zeros", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t);

    const metrics = await asManager(t, managerId).query(
      api.manager.getEngagementMetrics,
      {},
    );
    expect(metrics).toEqual({ total: 0, incompleteProfiles: 0, noResume: 0 });
  });
});

describe("[GESTOR_BACKEND] guards — insights são exclusivos do gestor", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const QUERIES = [
    api.manager.getRejectionInsights,
    api.manager.getSkillsRadar,
    api.manager.getEngagementMetrics,
  ];

  it("aluno autenticado é rejeitado nas três queries", async () => {
    const t = convexTest(schema, modules);
    const { studentActorUserId } = await seedWorld(t);
    const caller = asStudent(t, studentActorUserId);
    for (const query of QUERIES) {
      await expect(caller.query(query, {})).rejects.toThrow(/gestor/i);
    }
  });

  it("recrutador autenticado é rejeitado nas três queries", async () => {
    const t = convexTest(schema, modules);
    const { managerId, recruiterUserId } = await seedWorld(t);
    const caller = asRecruiter(t, recruiterUserId);
    for (const query of QUERIES) {
      await expect(caller.query(query, {})).rejects.toThrow(/gestor/i);
    }
    void managerId;
  });

  it("gestor sem consentimento vigente é rejeitado (R7)", async () => {
    const t = convexTest(schema, modules);
    const { managerId } = await seedWorld(t, { withManagerConsent: false });
    const caller = asManager(t, managerId);
    for (const query of QUERIES) {
      await expect(caller.query(query, {})).rejects.toThrow(/Consentimento/i);
    }
  });

  it("sem autenticação é rejeitado", async () => {
    const t = convexTest(schema, modules);
    await seedWorld(t);
    for (const query of QUERIES) {
      await expect(t.query(query, {})).rejects.toThrow(/Não autenticado/i);
    }
  });
});
