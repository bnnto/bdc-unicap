/**
 * [UX-P3] H6-1 — A busca de talentos também sugere idiomas (datalist)
 * no campo de texto livre "Idioma".
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    students: {
      searchTalent: "query:students.searchTalent",
    },
  },
}));

import { useQuery } from "convex/react";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);

describe("TalentSearchPage — datalist de idiomas (H6-1)", () => {
  it("campo Idioma tem list vinculado com sugestões do catálogo", () => {
    mockedUseQuery.mockReturnValue({ items: [], page: 0, total: 0 });

    render(<TalentSearchPage />);

    const languageInput = screen.getByLabelText("Idioma");
    expect(languageInput).toHaveAttribute("list", "talent-language-options");

    const datalist = document.getElementById("talent-language-options");
    expect(datalist).not.toBeNull();
    const values = Array.from(datalist?.querySelectorAll("option") ?? []).map(
      (option) => option.getAttribute("value"),
    );
    expect(values).toContain("Inglês");
    expect(values).toContain("Libras");
  });
});
