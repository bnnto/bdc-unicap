import { describe, expect, it } from "vitest";
import { validateRecruiterWebsite } from "../../src/lib/recruiterSignup";

describe("validateRecruiterWebsite", () => {
  it("campo opcional: vazio, só espaços, undefined e null são válidos e não gravam nada", () => {
    for (const empty of ["", "   ", undefined, null]) {
      expect(validateRecruiterWebsite(empty)).toEqual({
        ok: true,
        normalized: undefined,
      });
    }
  });

  it("aceita com ou sem protocolo e normaliza para https, sem query, hash ou barra final", () => {
    expect(validateRecruiterWebsite("suaempresa.com.br")).toEqual({
      ok: true,
      normalized: "https://suaempresa.com.br",
    });
    expect(
      validateRecruiterWebsite("HTTP://Www.Acme.com/sobre/?x=1#a"),
    ).toEqual({ ok: true, normalized: "https://www.acme.com/sobre" });
    expect(validateRecruiterWebsite("https://acme.com.br/")).toEqual({
      ok: true,
      normalized: "https://acme.com.br",
    });
  });

  it("é idempotente: normalizar duas vezes dá o mesmo resultado (front e servidor)", () => {
    const first = validateRecruiterWebsite("Acme.com.br/sobre/");
    expect(first.ok).toBe(true);
    if (!first.ok || first.normalized === undefined) return;
    expect(validateRecruiterWebsite(first.normalized)).toEqual(first);
  });

  it("recusa texto solto, IP, localhost, credenciais, esquemas perigosos e tipos errados", () => {
    for (const bad of [
      "não é site",
      "acme",
      "localhost",
      "http://192.168.0.1",
      "https://user:senha@acme.com",
      "javascript:alert(1)",
      "ftp://acme.com",
      "https://acme.c",
      123,
      "a".repeat(201) + ".com",
    ]) {
      expect(validateRecruiterWebsite(bad).ok).toBe(false);
    }
  });
});
