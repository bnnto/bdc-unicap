import { internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * [S8-4] Healthcheck (CA 2 — monitoração do deploy, SLA 99%).
 *
 * A sonda verifica o próprio banco (leitura indexada da tabela `users`):
 * qualquer erro se propaga como falha da batida — é isso que a
 * monitoração registra como DOWN. O healthcheck é anônimo (sem R7):
 * é o endpoint observado pelo monitor de disponibilidade.
 */

/** Sonda interna do banco: "SELECT 1" equivalente (leitura indexada). */
export const dbProbe = internalQuery({
  args: {},
  handler: async (ctx) => {
    const [user] = await ctx.db.query("users").withIndex("by_email").take(1);
    return {
      ok: true,
      probe: user === undefined ? "vazio" : "populado",
      checkedAt: Date.now(),
    };
  },
});

/** Healthcheck público consumido pela rota HTTP `/healthz`. */
export const healthCheck = query({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    status: "ok" | "degraded";
    db: boolean;
    checkedAt: number;
  }> => {
    // Anotação de retorno explícita: quebra a circularidade de inferência
    // (runQuery passa pelo tipo gerado do próprio módulo).
    try {
      const probe = await ctx.runQuery(internal.health.dbProbe, {});
      return { status: "ok", db: probe.ok, checkedAt: probe.checkedAt };
    } catch {
      return { status: "degraded", db: false, checkedAt: Date.now() };
    }
  },
});
