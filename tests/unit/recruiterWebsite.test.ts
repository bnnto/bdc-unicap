import { assert, describe, expect, it } from "vitest";
import { validateRecruiterWebsite } from "../../src/lib/recruiterSignup";

const WEBSITE_MAX_LENGTH = 200;

describe("validateRecruiterWebsite", () => {
  it.each(["", "   ", undefined, null])(
    "campo opcional: %j é válido e não grava nada",
    (empty) => {
      expect(validateRecruiterWebsite(empty)).toEqual({
        ok: true,
        normalized: undefined,
      });
    },
  );

  it.each([
    [
      "sem protocolo",
      "suaempresa.com.br",
      "https://suaempresa.com.br",
    ],
    [
      "http, caixa mista, query e hash",
      "HTTP://Www.Acme.com/sobre/?x=1#a",
      "https://www.acme.com/sobre",
    ],
    ["barra final", "https://acme.com.br/", "https://acme.com.br"],
  ])(
    "aceita e normaliza para https, sem query, hash ou barra final: %s",
    (_caso, entrada, normalizado) => {
      expect(validateRecruiterWebsite(entrada)).toEqual({
        ok: true,
        normalized: normalizado,
      });
    },
  );

  it("é idempotente: normalizar duas vezes dá o mesmo resultado (front e servidor)", () => {
    const first = validateRecruiterWebsite("Acme.com.br/sobre/");
    assert(first.ok, "a primeira validação deveria ser ok");
    assert(first.normalized !== undefined, "deveria haver valor normalizado");

    expect(validateRecruiterWebsite(first.normalized)).toEqual(first);
  });

  it.each([
    "não é site",
    "acme",
    "localhost",
    "http://192.168.0.1",
    "https://user:senha@acme.com",
    "javascript:alert(1)",
    "ftp://acme.com",
    "https://acme.c",
    123,
    `${"a".repeat(WEBSITE_MAX_LENGTH + 1)}.com`,
  ])("recusa texto solto, IP, localhost, credenciais, esquemas perigosos e tipos errados: %j", (bad) => {
    expect(validateRecruiterWebsite(bad).ok).toBe(false);
  });
});