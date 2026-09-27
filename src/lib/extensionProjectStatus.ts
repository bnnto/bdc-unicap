/**
 * [S7-2] Acompanhamento ativo/não ativo — regra pura do toggle de status.
 *
 * CA — toggle de status registrado com timestamp: a decisão central
 * (deve gravar? qual estado? qual momento?) vive aqui, sem I/O, e é
 * reexecutada NO SERVIDOR pela mutation `extensionProjects.setStatus`
 * (padrão do S7-1/extensionProject.ts — fonte única de verdade).
 *
 * Contexto: a divulgação pública da [S7-3] lista apenas projetos ativos;
 * o `statusChangedAt` é a data da última mudança de estado, exibida no
 * painel do gestor ([S7-4]).
 */

/** Estado atual de acompanhamento persistido no projeto. */
export type ExtensionProjectStatusState = {
  active: boolean;
  statusChangedAt: number;
};

export type StatusChangeDecision =
  | { ok: true; active: boolean; statusChangedAt: number }
  | { ok: false; errors: string[] };

/**
 * Decide a gravação do toggle de status:
 * - sem mudança de estado → idempotente ({ ok: false }, nada é gravado —
 *   o timestamp anterior é preservado);
 * - com mudança de estado → grava o novo estado com o timestamp informado;
 * - data anterior à última mudança → rejeitada (sem retroagir o histórico);
 * - data no mesmo milissegundo da última mudança → aceita.
 */
export function evaluateStatusChange(
  current: ExtensionProjectStatusState,
  nextActive: boolean,
  changedAt: number,
): StatusChangeDecision {
  if (!Number.isFinite(changedAt) || changedAt < current.statusChangedAt) {
    return {
      ok: false,
      errors: [
        "A data da mudança de status deve ser maior ou igual à última mudança registrada.",
      ],
    };
  }

  // Sem mudança de estado: idempotente — errors vazio sinaliza "nada a gravar"
  // (a mutation preserva o timestamp anterior sem lançar erro).
  if (current.active === nextActive) {
    return { ok: false, errors: [] };
  }

  return { ok: true, active: nextActive, statusChangedAt: changedAt };
}
