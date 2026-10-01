/**
 * [UX_REFINEMENT] Etapa 2/5 — edição inline no currículo: cada um dos
 * 7 blocos nasce em modo de VISUALIZAÇÃO com um ícone de lápis; ao
 * clicar, os campos do bloco abrem no próprio local; "Salvar" persiste
 * e volta à visualização, "Cancelar" descarta. A validação existente
 * continua bloqueando envios inválidos (TDD — Etapa 5).
 */
import { render, screen } from "@testing-library/react";
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
      saveResumeData: "mut:students.saveResumeData",
      setVisibility: "mut:students.setVisibility",
      saveSkillsAndLanguages: "mut:students.saveSkillsAndLanguages",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ResumeForm } from "../../src/components/student/ResumeForm";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

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
  availability: "estagio",
  visibility: "somente_candidaturas",
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
    mutation === "mut:students.saveResumeData"
      ? saveResumeData
      : saveSkillsAndLanguages) as never);
});

const PENCILS = [
  "Editar Dados Pessoais",
  "Editar Formação",
  "Editar Links",
  "Editar Competências",
  "Editar Idiomas",
  "Editar Experiências",
  "Editar Certificações",
];

describe("[UX_REFINEMENT] ResumeForm — edição inline por bloco (Etapa 2)", () => {
  it("modo visualização: lápis em cada um dos 7 blocos e sem campos abertos", () => {
    render(<ResumeForm />);
    for (const label of PENCILS) {
      expect(
        screen.getByRole("button", { name: label }),
        label,
      ).toBeInTheDocument();
    }
    // Nenhum campo editável fora do modo de edição.
    expect(screen.queryByLabelText(/headline/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /adicionar certificação/i }),
    ).toBeNull();
  });

  it("clicar no lápis abre os campos do bloco no próprio local", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resumo profissional/i)).toBeInTheDocument();
    // Outros blocos continuam em visualização.
    expect(
      screen.queryByRole("button", { name: /adicionar certificação/i }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: /^salvar$/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /^cancelar$/i }),
    ).toBeInTheDocument();
  });

  it("Salvar persiste via saveResumeData e volta à visualização", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(saveResumeData).toHaveBeenCalledTimes(1);
    const payload = saveResumeData.mock.calls[0]?.[0] as {
      headline: string;
    };
    expect(payload.headline).toContain("Estudante de Ciência da Computação");
    expect(toast.success).toHaveBeenCalledWith("Currículo salvo com sucesso.");
    // Voltou à visualização.
    expect(screen.queryByLabelText(/headline/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    ).toBeInTheDocument();
  });

  it("Cancelar volta à visualização sem disparar mutation", async () => {
    render(<ResumeForm />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    await userEvent.clear(screen.getByLabelText(/headline/i));
    await userEvent.type(screen.getByLabelText(/headline/i), "Rascunho feio");
    await userEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));

    expect(saveResumeData).not.toHaveBeenCalled();
    expect(saveSkillsAndLanguages).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/headline/i)).toBeNull();
    // Rascunho descartado: ao reabrir, mostra o valor salvo de novo.
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    expect(screen.getByLabelText(/headline/i)).toHaveValue(
      "Estudante de Ciência da Computação focado em back-end",
    );
  });

  it("validação continua bloqueando: envio inválido mostra alerta e não salva", async () => {
    const { container } = render(<ResumeForm />);
    container.querySelector("form")?.setAttribute("novalidate", "");
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    );
    await userEvent.clear(screen.getByLabelText(/headline/i));
    await userEvent.clear(screen.getByLabelText(/resumo profissional/i));
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(saveResumeData).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/corrija os pontos abaixo/i);
    // Continua no modo de edição para corrigir.
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument();
  });
});
