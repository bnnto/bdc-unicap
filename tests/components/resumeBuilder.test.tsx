/**
 * [REFACTOR_ALUNO Etapa 2] — Página "Meu Currículo": layout de duas
 * colunas com sidebar sticky (foto/nome/curso, toggle de visibilidade e
 * navegação rápida) e main com os 7 blocos do formulário + exportação
 * PDF. Base: referência visual stitch (edi_o_de_curr_culo_vitae_unicap).
 */
import { render, screen, within } from "@testing-library/react";
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
      saveResumeData: "mut:students.saveResumeData",
      setVisibility: "mut:students.setVisibility",
      saveSkillsAndLanguages: "mut:students.saveSkillsAndLanguages",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { ResumeBuilderPage } from "../../src/components/student/ResumeBuilderPage";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const setVisibility = vi.fn().mockResolvedValue({ ok: true });
const saveResumeData = vi.fn().mockResolvedValue({ ok: true });
const saveSkillsAndLanguages = vi.fn().mockResolvedValue({ ok: true });

const PROFILE = {
  _id: "s1",
  userId: "u1",
  fullName: "Gabriel Medeiros da Cunha",
  enrollment: "202110482",
  status: "ativo",
  course: "Ciência da Computação",
  graduationYear: 2026,
  semester: 6,
  location: "Recife, PE",
  linkedinUrl: "https://linkedin.com/in/gabriel",
  portfolioUrl: null,
  availability: "estagio",
  visibility: "somente_candidaturas",
  showContactToRecruiters: false,
  skills: ["Python", "SQL"],
  languages: [{ name: "Inglês", level: "intermediario" }],
  resumeData: {
    headline: "Estudante de Ciência da Computação focado em back-end",
    summary:
      "Aluno do 6º período com base em engenharia de software e bancos de dados, buscando estágio em back-end.",
    experiences: [],
    academicHistory: [],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:students.myProfile" ? PROFILE : undefined) as never);
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:students.setVisibility"
      ? setVisibility
      : mutation === "mut:students.saveResumeData"
        ? saveResumeData
        : saveSkillsAndLanguages) as never);
});

const BLOCK_HEADINGS = [
  "1. Dados Pessoais & Apresentação Profissional",
  "2. Formação Acadêmica Institucional UNICAP",
  "3. Links Profissionais, Portfólio & Lattes",
  "4. Competências & Tecnologias (Skills)",
  "5. Idiomas & Nível de Proficiência",
  "6. Experiências Profissionais e Projetos de Extensão",
  "7. Certificações & Atividades Complementares",
];

describe("ResumeBuilderPage — sidebar sticky (Etapa 2.1)", () => {
  it("renderiza aside sticky em coluna (lg:sticky, lg:col-span-4)", () => {
    const { container } = render(<ResumeBuilderPage />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    expect(aside!.className).toContain("lg:sticky");
    expect(aside!.className).toContain("lg:col-span-4");
    expect(aside!.className).toContain("lg:top-24");
  });

  it("sidebar mostra foto/iniciais, nome e curso do aluno", () => {
    const { container } = render(<ResumeBuilderPage />);
    const aside = container.querySelector("aside");
    expect(aside).not.toBeNull();
    const sidebar = within(aside as HTMLElement);
    expect(sidebar.getByText("Gabriel Medeiros da Cunha")).toBeInTheDocument();
    expect(sidebar.getByText(/Ciência da Computação/)).toBeInTheDocument();
    // Avatar com iniciais (sem foto externa).
    expect(sidebar.getByText("GC")).toBeInTheDocument();
  });

  it("toggle de visibilidade no Banco de Talentos dispara setVisibility", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<ResumeBuilderPage />);
    const toggle = screen.getByRole("switch", {
      name: /visibilidade no banco de talentos/i,
    });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    await userEvent.click(toggle);
    expect(setVisibility).toHaveBeenCalledWith({ visibility: "publico" });
  });

  it("menu âncora de navegação rápida com as 7 seções do formulário", () => {
    render(<ResumeBuilderPage />);
    const nav = screen.getByRole("navigation", {
      name: /navegação rápida do currículo/i,
    });
    const links = within(nav).getAllByRole("link");
    expect(links).toHaveLength(7);
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "#bloco-pessoais",
      "#bloco-academico",
      "#bloco-links",
      "#bloco-competencias",
      "#bloco-idiomas",
      "#bloco-experiencias",
      "#bloco-certificacoes",
    ]);
    links.forEach((link, index) => {
      expect(link.textContent?.trim().startsWith(String(index + 1))).toBe(true);
    });
  });
});

