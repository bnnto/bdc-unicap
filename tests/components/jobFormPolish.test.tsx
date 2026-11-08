/**
 * [UX-P3] H3-4 — Publicação bem-sucedida retorna à lista automaticamente
 * (sem duplo salvamento confuso) e H6-1 — campo de idioma do formulário
 * de vaga oferece sugestões via datalist (reconhecimento, não memorização).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => undefined),
  useMutation: vi.fn(() => vi.fn()),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      upsertJob: "mut:jobs.upsertJob",
      createJob: "mut:jobs.createJob",
    },
    jobInsights: {
      countEligibleStudents: "query:jobInsights.countEligibleStudents",
    },
  },
}));

import { useMutation } from "convex/react";
import { JobForm } from "../../src/components/recruiter/vagas/JobForm";

const mockedUseMutation = vi.mocked(useMutation);
const upsert = vi.fn().mockResolvedValue({ jobId: "job-1", created: false });
const create = vi.fn().mockResolvedValue({ jobId: "job-1", created: true });
const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseMutation.mockImplementation(((mutation: unknown) =>
    mutation === "mut:jobs.upsertJob" ? upsert : create) as never);
});

async function fillValidForm() {
  await userEvent.type(
    screen.getByLabelText(/Título da vaga/i),
    "Estágio em Desenvolvimento Web",
  );
  await userEvent.type(
    screen.getByLabelText(/Descrição/i),
    "Apoio no desenvolvimento de aplicações web da universidade com mentoria.",
  );
  await userEvent.type(
    screen.getByLabelText("Competência do pré-requisito 1"),
    "React",
  );
}

describe("JobForm — polimento (UX-P3)", () => {
  it("H3-4 — sucesso volta para a lista automaticamente (sem notice retida)", async () => {
    render(<JobForm initial={null} onDone={onDone} />);

    await fillValidForm();
    await userEvent.click(
      screen.getByRole("button", { name: "Publicar vaga" }),
    );

    await waitFor(() => {
      // [RECRUITER_WORKFLOW] nova vaga publica via createJob.
      expect(create).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledOnce();
    });
    // Sem duplicar salvamento: só um submit efetivo.
    expect(create).toHaveBeenCalledTimes(1);
    expect(upsert).not.toHaveBeenCalled();
  });

  it("H6-1 — campo de idioma é combobox do dicionário de idiomas", async () => {
    render(<JobForm initial={null} onDone={onDone} />);

    const languageInput = screen.getByRole("combobox", {
      name: "Idioma exigido",
    });
    await userEvent.type(languageInput, "Ingl");
    expect(
      screen.getByRole("option", { name: "Inglês" }),
    ).toBeInTheDocument();
  });

  it("validation errors continuam bloqueando o retorno à lista", async () => {
    const { container } = render(<JobForm initial={null} onDone={onDone} />);
    // jsdom não avalia validação nativa; contornamos para exercitar a
    // validação customizada do formulário (mesma do servidor).
    container.querySelector("form")?.setAttribute("novalidate", "");

    // Título curto demais → erro, sem chamar mutation.
    await userEvent.type(screen.getByLabelText(/Título da vaga/i), "abc");
    await userEvent.click(
      screen.getByRole("button", { name: "Publicar vaga" }),
    );

    expect(create).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
