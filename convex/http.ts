import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";

/**
 * Rotas HTTP do portal — rotas do Convex Auth (issue [S1-1]) + healthcheck
 * da monitoração ([S8-4] CA 2, SLA 99%).
 */
const http = httpRouter();

auth.addHttpRoutes(http);

/**
 * [S8-4] `GET /healthz` — batida do monitor de disponibilidade.
 * 200 com `{status:"ok", db:true}` quando a sonda do banco responde;
 * 503 quando o banco não responde (o monitor registra DOWN).
 */
http.route({
  path: "/healthz",
  method: "GET",
  handler: httpAction(async (ctx) => {
    try {
      const probe = await ctx.runQuery(internal.health.dbProbe, {});
      return new Response(
        JSON.stringify({
          status: "ok",
          db: probe.ok,
          checkedAt: probe.checkedAt,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch {
      return new Response(
        JSON.stringify({ status: "down", db: false, checkedAt: Date.now() }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }),
});

export default http;