describe("ResumeBuilderPage — main com os 7 blocos (Etapa 2.2)", () => {
  it("título da página (h1) e bloco de exportação presentes", () => {
    const { container } = render(<ResumeBuilderPage />);
    expect(
      screen.getByRole("heading", { level: 1, name: /currículo vitae/i }),
    ).toBeInTheDocument();
    expect(container.querySelector("#bloco-exportar")).not.toBeNull();
    expect(
      screen.getByRole("heading", { name: /visualizador e exportação pdf/i }),
    ).toBeInTheDocument();
  });

  it("cada bloco existe com id âncora e título na ordem do requisito", () => {
    const { container } = render(<ResumeBuilderPage />);
    const ids = [
      "bloco-pessoais",
      "bloco-academico",
      "bloco-links",
      "bloco-competencias",
      "bloco-idiomas",
      "bloco-experiencias",
      "bloco-certificacoes",
    ];
    for (const id of ids) {
      expect(container.querySelector(`#${id}`), id).not.toBeNull();
    }
    for (const heading of BLOCK_HEADINGS) {
      expect(
        screen.getByRole("heading", { name: heading }),
        heading,
      ).toBeInTheDocument();
    }
  });

  it("hierarquia de títulos sem saltos (h1 → h2)", () => {
    render(<ResumeBuilderPage />);
    const levels = screen
      .getAllByRole("heading")
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i], `salto na posição ${i}`).toBeLessThanOrEqual(
        (levels[i - 1] ?? 9) + 1,
      );
    }
  });

  it("bloco 1 nasce em visualização; o lápis abre headline e resumo", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<ResumeBuilderPage />);
    expect(screen.queryByLabelText(/headline/i)).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resumo profissional/i)).toBeInTheDocument();
    // Contador do resumo (o bloco 6 tem outro contador — seletor específico).
    expect(screen.getByText(/caracteres \(mínimo 30\)/i)).toBeInTheDocument();
  });

  it("bloco 6 mantém experiências e ganha campo livre de projetos de extensão", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<ResumeBuilderPage />);
    expect(screen.queryByLabelText(/projetos de extensão/i)).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Editar Experiências" }),
    );
    expect(
      screen.getByRole("group", { name: /experiências profissionais/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/projetos de extensão/i)).toBeInTheDocument();
  });

  it("bloco 7 lista certificações com campo para adicionar (via lápis)", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<ResumeBuilderPage />);
    expect(
      screen.queryByRole("button", { name: /adicionar certificação/i }),
    ).toBeNull();

    await userEvent.click(
      screen.getByRole("button", { name: "Editar Certificações" }),
    );
    expect(
      screen.getByRole("group", { name: /certificações/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /adicionar certificação/i }),
    ).toBeInTheDocument();
  });

  it("salvar o bloco 1 persiste via saveResumeData", async () => {
    const { userEvent } = await import("@testing-library/user-event");
    render(<ResumeBuilderPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
    expect(saveResumeData).toHaveBeenCalledTimes(1);
    const payload = saveResumeData.mock.calls[0]?.[0] as {
      headline: string;
      summary: string;
    };
    expect(payload.headline).toContain("Estudante de Ciência da Computação");
  });
});
