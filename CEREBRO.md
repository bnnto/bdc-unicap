# 🧠 CEREBRO.md — Arquitetura do Projeto

**Projeto:** Banco de Currículos e Setor de Extensão — UNICAP
**Stack imutável:** React + Vite · Tailwind CSS · Convex (DB/Backend) · Vitest · Bun
**Identidade visual:** UNICAP — Dourado e Bordô (ver `stitch_banco_de_curriculos_unicap/academic_prestige_modern/DESIGN.md`)

---

## 1. Visão Geral

O sistema é um portal acadêmico que integra dois domínios de negócio:

1. **Setor de Extensão** — banco de projetos de extensão com cadastro, acompanhamento (ativos/não ativos), divulgação pública e painel gestor com métricas e filtros.
2. **Banco de Currículos** — perfis/currículos de alunos, banco de talentos com filtros avançados, publicação de vagas, matching currículo↔vaga, pipeline de candidaturas (Kanban) e dashboard operacional com exportação.

Arquitetura **serverless**: o Convex concentra schema, funções reativas (query/mutation/action) e regras de negócio; o React consome as queries de forma reativa (`useQuery`), sem estado duplicado de servidor no cliente. **Nenhum backend próprio adicional.**

---

## 2. Regras de Negócio (fonte da verdade)

| # | Regra | Implementação |
|---|-------|---------------|
| R1 | **Validação de vínculo** — apenas alunos/egressos com matrícula ativa/cadastrada aparecem na busca | `students.status ∈ {ativo, egresso, inativo}`; queries de busca (talentos e dashboard) filtram `status != "inativo"` |
| R2 | **Visibilidade** — aluno escolhe "Visível para recrutadores" ou apenas para candidaturas ativas | `students.visibility: "publico" \| "somente_candidaturas"`; busca de talentos exige `visibility === "publico"` |
| R3 | **Bloqueio de candidatura** — fora dos pré-requisitos obrigatórios → bloqueado e avisado | Mutation `applyToJob` valida requisitos obrigatórios e retorna erro estruturado antes de gravar |
| R4 | **Expiração da vaga** — 30 dias padrão; sem renovação → "Encerrada" | `jobs.expiresAt = publishedAt + 30d`; função `closeExpiredJobs` agendada (`crons`) + validação no momento da candidatura |
| R5 | **Feedback obrigatório** — motivo padronizado ao reprovar (auditoria/métricas) | `applications.rejectionReason` com enum fixo, exigido na mutation de reprovação |
| R6 | **LGPD** — recrutador só vê contato com autorização/aceite no processo | `students.showContactToRecruiters: boolean`; contato exposto apenas após candidatura aceita ou flag de autorização |
| R7 | **Consentimento LGPD** | `consents` com versão do termo + timestamp, exigido no cadastro |
| R8 | **Matching** — % compatibilidade currículo × vaga | Calculado e persistido na candidatura; exibido ao recrutador e ao aluno |
| R9 | **Extensão — divulgação** | Projetos `ativo: true` visíveis a estudantes, professores e público externo sem autenticação |

---

## 3. Estrutura de Diretórios

