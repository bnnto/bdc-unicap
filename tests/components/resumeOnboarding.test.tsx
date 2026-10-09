/**
 * [ONBOARDING_RECOVERY] Etapa 1 — onboarding de contas novas no currículo.
 *
 * Bug corrigido: alunos recém-criados caíam num beco sem saída — a página
 * mandava completar o cadastro no menu "Meu Perfil" (removido) e o
 * ResumeForm bloqueava com "Complete o cadastro do perfil…".
 *
 * Agora o Bloco 1 ("Dados Pessoais & Apresentação") NASCE ABERTO para
 * contas novas e salva via `students.upsertProfile` (upsert). Nenhuma
 * mensagem manda o utilizador para fora do currículo.
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
      upsertProfile: "mut:students.upsertProfile",
      saveResumeData: "mut:students.saveResumeData",
      setVisibility: "mut:students.setVisibility",
      saveSkillsAndLanguages: "mut:students.saveSkillsAndLanguages",
      saveContactLinks: "mut:students.saveContactLinks",
    },
  },
}));

import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { ResumeBuilderPage } from "../../src/components/student/ResumeBuilderPage";

const mockedUseQuery = vi.mocked(useQuery);
const mockedUseMutation = vi.mocked(useMutation);

const upsertProfile = vi.fn().mockResolvedValue({ created: true });
const saveResumeData = vi.fn().mockResolvedValue({ ok: true });
const saveSkillsAndLanguages = vi.fn().mockResolvedValue({ ok: true });
const saveContactLinks = vi.fn().mockResolvedValue({ ok: true });
const setVisibility = vi.fn().mockResolvedValue({ ok: true });

/**
 * Perfil já cadastrado (objeto ESTÁVEL — o useQuery real devolve sempre a
 * mesma referência; um objeto novo por render causaria loop de efeitos).
 */
const EXISTING_PROFILE = {
  _id: "s1",
  userId: "u1",
  fullName: "Gabriel Medeiros da Cunha",
  enrollment: "202110482",
  status: "ativo",
  course: "Ciência da Computação",
  graduationYear: 2026,
  semester: 6,
  availability: "estagio",
  visibility: "somente_candidaturas",
  skills: [],
  languages: [],
};

/** Conta recém-criada: nenhum registro na tabela `students`. */
function mockNewAccount() {
  mockedUseQuery.mockImplementation(((query: unknown) =>
    query === "query:students.myProfile" ? null : undefined) as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseMutation.mockImplementation(((mutation: unknown) => {
    if (mutation === "mut:students.upsertProfile") return upsertProfile;
    if (mutation === "mut:students.saveResumeData") return saveResumeData;
    if (mutation === "mut:students.saveContactLinks") return saveContactLinks;
    if (mutation === "mut:students.setVisibility") return setVisibility;
    return saveSkillsAndLanguages;
  }) as never);
  mockNewAccount();
});

async function fillInitialPersonalData() {
  await userEvent.type(
    screen.getByLabelText(/nome completo/i),
    "Ana Beatriz de Souza",
  );
  await userEvent.type(screen.getByLabelText(/matrícula/i), "20251234");
  await userEvent.type(
    screen.getByLabelText(/^curso/i),
    "Sistemas para Internet",
  );
  await userEvent.type(screen.getByLabelText(/ano de formação/i), "2028");
}

describe("onboarding — conta nova não pode ficar bloqueada", () => {
  it("sem mensagem de 'Meu Perfil' e sem bloqueio do formulário", () => {
    render(<ResumeBuilderPage />);

    expect(screen.queryByText(/meu perfil/i)).toBeNull();
    expect(screen.queryByText(/complete o cadastro do perfil/i)).toBeNull();
    // Os 7 blocos continuam na tela (a página inteira renderiza).
    expect(
      screen.getByRole("heading", { level: 1, name: /currículo vitae/i }),
    ).toBeInTheDocument();
    // Até a exportação do PDF guia para o Bloco 1 (nenhum beco sem saída).
    expect(
      screen.getByText(/preencha o bloco 1 .* e salve para gerar o pdf/i),
    ).toBeInTheDocument();
  });

  it("Bloco 1 nasce ABERTO com os dados pessoais editáveis", () => {
    render(<ResumeBuilderPage />);

    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/matrícula/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^curso/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ano de formação/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/headline/i)).toBeInTheDocument();
  });

  it("salvar o Bloco 1 cria o perfil via upsert (apresentação opcional)", async () => {
    render(<ResumeBuilderPage />);
    await fillInitialPersonalData();
    await userEvent.click(screen.getByRole("button", { name: /^salvar$/i }));

    expect(upsertProfile).toHaveBeenCalledTimes(1);
    expect(upsertProfile.mock.calls[0]?.[0]).toMatchObject({
      fullName: "Ana Beatriz de Souza",
      enrollment: "20251234",
      course: "Sistemas para Internet",
      graduationYear: 2028,
      status: "ativo",
      availability: "estagio",
    });
    // Sem apresentação preenchida, o CV não é exigido (zero bloqueios).
    expect(saveResumeData).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/perfil criado/i),
    );
  });

  it("outros blocos orientam para o Bloco 1 enquanto o perfil não existe", async () => {
    render(<ResumeBuilderPage />);
    await userEvent.click(
      screen.getByRole("button", { name: "Editar Competências" }),
    );

    expect(toast.info).toHaveBeenCalledWith(
      expect.stringMatching(/dados pessoais/i),
    );
    expect(saveResumeData).not.toHaveBeenCalled();
    expect(saveSkillsAndLanguages).not.toHaveBeenCalled();
    // Continua tudo na mesma página, com o Bloco 1 pronto para preencher.
    expect(screen.getByLabelText(/nome completo/i)).toBeInTheDocument();
  });

  it("com perfil existente o Bloco 1 continua nascendo em visualização", () => {
    mockedUseQuery.mockReturnValue(EXISTING_PROFILE);

    render(<ResumeBuilderPage />);
    expect(screen.queryByLabelText(/nome completo/i)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Editar Dados Pessoais" }),
    ).toBeInTheDocument();
  });
});
