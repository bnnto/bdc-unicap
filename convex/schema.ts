import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

/**
 * Esquema da iteração S1 — Autenticação e Perfis (LGPD), issue [S1-1].
 * `authTables` (Convex Auth) fornece users/sessions/accounts/refresh tokens etc.
 * As demais tabelas de domínio (students, jobs, applications, extensionProjects)
 * serão adicionadas issue a issue conforme SPRINTS.md. Referência: CEREBRO.md §4.1.
 */
export default defineSchema({
  ...authTables,

  /**
   * Usuário da aplicação, com papel único e ativação (R7).
   * O documento `users` do Convex Auth é estendido com `role` e `active`.
   */
  users: defineTable({
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    image: v.optional(v.string()),
    isAnonymous: v.optional(v.boolean()),
    role: v.optional(
      v.union(
        v.literal("aluno"),
        v.literal("recrutador"),
        v.literal("gestor"),
        v.literal("empresa"),
      ),
    ),
    active: v.optional(v.boolean()),
  })
    .index("by_email", ["email"])
    .index("by_role", ["role"]),

  /**
   * Consentimento LGPD versionado (R7) — o aceite é registrado na [S1-2];
   * a tabela já nasce aqui para que o cadastro possa gravá-la atomicamente.
   */
  consents: defineTable({
    userId: v.id("users"),
    termVersion: v.string(),
    acceptedAt: v.number(),
  }).index("by_user", ["userId"]),

  /**
   * Perfil do aluno/egresso (issues [S1-3]/[S1-4], R1/R2/R6).
   * Um perfil por usuário (índice by_user único na prática).
   * `enrollment` normalizado (só dígitos) para unicidade da matrícula;
   * `status` alimenta a regra de vínculo (R1) nas buscas de talentos;
   * `visibility` (R2) e `showContactToRecruiters` (R6) — default PRIVADO:
   * o aluno opta por se expor, nunca o contrário.
   */
  students: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    enrollment: v.string(),
    status: v.union(
      v.literal("ativo"),
      v.literal("egresso"),
      v.literal("inativo"),
    ),
    course: v.string(),
    graduationYear: v.number(),
    semester: v.optional(v.number()),
    location: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()),
    availability: v.union(
      v.literal("estagio"),
      v.literal("integral"),
      v.literal("meio_periodo"),
      v.literal("freelancer"),
    ),
    /** R2 — "publico" (banco de talentos) | "somente_candidaturas". */
    visibility: v.optional(
      v.union(v.literal("publico"), v.literal("somente_candidaturas")),
    ),
    /** R6 — autorização geral de contato (default ausente = false). */
    showContactToRecruiters: v.optional(v.boolean()),

    /** [S1-5] — competências (chips, máx. 20) e idiomas com nível (máx. 8). */
    skills: v.optional(v.array(v.string())),
    languages: v.optional(
      v.array(
        v.object({
          name: v.string(),
          level: v.union(
            v.literal("basico"),
            v.literal("intermediario"),
            v.literal("avancado"),
            v.literal("fluente"),
            v.literal("nativo"),
          ),
        }),
      ),
    ),

    /**
     * [S2-1] — Currículo Vitae (headline, resumo, experiências, histórico
     * acadêmico). Validado pela regra pura em src/lib/resume.ts.
     */
    resumeData: v.optional(
      v.object({
        headline: v.string(),
        summary: v.string(),
        experiences: v.array(
          v.object({
            company: v.string(),
            role: v.string(),
            period: v.string(),
            description: v.string(),
          }),
        ),
        academicHistory: v.array(
          v.object({
            item: v.string(),
            year: v.number(),
          }),
        ),
      }),
    ),
  })
    .index("by_user", ["userId"])
    .index("by_enrollment", ["enrollment"])
    .index("by_status_course", ["status", "course"])
    .index("by_visibility_status", ["visibility", "status"])
    /**
     * [S2-4] Entrada alternativa da busca do Banco de Talentos quando o
     * recrutador filtra disponibilidade: prefixo por status (R1) e faixa
     * por disponibilidade. Evita varrer todos os públicos ativos+egressos.
     */
    .index("by_status_availability", ["status", "availability"]),

  /**
   * Vagas publicadas por recrutadores (issue [S3-1]).
   * Pré-requisitos com flag `required` — base para R3 (matching) e R8
   * (explicação dos critérios nas próximas issues). `status` controla o
   * ciclo de vida: aberta recebe candidaturas; fechada/encerrada não.
   * `recruiterId` aponta para `users`, nunca para o aluno (R2/R6 intactos).
   */
  jobs: defineTable({
    recruiterId: v.id("users"),
    title: v.string(),
    description: v.string(),
    prerequisites: v.array(
      v.object({ item: v.string(), required: v.boolean() }),
    ),
    contractType: v.union(
      v.literal("estagio"),
      v.literal("clt"),
      v.literal("pj"),
      v.literal("temporario"),
    ),
    salaryMin: v.optional(v.number()),
    salaryMax: v.optional(v.number()),
    location: v.optional(v.string()),
    status: v.union(
      v.literal("aberta"),
      v.literal("fechada"),
      v.literal("encerrada"),
    ),
    /**
     * [S3-2] R4 — expiração: `expiresAt = publishedAt + 30d` gravado na
     * publicação; renovação reativa o prazo; cron diário encerra vencidas.
     */
    publishedAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    /**
     * [S3-4] Insumos dos bônus do matching (R8): idioma mínimo exigido e
     * disponibilidade desejada — opcionais; ausentes, o bônus não entra.
     */
    requiredLanguage: v.optional(
      v.object({
        name: v.string(),
        level: v.union(
          v.literal("basico"),
          v.literal("intermediario"),
          v.literal("avancado"),
          v.literal("fluente"),
          v.literal("nativo"),
        ),
      }),
    ),
    availability: v.optional(
      v.union(
        v.literal("estagio"),
        v.literal("integral"),
        v.literal("meio_periodo"),
        v.literal("freelancer"),
      ),
    ),
  })
    .index("by_recruiter", ["recruiterId"])
    .index("by_status", ["status"]),

  /**
   * Candidaturas dos alunos às vagas (issues [S3-4]/[S4-1], R8).
   * `matchScore` (0–100) é calculado NO SERVIDOR na mutation `applyToJob`
   * com a regra pura de matching (S3-3) — fonte da verdade (CA 1).
   * `stage` segue o pipeline Kanban do issue [S4-1] (5 colunas).
   */
  applications: defineTable({
    jobId: v.id("jobs"),
    studentId: v.id("students"),
    stage: v.union(
      v.literal("inscrito"),
      v.literal("triagem"),
      v.literal("entrevista"),
      v.literal("aprovado"),
      v.literal("reprovado"),
    ),
    matchScore: v.number(),
    appliedAt: v.number(),
  })
    .index("by_job", ["jobId"])
    .index("by_student", ["studentId"])
    .index("by_job_stage", ["jobId", "stage"]),
});
