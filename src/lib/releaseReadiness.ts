/**
 * [S8-5] Release 1.0 — revisão final (CA 1) e deploy validado (CA 2).
 *
 * Regra PURA da prontidão da release: consolida os gates por issue
 * entregue (todas as CAs anteriores), a bateria de qualidade do projeto,
 * o healthcheck da aplicação e o estado do deploy de produção. Qualquer
 * gate vermelho bloqueia o deploy — a release só parte 100% verde.
 */

/** Versão publicada por esta release (espelha package.json). */
export const RELEASE_VERSION = "1.0.0";

/**
 * Gates por entrega: cada issue de SPRINTS.md com CAs verdes via PR
 * mergeado. S8-5 é a própria release — não se auto-declara.
 */
export const RELEASE_GATES: ReadonlyArray<{
  id: string;
  title: string;
}> = [
  { id: "S0-1", title: "Ambiente e qualidade (bun, vitest, eslint)" },
  { id: "S0-2", title: "Design System UNICAP (tokens, Card, Button)" },
  { id: "S0-4", title: "Auditoria de contraste dos tokens (WCAG AA)" },
  { id: "S1-1", title: "Autenticação e shell do portal" },
  { id: "S1-2", title: "Consentimento LGPD versionado (R7)" },
  { id: "S1-3", title: "Perfil do aluno (CA matrícula única)" },
  { id: "S1-4", title: "Privacidade e visibilidade (R2/R6)" },
  { id: "S2-1", title: "Currículo Vitae do aluno" },
  { id: "S2-3", title: "Banco de Talentos com filtros (R1/R2)" },
  { id: "S2-4", title: "Plano indexado de busca (sem full-scan)" },
  { id: "S3-1", title: "Publicação de vagas por recrutador" },
  { id: "S3-3", title: "Matching no servidor (R8)" },
  { id: "S3-4", title: "Candidatura em um clique + pré-requisitos (R3)" },
  { id: "S4-1", title: "Kanban do pipeline (5 colunas)" },
  { id: "S4-2", title: "Reprovação padronizada (R5)" },
  { id: "S4-4", title: "Minhas candidaturas em tempo real" },
  { id: "S5-1", title: "Painel Operacional (métricas)" },
  { id: "S5-2", title: "Time-to-Hire" },
  { id: "S6-1", title: "Exportação CSV/XLSX + PDF institucional" },
  { id: "S7-1", title: "Cadastro de projetos de extensão" },
  { id: "S7-2", title: "Acompanhamento ativo/não ativo" },
  { id: "S7-3", title: "Divulgação pública (R9, whitelist)" },
  { id: "S8-1", title: "Auditoria LGPD end-to-end (art. 18)" },
  { id: "S8-2", title: "Acessibilidade WCAG AA (contraste, foco, landmarks)" },
  { id: "S8-3", title: "Benchmark de busca com 10k+ currículos" },
  { id: "S8-4", title: "Error boundaries e monitoração (SLA 99%)" },
];

/** Gates de qualidade: a bateria obrigatória do projeto. */
export const RELEASE_QUALITY_GATES = {
  tests: "bun run test",
  typecheck: "bun run typecheck",
  lint: "bun run lint",
  coverage: "bun run test:coverage",
} as const;

export type ReleaseGateStatus = {
  issueId: string;
  passed: boolean;
  evidence: string;
};

export type ReleaseQualityInput = {
  testsPassed: number;
  testsFailed: number;
  typecheck: boolean;
  lint: boolean;
  coverage: boolean;
};

export type ReleaseHealthInput = {
  status: "ok" | "degraded";
  db: boolean;
  checkedAt: number;
};

export type ReleaseDeploymentInput = {
  url: string;
  deployed: boolean;
  /** Estado do endpoint /healthz observado pela monitoração. */
  healthz: "up" | "down" | "unknown";
};

export type ReleaseReadinessInput = {
  gates: readonly ReleaseGateStatus[];
  quality: ReleaseQualityInput;
  health: ReleaseHealthInput;
  deployment: ReleaseDeploymentInput;
};

export type ReleaseReadinessReport = {
  version: string;
  ready: boolean;
  checks: {
    gates: boolean;
    quality: boolean;
    health: boolean;
    deployment: boolean;
  };
  failed: string[];
};

/**
 * Avalia a prontidão da Release 1.0. Falhas possíveis:
 * - gate_<issue>: CA de uma entrega anterior vermelho ou sem evidência;
 * - qualidade: bateria (testes/typecheck/lint/coverage) não 100% verde;
 * - healthcheck: endpoint observado degradado/fora;
 * - deploy: produção ausente ou /healthz não confirmado como "up".
 */
export function evaluateReleaseReadiness(
  input: ReleaseReadinessInput,
): ReleaseReadinessReport {
  const failed: string[] = [];

  // CA 1 — todos os CAs anteriores verdes, com evidência declarada.
  const byId = new Map(input.gates.map((gate) => [gate.issueId, gate]));
  for (const gate of RELEASE_GATES) {
    const status = byId.get(gate.id);
    if (status === undefined || !status.passed) {
      failed.push(`gate_${gate.id}`);
    }
  }
  const gatesOk = failed.length === 0;

  // Bateria de qualidade: zero testes falhando + checks estáticos.
  const qualityOk =
    input.quality.testsFailed === 0 &&
    input.quality.testsPassed > 0 &&
    input.quality.typecheck &&
    input.quality.lint &&
    input.quality.coverage;
  if (!qualityOk) failed.push("qualidade");

  // Healthcheck real da aplicação (S8-4) precisa estar ok.
  const healthOk =
    input.health.status === "ok" &&
    input.health.db &&
    input.health.checkedAt > 0;
  if (!healthOk) failed.push("healthcheck");

  // CA 2 — deploy validado: produção no ar e /healthz confirmado.
  const deploymentOk =
    input.deployment.deployed &&
    input.deployment.url.length > 0 &&
    input.deployment.healthz === "up";
  if (!deploymentOk) failed.push("deploy");

  return {
    version: RELEASE_VERSION,
    ready: gatesOk && qualityOk && healthOk && deploymentOk,
    checks: {
      gates: gatesOk,
      quality: qualityOk,
      health: healthOk,
      deployment: deploymentOk,
    },
    failed,
  };
}
