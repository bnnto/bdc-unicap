/**
 * [DICIONARIO_FECHADO] Formulários de perfil e currículo não aceitam
 * texto livre para competências/idiomas: os campos são o Combobox
 * pesquisável com as opções oficiais (SKILLS_DICTIONARY /
 * KNOWN_LANGUAGES) — o utilizador só consegue SELECIONAR um termo da
 * whitelist na lista filtrada. Texto inexistente mostra "Nenhum
 * resultado" e o botão de adicionar fica desabilitado.
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
  availability: ["estagio"],
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

/** Abre o combobox e devolve as opções visíveis da lista suspensa. */
async function openComboOptions(combo: HTMLElement): Promise<string[]> {
  await userEvent.click(combo);
  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

/** Escolhe um termo: digita (filtra) e clica na opção da lista. */
async function pickComboTerm(combo: HTMLElement, term: string) {
  await userEvent.click(combo);
  await userEvent.clear(combo);
  await userEvent.type(combo, term);
  await userEvent.click(
    within(screen.getByRole("listbox")).getByRole("option", { name: term }),
  );
}

describe("StudentProfileForm — dicionário fechado", () => {
  it("campo de competência é combobox do dicionário (sem texto livre)", async () => {
    render(<StudentProfileForm />);

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    expect(combo.tagName).toBe("INPUT");
    // Nenhuma caixa de texto permite digitar competência livre.
    expect(
      screen.queryByRole("textbox", { name: /nova competência/i }),
    ).toBeNull();

    const offered = await openComboOptions(combo);
    expect(offered.length).toBeGreaterThan(0);
    for (const skill of offered) {
      expect(SKILLS_DICTIONARY).toContain(skill);
    }
    expect(offered).toContain("Unity");
    expect(offered).toContain("Figma");
  });

  it("campo de idioma é combobox da whitelist (sem texto livre)", async () => {
    render(<StudentProfileForm />);

    const combo = screen.getByRole("combobox", { name: "Novo idioma" });
    expect(combo.tagName).toBe("INPUT");
    expect(screen.queryByRole("textbox", { name: /novo idioma/i })).toBeNull();

    const offered = await openComboOptions(combo);
    for (const language of offered) {
      expect(KNOWN_LANGUAGES).toContain(language);
    }
    expect(offered).toContain("Coreano");
    expect(offered).toContain("Russo");
  });

  it("texto fora do dicionário mostra 'Nenhum resultado' e desabilita Adicionar", async () => {
    render(<StudentProfileForm />);

    const skillsGroup = screen.getByRole("group", { name: /^competências/i });
    const combo = within(skillsGroup).getByRole("combobox", {
      name: "Nova competência",
    });
    await userEvent.click(combo);
    await userEvent.clear(combo);
    await userEvent.type(combo, "coxinha");

    expect(screen.getByText(/nenhum resultado/i)).toBeInTheDocument();
    expect(
      within(skillsGroup).getByRole("button", { name: /adicionar/i }),
    ).toBeDisabled();

    // Nada foi adicionado — nenhum chip "coxinha" na lista de chips.
    expect(
      within(skillsGroup).queryByLabelText(/remover competência coxinha/i),
    ).toBeNull();
  });

  it("só termos oficiais entram no envio (seleção + validação)", async () => {
    render(<StudentProfileForm />);

    const skillsGroup = screen.getByRole("group", { name: /^competências/i });
    await pickComboTerm(
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
    await pickComboTerm(
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
  it("bloco de competências abre como combobox do dicionário", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Competências" }),
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    expect(combo.tagName).toBe("INPUT");
    expect(
      screen.queryByRole("textbox", { name: /nova competência/i }),
    ).toBeNull();

    const offered = await openComboOptions(combo);
    for (const skill of offered) {
      expect(SKILLS_DICTIONARY).toContain(skill);
    }
    // Já cadastradas saem da lista de escolha (sem duplicar).
    expect(offered).not.toContain("React");
    expect(offered).toContain("Docker");
  });

  it("campo Idioma do bloco de idiomas é combobox da whitelist", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Idiomas" }),
    );

    const first = screen.getAllByRole("combobox", { name: /^Idioma/ })[0]!;
    expect(first.tagName).toBe("INPUT");
    expect(screen.queryByRole("textbox", { name: /^idioma/i })).toBeNull();

    // Abre já com o valor da própria linha (busca = "Inglês").
    expect(await openComboOptions(first)).toContain("Inglês");

    // A linha seguinte oferece a whitelist SEM os idiomas já usados.
    await userEvent.click(
      screen.getByRole("button", { name: /adicionar idioma/i }),
    );
    const rows = screen.getAllByRole("combobox", { name: /^Idioma/ });
    expect(rows).toHaveLength(2);
    const nextRowOptions = await openComboOptions(rows[1]!);
    expect(nextRowOptions).not.toContain("Inglês");
    expect(nextRowOptions).toContain("Japonês");
  });
});

describe("Banco de Talentos — filtro de competências fechado", () => {
  it("filtro é combobox do dicionário (sem caixa de texto livre)", async () => {
    render(<TalentSearchPage />);

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    expect(combo.tagName).toBe("INPUT");
    expect(
      screen.queryByRole("textbox", { name: /nova competência/i }),
    ).toBeNull();

    const offered = await openComboOptions(combo);
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
    const combo = within(skillsGroup).getByRole("combobox", {
      name: "Nova competência",
    });
    await pickComboTerm(combo, "Unity");
    await userEvent.click(
      within(skillsGroup).getByRole("button", { name: /adicionar/i }),
    );

    expect(
      within(skillsGroup).getByRole("button", {
        name: /remover competência unity/i,
      }),
    ).toBeInTheDocument();
    // Já escolhida sai das opções; o resto do dicionário continua.
    const after = await openComboOptions(
      within(skillsGroup).getByRole("combobox", { name: "Nova competência" }),
    );
    expect(after).not.toContain("Unity");
    expect(after).toContain("Blender");
  });
});
