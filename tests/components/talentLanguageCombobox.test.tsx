/**
 * [UX COMBOBOX] H6-1/TAREFA 2 — o campo "Idioma" do Banco de Talentos é
 * o Combobox pesquisável da whitelist: busca digitando (nada de scroll
 * infinito nem datalist) e só aceita termos oficiais do catálogo.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
import { KNOWN_LANGUAGES } from "../../src/lib/skills";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);

function visibleOptions(): string[] {
  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("TalentSearchPage — combobox de idiomas (H6-1)", () => {
  it("campo Idioma é combobox pesquisável alimentado pelo catálogo (40+)", async () => {
    mockedUseQuery.mockReturnValue({ items: [], page: 0, total: 0 });

    render(<TalentSearchPage />);

    const combo = screen.getByRole("combobox", { name: "Idioma" });
    expect(combo.tagName).toBe("INPUT");
    expect(combo).toHaveAttribute("aria-autocomplete", "list");
    expect(KNOWN_LANGUAGES.length).toBeGreaterThanOrEqual(40);

    await userEvent.click(combo);
    const options = visibleOptions();
    expect(options).toContain("Inglês");
    expect(options).toContain("Libras");
    expect(options).toContain("Russo");
  });

  it("encontra 'Russo' digitando — sem scroll infinito", async () => {
    mockedUseQuery.mockReturnValue({ items: [], page: 0, total: 0 });

    render(<TalentSearchPage />);

    const combo = screen.getByRole("combobox", { name: "Idioma" });
    await userEvent.click(combo);
    await userEvent.type(combo, "russo");

    const options = visibleOptions();
    expect(options).toEqual(["Russo"]);
    // O texto digitado permanece, mas o FILTRO usa a forma oficial.
    expect(combo).toHaveValue("russo");
    expect(mockedUseQuery).toHaveBeenCalledWith(
      "query:students.searchTalent",
      expect.objectContaining({ language: "Russo" }),
    );
  });

  it("idioma inexistente mostra 'Nenhum resultado' (filtro sem texto livre)", async () => {
    mockedUseQuery.mockReturnValue({ items: [], page: 0, total: 0 });

    render(<TalentSearchPage />);

    const combo = screen.getByRole("combobox", { name: "Idioma" });
    await userEvent.click(combo);
    await userEvent.type(combo, "klingon");

    expect(screen.getByText(/nenhum resultado/i)).toBeInTheDocument();
  });

  it("o datalist foi substituído (sem list= nativo)", () => {
    mockedUseQuery.mockReturnValue({ items: [], page: 0, total: 0 });

    render(<TalentSearchPage />);

    const combo = screen.getByRole("combobox", { name: "Idioma" });
    expect(combo).not.toHaveAttribute("list");
    expect(document.getElementById("talent-language-options")).toBeNull();
  });
});
