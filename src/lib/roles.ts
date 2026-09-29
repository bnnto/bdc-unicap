/**
 * Papéis do sistema (issue [S1-1], CEREBRO.md §4.1).
 * Fonte única compartilhada entre Convex e React (arquivo puro, sem I/O).
 *
 * [REFACTOR_UI] O papel "empresa" foi removido de todo o sistema (banco
 * limpo): recrutadores de empresas usam o papel "recrutador".
 *
 * [REFACTOR_GESTOR] Etapa 3 — o público NÃO cria conta de gestor: apenas
 * `aluno` e `recrutador` são escolhíveis no cadastro. Contas de gestor
 * são provisionadas exclusivamente pela coordenação via Convex Dashboard
 * (alteração manual do role) — fecha a vulnerabilidade de auto-promoção.
 */
export const ROLES = ["aluno", "recrutador", "gestor"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  aluno: "Aluno",
  recrutador: "Recrutador",
  gestor: "Gestor",
};

/** Papéis oferecidos ao público no cadastro (Etapa 3 — sem gestor). */
export const PUBLIC_SIGNUP_ROLES = ["aluno", "recrutador"] as const;

export type PublicSignupRole = (typeof PUBLIC_SIGNUP_ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}

/** Guard do cadastro público: rejeita gestor (e qualquer papel inválido). */
export function isPublicSignupRole(value: unknown): value is PublicSignupRole {
  return (
    typeof value === "string" &&
    (PUBLIC_SIGNUP_ROLES as readonly string[]).includes(value)
  );
}
