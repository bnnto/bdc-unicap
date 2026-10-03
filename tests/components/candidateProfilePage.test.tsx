/**
 * [RECRUITER_VIEW_PROFILE] Página dedicada do candidato
 * (CandidateProfilePage) — spec Etapa 2 e 4:
 *  - reutiliza o design de currículo do Portal do Aluno em modo ESTRITO
 *    de somente leitura (nenhum lápis/botão de edição);
 *  - renderiza os blocos (Formação, Experiências, Links) com os dados
 *    mockados do aluno;
 *  - botão "← Voltar ao Kanban" no topo devolve o recrutador ao Kanban;
 *  - registrada na rota /recrutador/candidato/:studentId (App).
 *
 * `convex/react` e `convex/_generated/api` são mockados (mesmo padrão
 * dos testes do Kanban).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut: vi.fn() }),
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
import { toast } from "sonner";
import { CandidateProfilePage } from "../../src/components/recruiter/CandidateProfilePage";
import App from "../../src/App";
import { AuthStateContext } from "../../src/components/auth/authContext";

const mockedUseQuery = vi.mocked(useQuery);

const RESUME = {
  headline: "Estudante de Sistemas focado em back-end",
  summary: "Perfil profissional completo do candidato.",
  experiences: [
    {
      company: "UNICAP",
      role: "Monitor",
      period: "2023–2024",
      description: "Monitoria de Banco de Dados I.",
    },
  ],
  academicHistory: [
    { item: "Bacharelado em Sistemas para Internet", year: 2026 },
  ],
  links: {
    github: "https://github.com/maria",
    lattes: "http://lattes.cnpq.br/1",
  },
  projectsText: "Feira de Ciências — oficina de Python",
  certifications: ["Cisco CCNA"],
};

const profileFixture = {
  studentId: "k57abc123",
  fullName: "Maria da Silva",
  enrollment: "1234567",
  course: "Ciência da Computação",
  status: "ativo",
  availability: "estagio",
  graduationYear: 2026,
  semester: 6,
  location: "Recife, PE",
  headline: RESUME.headline,
  resume: RESUME,
  skills: ["React", "Node"],
  languages: [{ name: "Inglês", level: "intermediario" }],
  contactReleased: false,
  email: undefined,
  linkedinUrl: undefined,
  portfolioUrl: undefined,
};

function mockProfileQuery(profile: unknown) {
  mockedUseQuery.mockImplementation(((query: unknown) => {
    if (query === "query:students.getCandidateProfile") return profile;
    return undefined;
  }) as never);
}

afterEach(() => {
  vi.clearAllMocks();
  window.history.pushState({}, "", "/");
});

describe("CandidateProfilePage — currículo somente leitura (Etapa 2/4)", () => {
  it("renderiza os blocos do currículo com os dados do aluno", () => {
    mockProfileQuery(profileFixture);
    render(<CandidateProfilePage studentId="k57abc123" />);

    // Cabeçalho do candidato.
    expect(
      screen.getByRole("heading", { level: 1, name: /maria da silva/i }),
    ).toBeInTheDocument();

    // Blocos (Formação, Experiências, Links) com conteúdo real.
    expect(
      screen.getByRole("heading", {
        name: /2\. Formação Acadêmica Institucional UNICAP/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /3\. Links Profissionais, Portfólio & Lattes/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /6\. Experiências Profissionais e Projetos de Extensão/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Bacharelado em Sistemas para Internet"),
    ).toBeInTheDocument();
    expect(screen.getByText(/UNICAP — Monitor/)).toBeInTheDocument();
    expect(screen.getByText("React")).toBeInTheDocument();
    expect(
      screen.getByText("Feira de Ciências — oficina de Python"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cisco CCNA")).toBeInTheDocument();
  });

  it("é estritamente somente leitura: nenhum lápis/botão de edição", () => {
    mockProfileQuery(profileFixture);
    render(<CandidateProfilePage studentId="k57abc123" />);

    expect(
      screen.queryByRole("button", { name: /Editar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Fechar edição/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Salvar/i }),
    ).not.toBeInTheDocument();
    // Indicação clara de leitura para o recrutador (badge + subtítulos).
    expect(screen.getAllByText(/somente leitura/i).length).toBeGreaterThan(0);
  });

  it("omite contato sem autorização (R6) e o botão Voltar volta ao Kanban", () => {
    mockProfileQuery(profileFixture);
    window.history.pushState({}, "", "/recrutador/candidato/k57abc123");
    render(<CandidateProfilePage studentId="k57abc123" />);

    // R6 — LinkedIn/Portfólio não aparecem com contato bloqueado.
    expect(screen.queryByText(/linkedin\.com/)).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Contato não liberado pelo aluno/i).length,
    ).toBeGreaterThan(0);

    const voltar = screen.getByRole("button", {
      name: /voltar ao kanban/i,
    });
    fireEvent.click(voltar);
    expect(window.location.pathname).toBe("/");
  });

  it("mostra o contato liberado quando autorizado pelo aluno", () => {
    mockProfileQuery({
      ...profileFixture,
      contactReleased: true,
      email: "aluno@unicap.br",
      linkedinUrl: "https://www.linkedin.com/in/maria",
      portfolioUrl: "https://maria.dev",
    });
    render(<CandidateProfilePage studentId="k57abc123" />);

    expect(
      screen.getByRole("link", { name: /aluno@unicap\.br/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /linkedin/i })).toBeInTheDocument();
    expect(
      screen.queryByText(/Contato não liberado pelo aluno/i),
    ).not.toBeInTheDocument();
  });

  it("estado de carregamento e de acesso negado", () => {
    mockProfileQuery(undefined);
    const { rerender } = render(<CandidateProfilePage studentId="k57abc123" />);
    expect(screen.getByText(/carregando perfil/i)).toBeInTheDocument();

    mockProfileQuery(null);
    rerender(<CandidateProfilePage studentId="k57abc123" />);
    expect(
      screen.getByText(/não foi possível exibir este perfil/i),
    ).toBeInTheDocument();
    // O Voltar continua disponível mesmo com acesso negado.
    expect(
      screen.getByRole("button", { name: /voltar ao kanban/i }),
    ).toBeInTheDocument();
  });
});

describe("Rota /recrutador/candidato/:studentId (App)", () => {
  it("recrutador autenticado na rota vê a CandidateProfilePage", () => {
    mockProfileQuery(profileFixture);
    window.history.pushState({}, "", "/recrutador/candidato/k57abc123");
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: true,
          user: {
            _id: "u1" as never,
            name: "Recrutador Exemplo",
            email: "recrutador@unicap.br",
            role: "recrutador",
            _creationTime: 0,
          },
          role: "recrutador",
        }}
      >
        <App />
      </AuthStateContext.Provider>,
    );
    expect(
      screen.getByRole("heading", { level: 1, name: /maria da silva/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /voltar ao kanban/i }),
    ).toBeInTheDocument();
  });

  it("aluno autenticado NÃO acessa a rota do candidato", () => {
    mockProfileQuery(profileFixture);
    window.history.pushState({}, "", "/recrutador/candidato/k57abc123");
    render(
      <AuthStateContext.Provider
        value={{
          isLoading: false,
          isAuthenticated: true,
          user: {
            _id: "u2" as never,
            name: "Aluno Exemplo",
            email: "aluno@unicap.br",
            role: "aluno",
            _creationTime: 0,
          },
          role: "aluno",
        }}
      >
        <App />
      </AuthStateContext.Provider>,
    );
    expect(
      screen.queryByRole("heading", { level: 1, name: /maria da silva/i }),
    ).not.toBeInTheDocument();
    // Shell do aluno (abas do portal).
    expect(
      screen.getByRole("tab", { name: /meu currículo/i }),
    ).toBeInTheDocument();
  });
});

describe("Quick actions — Baixar PDF + Copiar (QUICK_WIN_RECRUITER)", () => {
  function setClipboard(value: unknown): void {
    Object.defineProperty(navigator, "clipboard", {
      value,
      configurable: true,
    });
  }

  // window.print não é implementado no jsdom — spy próprio (evita
  // referenciar o método solto em window: regra unbound-method).
  const printSpy = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, "print", {
      value: printSpy,
      configurable: true,
    });
    setClipboard(undefined);
  });

  afterEach(() => {
    document.getElementById("unicap-resume-print-root")?.remove();
    document.getElementById("unicap-resume-print-style")?.remove();
    setClipboard(undefined);
  });

  it("'Baixar Currículo em PDF' reusa a lógica de impressão do aluno (@media print)", () => {
    mockProfileQuery(profileFixture);
    render(<CandidateProfilePage studentId="k57abc123" />);

    const baixar = screen.getByRole("button", {
      name: /baixar currículo em pdf/i,
    });
    fireEvent.click(baixar);

    // Mesma lógica do Portal do Aluno: template + window.print().
    expect(printSpy).toHaveBeenCalled();
    const root = document.getElementById("unicap-resume-print-root");
    expect(root).not.toBeNull();
    expect(root?.textContent).toContain("Maria da Silva");
    expect(root?.textContent).toContain("Matrícula 1234567");
    expect(document.getElementById("unicap-resume-print-style")).not.toBeNull();
  });

  it("ícones de Copiar ao lado do E-mail e Telefone copiam com 1 clique e avisam via Toast", async () => {
    mockProfileQuery({
      ...profileFixture,
      contactReleased: true,
      email: "aluno@unicap.br",
      phone: "81988887777",
      linkedinUrl: "https://www.linkedin.com/in/maria",
      portfolioUrl: "https://maria.dev",
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard({ writeText });
    render(<CandidateProfilePage studentId="k57abc123" />);

    // Dados Pessoais: e-mail e telefone aparecem para o recrutador.
    expect(
      screen.getByRole("link", { name: /aluno@unicap\.br/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("81988887777")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: /copiar e-mail/i }),
    );
    expect(writeText).toHaveBeenCalledWith("aluno@unicap.br");
    expect(toast.success).toHaveBeenCalledWith("E-mail copiado!");

    await userEvent.click(
      screen.getByRole("button", { name: /copiar telefone/i }),
    );
    expect(writeText).toHaveBeenCalledWith("81988887777");
    expect(toast.success).toHaveBeenCalledWith("Telefone copiado!");
  });
});
