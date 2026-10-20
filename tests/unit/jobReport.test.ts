import { describe, expect, it } from "vitest";
import {
  REPORT_SUSPEND_THRESHOLD,
  reportBreakdown,
  shouldSuspendForReports,
} from "../../src/lib/jobReport";

describe("jobReport", () => {
  it("suspende só a partir do limite", () => {
    expect(shouldSuspendForReports(REPORT_SUSPEND_THRESHOLD - 1)).toBe(false);
    expect(shouldSuspendForReports(REPORT_SUSPEND_THRESHOLD)).toBe(true);
  });

  it("agrupa por motivo, do mais citado ao menos citado", () => {
    expect(
      reportBreakdown(["empresa_falsa", "outro", "empresa_falsa"]),
    ).toEqual([
      { reason: "empresa_falsa", count: 2 },
      { reason: "outro", count: 1 },
    ]);
  });
});