```
/
├── CEREBRO.md                  # Este documento
├── SPRINTS.md                  # Cronograma iterativo
├── README.md                   # Grupo, stack e gestão
├── index.html
├── package.json                # Scripts Bun (dev, build, test, lint)
├── bunfig.toml
├── tailwind.config.ts          # Tokens Dourado/Bordô do DESIGN.md
├── vite.config.ts
├── .env                        # NEXT_PUBLIC_CONVEX_URL etc.
│
├── convex/                     # Backend — espelha os domínios
│   ├── schema.ts               # Único schema do banco
│   ├── students.ts             # Perfis, currículo, visibilidade, vínculo
│   ├── consents.ts             # Termos LGPD
│   ├── jobs.ts                 # Vagas, expiração, candidatura/matching
│   ├── applications.ts         # Pipeline Kanban + feedback obrigatório
│   ├── talentSearch.ts         # Banco de talentos (filtros avançados)
│   ├── extensionProjects.ts    # Projetos de extensão
│   ├── metrics.ts              # Dashboard (vagas, empregabilidade, TTH, funil)
│   ├── reports.ts              # Exportação CSV/XLSX e PDF
│   ├── crons.ts                # Encerramento automático de vagas (R4)
│   ├── auth.config.ts          # Config de autenticação Convex Auth
│   └── _generated/             # Codegen Convex (nunca editar à mão)
│
├── src/
│   ├── main.tsx                # Bootstrap React
│   ├── App.tsx                 # Providers + rotas
│   ├── index.css               # Tailwind directives + tokens de tema
│   │
│   ├── routes/                 # Páginas por domínio
│   │   ├── public/             # Landing, divulgação de extensão, vagas públicas
│   │   ├── student/            # Cadastro, currículo, minhas candidaturas
│   │   ├── recruiter/          # Vagas, Kanban, banco de talentos
│   │   ├── manager/            # Painel gestor de extensão + dashboard
│   │   └── auth.tsx
│   │
│   ├── components/
│   │   ├── ui/                 # Componentes próprios leves (Button, Input, Card, Badge…)
│   │   ├── layout/             # Header, Footer, Navegação
│   │   ├── careers/            # Cards de vaga, Kanban, chips de matching
│   │   ├── extension/          # Cards de projeto, filtros
│   │   └── dashboard/          # Métricas, gráficos leves, filtros de período
│   │
│   ├── lib/
│   │   ├── matching.ts         # Algoritmo de compatibilidade (puro, testável)
│   │   ├── resume.ts           # Geração de currículo para download
│   │   ├── export.ts           # CSV/XLSX e PDF (sem libs pesadas)
│   │   ├── validation.ts       # Schemas de formulário
│   │   └── formatters.ts       # Datas, moeda, percentuais
│   │
│   ├── hooks/                  # useJobs, useProfile, useFilters…
│   └── types/                  # Tipos compartilhados (Id<"jobs">, DTOs)
│
└── tests/
    ├── unit/                   # Vitest puro (matching, validações, formatters)
    ├── components/             # Vitest + Testing Library
    └── integration/            # Fluxos Convex mockados (candidatura, pipeline)
```

**Convenções:**
- Convex: um arquivo por domínio, funções exportadas com `query`/`mutation`/`action` e validação de args com `v`.
- React: hooks importados apenas de `react`; componentes pequenos e co-localizados.
- Componentes de UI **próprios e leves** (sem shadcn/ui ou libs pesadas de UI).

---

## 4. Modelagem Reativa do Convex

### 4.1 `convex/schema.ts`

```ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ---------- IDENTIDADE / LGPD ----------
  users: defineTable({
    email: v.string(),
    role: v.union(v.literal("aluno"), v.literal("recrutador"), v.literal("gestor"), v.literal("empresa")),
    name: v.string(),
    active: v.boolean(),
  }).index("by_email", ["email"]),

  consents: defineTable({
    userId: v.id("users"),
    termVersion: v.string(),
    acceptedAt: v.number(),
  }).index("by_user", ["userId"]),

  // ---------- PERFIS / CURRÍCULO ----------
  students: defineTable({
    userId: v.id("users"),
    fullName: v.string(),
    enrollment: v.string(),            // matrícula
    status: v.union(v.literal("ativo"), v.literal("egresso"), v.literal("inativo")), // R1
    course: v.string(),
    graduationYear: v.number(),
    semester: v.optional(v.number()),
    location: v.optional(v.string()),
    linkedinUrl: v.optional(v.string()),
    portfolioUrl: v.optional(v.string()), // GitHub/Portfólio
    skills: v.array(v.string()),
    languages: v.array(v.object({ name: v.string(), level: v.string() })),
    academicHistory: v.array(v.object({ item: v.string(), year: v.number() })),
    availability: v.union(v.literal("estagio"), v.literal("integral"), v.literal("meio_periodo"), v.literal("freelancer")),
    visibility: v.union(v.literal("publico"), v.literal("somente_candidaturas")),   // R2
    showContactToRecruiters: v.boolean(),                                            // R6
    resumeData: v.optional(v.object({
      headline: v.string(),
      summary: v.string(),
      experiences: v.array(v.object({ company: v.string(), role: v.string(), period: v.string(), description: v.string() })),
    })),
  })
    .index("by_status_visibility", ["status", "visibility"])
    .index("by_course", ["course"])
    .index("by_enrollment", ["enrollment"])
    .index("by_user", ["userId"]),

  // ---------- VAGAS ----------
  jobs: defineTable({
    recruiterId: v.id("users"),
    companyName: v.string(),
    title: v.string(),
    description: v.string(),
    prerequisites: v.array(v.object({ skill: v.string(), mandatory: v.boolean() })),
    contractType: v.union(v.literal("CLT"), v.literal("PJ"), v.literal("estagio"), v.literal("trainee"), v.literal("freelance")),
    salaryMin: v.number(),
    salaryMax: v.number(),
    location: v.string(),
    status: v.union(v.literal("aberta"), v.literal("preenchida"), v.literal("encerrada")), // R4
    publishedAt: v.number(),
    expiresAt: v.number(),  // publishedAt + 30 dias (R4)
    filledAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_expires", ["expiresAt"])
    .index("by_recruiter", ["recruiterId"]),

  // ---------- CANDIDATURAS ----------
  applications: defineTable({
    jobId: v.id("jobs"),
    studentId: v.id("students"),
    matchPercentage: v.number(),  // R8
    stage: v.union(
      v.literal("inscrito"), v.literal("triagem"), v.literal("entrevista"),
      v.literal("aprovado"), v.literal("reprovado"),
    ),
    rejectionReason: v.optional(v.union(
      v.literal("requisitos_insuficientes"), v.literal("perfil_nao_alinhado"),
      v.literal("outro_candidato_selecionado"), v.literal("desistencia_candidato"),
    )),                                        // R5
    contactReleased: v.boolean(),              // R6 — setado quando aluno autoriza/aceita
    appliedAt: v.number(),
    stageChangedAt: v.number(),
  })
    .index("by_job_stage", ["jobId", "stage"])
    .index("by_student", ["studentId"])
    .index("by_job", ["jobId"]),

  // ---------- EXTENSÃO ----------
  extensionProjects: defineTable({
    title: v.string(),
    description: v.string(),
    coordinator: v.string(),
    professorId: v.optional(v.id("users")),
    area: v.string(),                 // eixo temático
    isActive: v.boolean(),            // acompanhamento ativo/não ativo
    targetAudience: v.array(v.string()),
    createdAt: v.number(),
  })
    .index("by_active", ["isActive"])
    .index("by_area", ["area"]),
})
```

### 4.2 Funções por domínio (arquivos `convex/*.ts`)

| Arquivo | Funções principais | Regras |
|---|---|---|
| `students.ts` | `upsertProfile`, `getProfile`, `setVisibility`, `setContactConsent` | R1, R2, R6 |
| `consents.ts` | `acceptTerm`, `hasAcceptedLatest` | R7 |
| `jobs.ts` | `publishJob`, `renewJob`, `closeExpiredJobs`, `listOpenJobs`, `getJob` | R4 |
| `applications.ts` | `applyToJob` (valida R3, calcula R8, grava stage `inscrito`), `moveStage` (Kanban; reprovação exige motivo R5), `listByStage` | R3, R5, R6, R8 |
| `talentSearch.ts` | `searchTalentos` (curso, formação, competências, localização, idioma, disponibilidade; exclui inativos R1 e não-públicos R2) | R1, R2 |
| `extensionProjects.ts` | `createProject`, `updateProject`, `toggleActive`, `listPublicProjects`, `listForManagement` | R9 |
| `metrics.ts` | `dashboard` — total de vagas abertas/preenchidas, taxa de empregabilidade, time-to-hire (`filledAt − appliedAt` médio), funil de conversão por stage, empresas/vagas mais ativas; filtros por período, curso, empresa e status | R4 |
| `reports.ts` | `exportCSV`, `exportXLSX`, `exportPDF` (gerados a partir das queries de métricas) | — |

**Reatividade:** telas usam `useQuery(api.applications.listByStage, { jobId })` etc. — atualização em tempo real sem polling. Writes via `useMutation`. Expiração via `crons.ts` (diária) + checagem defensiva em `applyToJob`.

### 4.3 Algoritmo de Matching (R8) — `src/lib/matching.ts`

Função **pura e testável**, sem I/O:

