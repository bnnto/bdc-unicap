/**
 * [DICIONARIO_FECHADO] Formulários de perfil e currículo não aceitam
 * texto livre para competências/idiomas: os campos são <select> com as
 * opções oficiais (SKILLS_DICTIONARY / KNOWN_LANGUAGES) — o utilizador
 * só consegue SELECIONAR um termo da whitelist.
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    students: {
      myProfile: "query:students.myProfile",
      upsertProfile: "mut:students.upsertProfile",
      saveResumeData: "mut:students.saveResumeData",
      saveSkillsAndLanguages: "mut:students.saveSkillsAndLanguages",
      saveContactLinks: "mut:students.saveContactLinks",
      setVisibility: "mut:students.setVisibility",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { KNOWN_LANGUAGES, SKILLS_DICTIONARY } from "../../src/lib/skills";
import { ResumeForm } from "../../src/components/student/ResumeForm";
import { StudentProfileForm } from "../../src/components/student/StudentProfileForm";
import { TalentSearchPage } from "../../src/components/talent/TalentSearchPage";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const upsertProfile = vi.fn().mockResolvedValue({ created: false });
const saveSkillsAndLanguages = vi.fn().mockResolvedValue({ ok: true });
const saveResumeData = vi.fn().mockResolvedValue({ ok: true });
const saveContactLinks = vi.fn().mockResolvedValue({ ok: true });
const setVisibility = vi.fn().mockResolvedValue({ ok: true });

const PROFILE = {
  _id: "s1",
  userId: "u1",
  fullName: "Maria da Silva",
  enrollment: "20211048",
  status: "ativo",
  course: "Sistemas para Internet",
  graduationYear: 2027,
  semester: 6,
  location: "Recife, PE",
  availability: "estagio",
  visibility: "publico",
  linkedinUrl: undefined,
  portfolioUrl: undefined,
  skills: ["React", "Python"],
  languages: [{ name: "Inglês", level: "intermediario" }],
  resumeData: {
    headline: "Estudante de Dev front-end",
    summary: "Aluna do 6º período com foco em interfaces web acessíveis.",
    experiences: [],
    academicHistory: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:students.myProfile" ? PROFILE : undefined) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) => {
    if (mutation === "mut:students.upsertProfile") return upsertProfile;
    if (mutation === "mut:students.saveResumeData") return saveResumeData;
    if (mutation === "mut:students.saveContactLinks") return saveContactLinks;
    if (mutation === "mut:students.setVisibility") return setVisibility;
    return saveSkillsAndLanguages;
  }) as never);
});

/** Opções de um <select> (ignora o placeholder de valor vazio). */
function optionsOf(select: HTMLElement): string[] {
  return Array.from(select.querySelectorAll("option"))
    .map((option) => option.getAttribute("value") ?? "")
    .filter((value) => value.length > 0);
}

describe("StudentProfileForm — dicionário fechado", () => {
  it("campo de competência é select do dicionário (sem texto livre)", () => {
    render(<StudentProfileForm />);

    const select = screen.getByRole("combobox", { name: "Nova competência" });
    expect(select.tagName).toBe("SELECT");
    // Nenhuma caixa de texto permite digitar competência livre.
    expect(
      screen.queryByRole("textbox", { name: /nova competência/i }),
    ).toBeNull();

    const offered = optionsOf(select);
    expect(offered.length).toBeGreaterThan(0);
    for (const skill of offered) {
      expect(SKILLS_DICTIONARY).toContain(skill);
    }
    expect(offered).toContain("Unity");
    expect(offered).toContain("Figma");
  });

  it("campo de idioma é select da whitelist (sem texto livre)", () => {
    render(<StudentProfileForm />);

    const select = screen.getByRole("combobox", { name: "Novo idioma" });
    expect(select.tagName).toBe("SELECT");
    expect(screen.queryByRole("textbox", { name: /novo idioma/i })).toBeNull();

    const offered = optionsOf(select);
    for (const language of offered) {
      expect(KNOWN_LANGUAGES).toContain(language);
    }
    expect(offered).toContain("Coreano");
    expect(offered).toContain("Russo");
  });

  it("só termos oficiais entram no envio (seleção + validação)", async () => {
    render(<StudentProfileForm />);

    const skillsGroup = screen.getByRole("group", { name: /^competências/i });
    await userEvent.selectOptions(
      within(skillsGroup).getByRole("combobox", {
        name: "Nova competência",
      }),
      "Unity",
    );
    await userEvent.click(
      within(skillsGroup).getByRole("button", { name: /adicionar/i }),
    );
    expect(
      within(skillsGroup).getByLabelText(/remover competência unity/i),
    ).toBeInTheDocument();

    const languagesGroup = screen.getByRole("group", { name: /^idiomas/i });
    await userEvent.selectOptions(
      within(languagesGroup).getByRole("combobox", { name: "Novo idioma" }),
      "Coreano",
    );
    await userEvent.click(
      within(languagesGroup).getByRole("button", { name: /adicionar/i }),
    );

    await userEvent.click(
      screen.getByRole("button", { name: /salvar perfil/i }),
    );

    expect(upsertProfile).toHaveBeenCalledTimes(1);
    const payload = upsertProfile.mock.calls[0]?.[0] as {
      skills: string[];
      languages: { name: string }[];
    };
    expect(payload.skills).toEqual(["React", "Python", "Unity"]);
    for (const skill of payload.skills) {
      expect(SKILLS_DICTIONARY).toContain(skill);
    }
    expect(payload.languages.map((l) => l.name)).toEqual(["Inglês", "Coreano"]);
    for (const language of payload.languages) {
      expect(KNOWN_LANGUAGES).toContain(language.name);
    }
  });
});

