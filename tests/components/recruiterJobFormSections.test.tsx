/**
 * [RECRUITER_UX_UPGRADE] Formulário "Publicar Vaga" elegante:
 *
 * - Campos agrupados em seções visuais (fieldsets com legend + ícone
 *   lucide): "Sobre a vaga", "Contrato & Remuneração" e "Matching".
 * - Selects com respiro à direita para a seta não encavalitar no texto.
 *
 * Os rótulos e botões testados em jobFormPolish.test permanecem iguais.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      upsertJob: "mut:jobs.upsertJob",
      createJob: "mut:jobs.createJob",
    },
  },
}));

import { useMutation } from "convex/react";
import { JobForm } from "../../src/components/recruiter/JobForm";

const mockedUseMutation = vi.mocked(useMutation);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseMutation.mockImplementation(
    () => vi.fn().mockResolvedValue({}) as never,
  );
});

describe("JobForm — seções visuais com ícones", () => {
  it("campos agrupados em seções nomeadas com ícone lucide", () => {
    render(<JobForm initial={null} onDone={vi.fn()} />);

    const sections = ["Sobre a vaga", "Contrato & Remuneração", "Matching"];
    for (const name of sections) {
      const section = screen.getByRole("group", {
        name: new RegExp(name, "i"),
      });
      expect(section).toBeInTheDocument();
      expect(
        section.querySelector("svg.lucide"),
        `seção "${name}" sem ícone lucide`,
      ).not.toBeNull();
    }
  });

  it("todos os selects do formulário têm respiro para a seta (pr-9)", () => {
    render(<JobForm initial={null} onDone={vi.fn()} />);

    const selects = document.querySelectorAll("select");
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(select).toHaveClass("pr-9");
    }
  });
});
