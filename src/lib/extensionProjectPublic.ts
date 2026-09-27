/**
 * [S7-3] Divulgação pública de projetos ativos — regras puras (R9).
 *
 * CA 2 — nenhum dado restrito exposto: a projeção abaixo é a ÚNICA
 * ponte entre o documento interno (`extensionProjects`) e o mundo
 * externo. Whitelist por construção — campos novos do schema NUNCA
 * vazam para a página pública por padrão.
 *
 * Consumidores: query pública `extensionProjects.listPublicProjects`
 * (servidor, sem guard de autenticação — R9) e a página pública
 * `ExtensionProjectsPublicPage` (UI responsiva).
 */
import type { ExtensionArea } from "./extensionProject";

/**
 * Visibilidade pública (R9): apenas projetos ATIVOS são divulgados —
 * o toggle de status da [S7-2] é a única fonte dessa decisão.
 */
export function isProjectPubliclyVisible(project: {
  active: boolean;
}): boolean {
  return project.active;
}

/** Contrato público da divulgação (exatamente estes campos, nada mais). */
export type PublicProjectView = {
  title: string;
  description: string;
  area: ExtensionArea;
  targetAudience: string;
  /** Publicação do cadastro (ordenação da divulgação). */
  createdAt: number;
  /** Data da última mudança de status ([S7-2]) — contexto de atualidade. */
  statusChangedAt: number;
};

/**
 * Projeta o documento interno para a view pública (CA 2).
 * Deliberadamente NÃO copia o documento: cada campo público é escolhido
 * aqui — `coordinatorId`, `_id`, `_creationTime` e `active` ficam fora.
 */
export function toPublicProjectView(project: {
  title: string;
  description: string;
  area: ExtensionArea;
  targetAudience: string;
  createdAt: number;
  statusChangedAt: number;
}): PublicProjectView {
  return {
    title: project.title,
    description: project.description,
    area: project.area,
    targetAudience: project.targetAudience,
    createdAt: project.createdAt,
    statusChangedAt: project.statusChangedAt,
  };
}
