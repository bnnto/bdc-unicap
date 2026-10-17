/**
 * [UX COMBOBOX] Testes do Combobox pesquisável de dicionário
 * (TAREFA 1/2): busca digitando em `<input role="combobox">` com lista
 * suspensa filtrada; o termo só é confirmado ao clicar/Enter numa opção
 * — texto inexistente mostra "Nenhum resultado" e emite "" (o que
 * mantém o botão de adicionar do formulário desabilitado).
 */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboboxGroup } from "../../src/components/ui/Combobox";

const GROUPS: ComboboxGroup[] = [
  { label: "Tech / Dev", items: ["React", "Next.js", "TypeScript"] },
  { label: "Direito", items: ["Direito Civil", "LGPD"] },
];

const LANGUAGE_OPTIONS: ComboboxGroup[] = [
  { label: "Idiomas", items: ["Inglês", "Russo", "Sueco"] },
];

function optionNames(): string[] {
  return within(screen.getByRole("listbox"))
    .getAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("Combobox — ARIA e abertura", () => {
  it("é um input role=combobox com aria-expanded/controls/autocomplete", async () => {
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={vi.fn()}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    expect(combo.tagName).toBe("INPUT");
    expect(combo).toHaveAttribute("aria-expanded", "false");
    expect(combo).toHaveAttribute("aria-autocomplete", "list");

    // Foco (clique) abre a lista — jsdom não dispara focus nativo para
    // o onFocus do React, por isso simula-se com userEvent.
    expect(screen.queryByRole("listbox")).toBeNull();
    await userEvent.click(combo);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(combo).toHaveAttribute("aria-expanded", "true");
  });

  it("mostra as opções agrupadas com cabeçalhos de área", async () => {
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={vi.fn()}
      />,
    );

    await userEvent.click(
      screen.getByRole("combobox", { name: "Nova competência" }),
    );
    expect(optionNames()).toEqual([
      "React",
      "Next.js",
      "TypeScript",
      "Direito Civil",
      "LGPD",
    ]);
    expect(screen.getByText("Tech / Dev")).toBeInTheDocument();
    expect(screen.getByText("Direito")).toBeInTheDocument();
  });
});

describe("Combobox — filtragem e regra de bloqueio", () => {
  it("filtra as opções enquanto digita (case/acentos livres)", async () => {
    const onSelect = vi.fn();
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={onSelect}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    await userEvent.click(combo);
    await userEvent.type(combo, "NEXT JS"); // "Next.js" sem pontos/caixa

    expect(optionNames()).toEqual(["Next.js"]);
    // Confirmou o termo oficial canônico.
    expect(onSelect).toHaveBeenLastCalledWith("Next.js");
  });

  it("texto inexistente mostra 'Nenhum resultado' e emite \"\"", async () => {
    const onSelect = vi.fn();
    // Rascunho anterior confirmado — apagar/escrever deve emitir "".
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value="React"
        onSelect={onSelect}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    await userEvent.click(combo);
    await userEvent.type(combo, "coxinha");

    expect(screen.getByText("Nenhum resultado")).toBeInTheDocument();
    // Nunca emite o texto livre — só "" (botão de adicionar ficaria off).
    expect(onSelect).not.toHaveBeenCalledWith("coxinha");
    expect(onSelect).toHaveBeenLastCalledWith("");
  });

  it("só confirma opções clicáveis da lista filtrada (sem texto fantasma)", async () => {
    const onSelect = vi.fn();
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={onSelect}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    await userEvent.click(combo);
    await userEvent.type(combo, "direito");
    await userEvent.click(
      within(screen.getByRole("listbox")).getByRole("option", {
        name: "Direito Civil",
      }),
    );

    expect(onSelect).toHaveBeenLastCalledWith("Direito Civil");
    expect(combo).toHaveValue("Direito Civil");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("Combobox — teclado", () => {
  it("ArrowDown navega e Enter escolhe a opção destacada", async () => {
    const onSelect = vi.fn();
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={onSelect}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    await userEvent.click(combo);
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(onSelect).toHaveBeenLastCalledWith("Next.js");
    expect(combo).toHaveValue("Next.js");
  });

  it("Escape fecha a lista sem alterar o valor", async () => {
    const onSelect = vi.fn();
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={onSelect}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    await userEvent.click(combo);
    await userEvent.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Combobox — desabilitado e idiomas", () => {
  it("desabilitado não abre a lista nem deixa digitar", async () => {
    render(
      <Combobox
        ariaLabel="Nova competência"
        groups={GROUPS}
        value=""
        onSelect={vi.fn()}
        disabled
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Nova competência" });
    expect(combo).toBeDisabled();
    await userEvent.click(combo);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("catalogo de idiomas segue a mesma busca (encontra 'Russo' digitando)", async () => {
    render(
      <Combobox
        ariaLabel="Idioma"
        groups={LANGUAGE_OPTIONS}
        value=""
        onSelect={vi.fn()}
      />,
    );

    const combo = screen.getByRole("combobox", { name: "Idioma" });
    await userEvent.click(combo);
    await userEvent.type(combo, "rus");

    expect(optionNames()).toEqual(["Russo"]);
  });
});
