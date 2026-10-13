import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "../../src/components/ui/card";

describe("Card (componente ui/ próprio e leve)", () => {
  it("renderiza o título como heading", () => {
    render(<Card title="Vagas abertas">Conteúdo interno</Card>);
    expect(
      screen.getByRole("heading", { name: "Vagas abertas" }),
    ).toBeInTheDocument();
  });

  it("renderiza o conteúdo children", () => {
    render(<Card title="Título">Conteúdo interno</Card>);
    expect(screen.getByText("Conteúdo interno")).toBeInTheDocument();
  });

  it("aplica acento bordô (primary) via borda esquerda", () => {
    render(
      <Card title="Título" accent="primary">
        x
      </Card>,
    );
    const card = screen.getByTestId("card");
    expect(card.className).toContain("border-l-primary");
  });

  it("usa sombra de nível 1 do DESIGN.md por padrão", () => {
    render(<Card title="Título">x</Card>);
    expect(screen.getByTestId("card").className).toContain("shadow-level1");
  });
});
