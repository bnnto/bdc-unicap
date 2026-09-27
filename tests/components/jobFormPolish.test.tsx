/**
 * [UX-P3] H3-4 — Publicação bem-sucedida retorna à lista automaticamente
 * (sem duplo salvamento confuso) e H6-1 — campo de idioma do formulário
 * de vaga oferece sugestões via datalist (reconhecimento, não memorização).
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("../../convex/_generated/api", () => ({
  api: {
    jobs: {
      upsertJob: "mut:jobs.upsertJob",
    },
  },
}));

import { useMutation } from "convex/react";
import { JobForm } from "../../src/components/recruiter/JobForm";

const mockedUseMutation = vi.mocked(useMutation);
const upsert = vi.fn().mockResolvedValue({ jobId: "job-1", created: true });
const onDone = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseMutation.mockReturnValue(upsert as never);
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
    screen.getByLabelText(/Pré-requisito 1/i),
    "Conclusão de 60% do curso",
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
      expect(upsert).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(onDone).toHaveBeenCalledOnce();
    });
    // Sem duplicar salvamento: só um submit efetivo.
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("H6-1 — campo de idioma vincula datalist de sugestões", () => {
    render(<JobForm initial={null} onDone={onDone} />);

    const languageInput = screen.getByLabelText("Idioma exigido");
    expect(languageInput).toHaveAttribute("list", "job-language-options");

    const datalist = document.getElementById("job-language-options");
    expect(datalist).not.toBeNull();
    const options = datalist?.querySelectorAll("option") ?? [];
    const values = Array.from(options).map((option) =>
      option.getAttribute("value"),
    );
    expect(values).toContain("Inglês");
    expect(values).toContain("Libras");
    expect(values.length).toBeGreaterThanOrEqual(5);
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

    expect(upsert).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