```
base = (competências do currículo ∩ competências da vaga) / competências da vaga
peso obrigatórios = 1.2, opcionais = 1.0
bônus idioma (quando exigido), bônus disponibilidade compatível
score final = clamp(0–100)
```

- ≥ 85% → badge "Strong Match" (verde escuro `#059669`)
- 50–84% → "Medium Match" (âmbar `#D97706`)
- < 50% → "Low Match" (vermelho `#DC2626`)

Calculado no cliente para preview e **recalculado e persistido** na mutation `applyToJob` (fonte da verdade no servidor).

---

## 5. Design System — UNICAP (Dourado e Bordô)

Tokens derivados de `stitch_banco_de_curriculos_unicap/academic_prestige_modern/DESIGN.md`, definidos em `tailwind.config.ts` + variáveis CSS em `src/index.css`:

| Papel | Token | Hex |
|---|---|---|
| Primário institucional (Bordô) | `primary` | `#6B1426` |
| Primário hover | `primary-hover` | `#520F1D` |
| Acento premium (Dourado) | `secondary` | `#C89D3C` |
| Informacional | `tertiary` | `#2563EB` |
| Canvas | `background` | `#F8F9FA` |
| Texto principal | `on-surface` | `#1E293B` |
| Erro | `error` | `#DC2626` |
| Sucesso (aprovado/strong match) | `success` | `#059669` |

- Tipografia: **Merriweather** (títulos institucionais) + **Plus Jakarta Sans** (UI/dados).
- Raio padrão 4px (controles) / 8px (cards); elevações conforme DESIGN.md.
- Semântica de status (aprovado/triagem/reprovado) conforme tabela de badges do DESIGN.md.

---

## 6. Regras de Qualidade

### 6.1 TypeScript Strict

- `"strict": true` (inclui `noUncheckedIndexedAccess`, `noImplicitOverride`) no `tsconfig`.
- `tsc --noEmit` a cada turno (verificação automática do Freebuff + script `typecheck`).
- Convex: tipos inferidos do schema; `Id<"jobs">` etc. importados de `_generated/dataModel`.
- Sem `any`; erros de negócio como tipos discriminated unions (`{ ok: false; reason: RejectionReason }`).

### 6.2 TDD com Vitest

- **Test-first** para lógica de negócio: `src/lib/matching.ts`, validações, regras de blockers de candidatura, cálculo de time-to-hire e funil.
- Pirâmide:
  - **Unitários** (Vitest puro): matching, formatters, regras R3–R8 como funções puras.
  - **Componentes** (Vitest + Testing Library): formulários, Kanban (drag/drop lógico), filtros com roles ARIA.
  - **Integração**: funções Convex contra contexto mockado (`convexTest` ou mocks de `ctx.db`).
- Cobertura mínima alvo: **80% em `src/lib/**` e `convex/**`** (regras de negócio).
- Scripts `package.json`:
  ```json
  {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  }
  ```
- ESLint 9 + Prettier + Husky/lint-staged; **Conventional Commits**.

### 6.3 Acessibilidade & LGPD (não-funcionais verificáveis)

- WCAG AA: contraste garantido pelos tokens do DESIGN.md; foco visível com halo dourado; navegação por teclado em Kanban e filtros.
- LGPD: consentimento versionado (R7), contato oculto até autorização (R6), dados sensíveis cifrados em repouso pelo provedor + HTTPS.
- Escalabilidade: índices Convex para busca de talentos (base 10k+ currículos) — filtros sempre ancorados em índices, nunca full-scan.

---

## 7. Decisões de Arquitetura (resumo ADR)

| ADR | Decisão | Motivo |
|---|---|---|
| 001 | Convex como único backend | Stack imutável; reatividade nativa elimina camada de cache client |
| 002 | Matching como função pura em `src/lib` + persistência na mutation | Testável isoladamente (TDD) e auditável no servidor |
| 003 | Componentes UI próprios leves | Restrição do README (sem libs pesadas); tokens Tailwind locais |
| 004 | Expiração de vagas via Convex `crons` + validação defensiva | R4 robusta mesmo se cron falhar |
| 005 | Exportação PDF/CSV gerada client-side a partir das queries | Sem servidor adicional; PDF via render/print de template próprio |
