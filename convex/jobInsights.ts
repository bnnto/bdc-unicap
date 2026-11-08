import { query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { checkRequiredPrerequisites } from "../src/lib/application";
import { canonicalSkill } from "../src/lib/skills";

/** Quantos alunos do banco de talentos têm TODAS as competências obrigatórias. */
export const countEligibleStudents = query({
  args: { requiredSkills: v.array(v.string()) },
  handler: async (ctx, { requiredSkills }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const user = await ctx.db.get(userId);
    if (user?.role !== "recrutador" && user?.role !== "gestor") return null;

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