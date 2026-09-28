/**
 * Papéis do sistema (issue [S1-1], CEREBRO.md §4.1).
 * Fonte única compartilhada entre Convex e React (arquivo puro, sem I/O).
 *
 * [REFACTOR_UI] O papel "empresa" foi descontinuado e **removido** de todo
 * o sistema (código, cadastro e banco — registros legados já excluídos):
 * recrutadores de empresas usam o papel "recrutador".
 */
export const ROLES = ["aluno", "recrutador", "gestor"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  aluno: "Aluno",
  recrutador: "Recrutador",
  gestor: "Gestor",
};

export function isRole(value: unknown): value is Role {
  return (
    typeof value === "string" && (ROLES as readonly string[]).includes(value)
  );
}
