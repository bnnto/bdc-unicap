/**
 * [RECRUITER_VIEW_PROFILE] Banco de Talentos: o botão "Visualizar Perfil
 * & CV" de cada card navega para a rota dedicada
 * `/recrutador/candidato/:studentId` (spec: entrada no Kanban E no Banco
 * de Talentos).
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: new Proxy(
    {},
    {
      get: (_target, moduleName) =>
        new Proxy(
          {},
          {
            get: (_inner, fnName) =>
              `query:${String(moduleName)}.${String(fnName)}`,
          },
        ),
    },
  ),
}));

import { useQuery } from "convex/react";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);

const talentResult = {
  items: [
    {
      studentId: "k57abc123",
      fullName: "Maria da Silva",
      course: "Ciência da Computação",
      status: "ativo",
      graduationYear: 2026,
      semester: 6,
      location: "Recife, PE",
      availability: "estagio",
      summary: "Ciência da Computação · Egresso? não — ativo",
      skills: ["React"],
      languages: [],
      headline: null,
      contactAllowed: false,
      linkedinUrl: null,
      portfolioUrl: null,
    },
  ],
  total: 1,
  page: 0,
  pageCount: 1,
  hasNext: false,
  hasPrev: false,
};

beforeEach(() => {
  window.history.pushState({}, "", "/");
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:students.searchTalent") return talentResult;
    return undefined;
  }) as never);
});

afterEach(() => {
  window.history.pushState({}, "", "/");
  vi.clearAllMocks();
});

describe("Banco de Talentos — Visualizar Perfil & CV navega para a rota dedicada", () => {
  it("abre /recrutador/candidato/:studentId a partir do card do talento", async () => {
    render(<TalentSearchPage />);

    const abrir = await screen.findByRole("button", {
      name: /visualizar perfil & cv/i,
    });
    await userEvent.click(abrir);

    expect(window.location.pathname).toBe("/recrutador/candidato/k57abc123");
  });
});
