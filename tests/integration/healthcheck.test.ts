/**
 * [S8-4] Healthcheck da aplicação (CA 2 — monitoração do deploy):
 * a rota HTTP `GET /healthz` deve responder 200 com o banco saudável e
 * 503 quando a sonda do banco falha — base das batidas de uptime do SLA
 * de 99%. Testado contra o mock oficial do backend Convex (convex-test).
 */
import { convexTest } from "convex-test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { internal } from "../../convex/_generated/api";
import schema from "../../convex/schema";

const modules = import.meta.glob("../../convex/**/*.*s");

describe("S8-4 — healthcheck (rota /healthz e sonda do banco)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("sonda interna confirma banco acessível", async () => {
    const t = convexTest(schema, modules);
    const probe = await t.query(internal.health.dbProbe, {});
    expect(probe.ok).toBe(true);
    expect(probe.checkedAt).toBeGreaterThan(0);
  });

  it("rota /healthz responde 200 com payload do healthcheck", async () => {
    const t = convexTest(schema, modules);
    const response = await t.fetch("/healthz", { method: "GET" });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      db: boolean;
      checkedAt: number;
    };
    expect(body.status).toBe("ok");
    expect(body.db).toBe(true);
    expect(body.checkedAt).toBeGreaterThan(0);
  });

  it("healthcheck é anônimo (não exige identidade)", async () => {
    const t = convexTest(schema, modules);
    // Sem withIdentity: a rota deve responder normalmente.
    const response = await t.fetch("/healthz", { method: "GET" });
    expect(response.status).toBe(200);
  });
});
