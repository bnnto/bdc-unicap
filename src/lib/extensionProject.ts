/**
 * [S7-1] Cadastro de projetos de extensão — regras puras de validação.
 *
 * CA 1 — CRUD completo persistido em `extensionProjects`: a mesma regra
 * valida no formulário e na mutation Convex (padrão do S3-1, job.ts) —
 * fonte única de verdade, sem duplicar regras entre camadas.
 * CA 2 — validações básicas de campos: título, descrição, coordenador,
 * área temática e público-alvo, com normalização (trim) e limites.
 *
 * Arquivo puro (sem I/O, sem React) — consumido pela mutation
 * `extensionProjects.upsertProject` e pela UI do Setor de Extensão.
 */

/** Áreas temáticas da extensão universitária (RESGES/CENADES). */
export const EXTENSION_AREAS = [
  "comunicacao",
  "cultura",
  "direitos_humanos_justica",
  "educacao",
  "meio_ambiente",
  "saude",
  "tecnologia_e_producao",
  "trabalho",
] as const;

export type ExtensionArea = (typeof EXTENSION_AREAS)[number];

/** Rótulos amigáveis para exibição no painel e no formulário. */
export const EXTENSION_AREA_LABELS: Record<ExtensionArea, string> = {
  comunicacao: "Comunicação",
  cultura: "Cultura",
  direitos_humanos_justica: "Direitos Humanos e Justiça",
  educacao: "Educação",
  meio_ambiente: "Meio Ambiente",
  saude: "Saúde",
  tecnologia_e_producao: "Tecnologia e Produção",
  trabalho: "Trabalho",
};

const TITLE_MIN = 5;
const TITLE_MAX = 120;
const DESCRIPTION_MIN = 20;
const DESCRIPTION_MAX = 4000;
const TARGET_AUDIENCE_MAX = 400;

/** Entrada de cadastro de projeto (antes da normalização). */
export type ExtensionProjectInput = {
  title: string;
  description: string;
  /** Usuário coordenador do projeto (id de `users`). */
  coordinatorId: string;
  area: ExtensionArea;
  targetAudience: string;
};

export type ExtensionProjectValidation =
  | { ok: true; normalized: ExtensionProjectInput }
  | { ok: false; errors: string[] };

/** Valida o projeto completo e devolve versão normalizada (trim) ou erros. */
export function validateExtensionProject(
  input: ExtensionProjectInput,
): ExtensionProjectValidation {
  const errors: string[] = [];

  const title = input.title.trim();
  if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
    errors.push(
      `O título deve ter entre ${TITLE_MIN} e ${TITLE_MAX} caracteres.`,
    );
  }

  const description = input.description.trim();
  if (
    description.length < DESCRIPTION_MIN ||
    description.length > DESCRIPTION_MAX
  ) {
    errors.push(
      `A descrição deve ter entre ${DESCRIPTION_MIN} e ${DESCRIPTION_MAX} caracteres.`,
    );
  }

  if (input.coordinatorId.trim() === "") {
    errors.push("Selecione o coordenador do projeto.");
  }

  if (!(EXTENSION_AREAS as readonly string[]).includes(input.area)) {
    errors.push("Selecione uma área temática válida.");
  }

  const targetAudience = input.targetAudience.trim();
  if (targetAudience === "" || targetAudience.length > TARGET_AUDIENCE_MAX) {
    errors.push(
      `O público-alvo é obrigatório e deve ter até ${TARGET_AUDIENCE_MAX} caracteres.`,
    );
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    normalized: {
      title,
      description,
      coordinatorId: input.coordinatorId.trim(),
      area: input.area,
      targetAudience,
    },
  };
}