describe("ResumeForm — dicionário fechado nos blocos 4 e 5", () => {
  it("bloco de competências abre como select do dicionário", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Competências" }),
    );

    const select = screen.getByLabelText("Nova competência");
    expect(select.tagName).toBe("SELECT");
    expect(
      screen.queryByRole("textbox", { name: /nova competência/i }),
    ).toBeNull();

    const offered = optionsOf(select);
    for (const skill of offered) {
      expect(SKILLS_DICTIONARY).toContain(skill);
    }
    // Já cadastradas saem da lista de escolha (sem duplicar).
    expect(offered).not.toContain("React");
    expect(offered).toContain("Docker");
  });

  it("campo Idioma do bloco de idiomas é select da whitelist", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Idiomas" }),
    );

    const first = screen.getAllByRole("combobox", { name: /^Idioma/ })[0]!;
    expect(first.tagName).toBe("SELECT");
    expect(screen.queryByRole("textbox", { name: /^idioma/i })).toBeNull();

    const offered = optionsOf(first);
    expect(offered.length).toBeGreaterThan(0);
    for (const language of offered) {
      expect(KNOWN_LANGUAGES).toContain(language);
    }
    // A própria linha em edição mantém o valor já escolhido.
    expect(offered).toContain("Inglês");
    expect(offered).toContain("Japonês");

    // Idioma já usado numa linha não é oferecido na seguinte.
    await userEvent.click(
      screen.getByRole("button", { name: /adicionar idioma/i }),
    );
    const rows = screen.getAllByRole("combobox", { name: /^Idioma/ });
    expect(rows).toHaveLength(2);
    const nextRowOptions = optionsOf(rows[1]!);
    expect(nextRowOptions).not.toContain("Inglês");
    expect(nextRowOptions).toContain("Japonês");
  });
});

describe("Banco de Talentos — filtro de competências fechado", () => {
  it("filtro é select do dicionário (sem caixa de texto livre)", () => {
    render(<TalentSearchPage />);

    const select = screen.getByRole("combobox", { name: "Nova competência" });
    expect(select.tagName).toBe("SELECT");
    expect(
      screen.queryByRole("textbox", { name: /nova competência/i }),
    ).toBeNull();

    const offered = optionsOf(select);
    expect(offered.length).toBeGreaterThan(0);
    for (const skill of offered) {
      expect(SKILLS_DICTIONARY).toContain(skill);
    }
    expect(offered).toContain("Unity");
    expect(offered).toContain("Figma");
  });

  it("adiciona chip só com termo oficial e o remove das opções", async () => {
    render(<TalentSearchPage />);

    const skillsGroup = screen.getByRole("group", { name: "Competências" });
    await userEvent.selectOptions(
      within(skillsGroup).getByRole("combobox", { name: "Nova competência" }),
      "Unity",
    );
    await userEvent.click(
      within(skillsGroup).getByRole("button", { name: /adicionar/i }),
    );

    expect(
      within(skillsGroup).getByRole("button", {
        name: /remover competência unity/i,
      }),
    ).toBeInTheDocument();
    // Já escolhida sai das opções; o resto do dicionário continua.
    const after = optionsOf(
      within(skillsGroup).getByRole("combobox", { name: "Nova competência" }),
    );
    expect(after).not.toContain("Unity");
    expect(after).toContain("Blender");
  });
});
