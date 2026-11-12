import { query } from "./_generated/server";
import { v } from "convex/values";
import { checkRequiredPrerequisites } from "../src/lib/application";
import { canonicalSkill } from "../src/lib/skills";
import { requireActiveConsentUser } from "./lib/currentUser";

/**
 * Quantos alunos do banco de talentos têm TODAS as competências obrigatórias.
 *
 * [SEC_RBAC] Guard completo (R7): o contador do Banco de Talentos usa
 * `requireActiveConsentUser` — conta ativa, recrutador aprovado e aceite
 * LGPD vigente. Antes bastava `getAuthUserId` + papel: um recrutador
 * pendente/recusado, uma conta desativada ou um usuário sem aceite do
 * termo consultavam a base de talentos (bypass de R7 e da moderação).
 */
export const countEligibleStudents = query({
  args: { requiredSkills: v.array(v.string()) },
  handler: async (ctx, { requiredSkills }) => {
    const guard = await requireActiveConsentUser(ctx);
    if (!guard.ok) return null;
    if (guard.role !== "recrutador" && guard.role !== "gestor") return null;

    const required = requiredSkills
      .slice(0, 20)
      .map((s) => canonicalSkill(s))
      .filter((s): s is string => s !== null)
      .map((item) => ({ item, required: true }));
    if (required.length === 0) return null;

    let eligible = 0;
    let total = 0;
    for (const status of ["ativo", "egresso"] as const) {
      const students = await ctx.db
        .query("students")
        .withIndex("by_visibility_status", (q) =>
          q.eq("visibility", "publico").eq("status", status),
        )
        .take(2000);
      for (const student of students) {
        total += 1;
        if (
          checkRequiredPrerequisites(
            { prerequisites: required },
            student.skills ?? [],
          ).ok
        ) {
          eligible += 1;
        }
      }
    }
    return { eligible, total };
  },
});