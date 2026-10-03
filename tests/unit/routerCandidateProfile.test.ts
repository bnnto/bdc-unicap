/**
 * [RECRUITER_VIEW_PROFILE] Rota da página dedicada do candidato:
 * `/recrutador/candidato/:studentId`. As funções puras do router são a
 * única fonte de verdade do caminho — Kanban, Banco de Talentos e o
 * AuthGate usam as mesmas funções (sem string mágica espalhada).
 */
import { describe, expect, it } from "vitest";
import {
  candidateProfilePath,
  parseCandidateProfilePath,
} from "../../src/lib/router";

describe("router — rota do perfil do candidato", () => {
  it("monta o caminho /recrutador/candidato/:studentId", () => {
    expect(candidateProfilePath("k57abc123")).toBe(
      "/recrutador/candidato/k57abc123",
    );
  });

  it("parseia o studentId de uma rota válida", () => {
    expect(parseCandidateProfilePath("/recrutador/candidato/k57abc123")).toBe(
      "k57abc123",
    );
  });

  it("faz round-trip com ids de verdade (letras, dígitos, hífen)", () => {
    expect(parseCandidateProfilePath(candidateProfilePath("abc-123_XYZ"))).toBe(
      "abc-123_XYZ",
    );
  });

  it("retorna null para rotas que não são do candidato", () => {
    expect(parseCandidateProfilePath("/")).toBeNull();
    expect(parseCandidateProfilePath("/recrutador")).toBeNull();
    expect(parseCandidateProfilePath("/recrutador/candidato")).toBeNull();
    expect(parseCandidateProfilePath("/recrutador/candidato/")).toBeNull();
    expect(parseCandidateProfilePath("/perfil")).toBeNull();
    expect(parseCandidateProfilePath("/recrutador/candidato/a/b")).toBeNull();
  });

  it("retorna null para studentId malicioso/inválido", () => {
    expect(
      parseCandidateProfilePath("/recrutador/candidato/%2e%2e%2fsecret"),
    ).toBeNull();
    expect(parseCandidateProfilePath("/recrutador/candidato/a b")).toBeNull();
  });
});
