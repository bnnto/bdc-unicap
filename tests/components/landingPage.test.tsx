/**
 * [UX_UPGRADE] Etapa 1/4 — Landing Page pública em "/" (a vitrine):
 * hero com título de impacto, CTAs para /login, seção de benefícios e
 * rodapé institucional. Presença dos componentes principais (TDD).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LandingPage } from "../../src/components/landing/LandingPage";

describe("LandingPage — vitrine pública do Portal de Carreiras", () => {
  it("hero com o título de impacto e a linha de conexão com o mercado", () => {
    render(<LandingPage onNavigate={vi.fn()} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /o seu futuro começa aqui/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/conectando os talentos da unicap ao mercado/i),
    ).toBeInTheDocument();
  });

  it("CTAs principais apontam para /login (aluno e empresa)", () => {
    render(<LandingPage onNavigate={vi.fn()} />);

    const alunos = screen.getAllByRole("link", { name: /entrar como aluno/i });
    const empresas = screen.getAllByRole("link", {
      name: /portal da empresa/i,
    });
    expect(alunos.length).toBeGreaterThan(0);
    expect(empresas.length).toBeGreaterThan(0);
    for (const link of [...alunos, ...empresas]) {
      expect(link).toHaveAttribute("href", "/login");
    }
  });

  it("seção de benefícios com os 3 diferenciais do produto", () => {
    render(<LandingPage onNavigate={vi.fn()} />);

    expect(screen.getByText(/gerador de cv em pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/match score inteligente/i)).toBeInTheDocument();
    expect(screen.getByText(/gestão ágil de vagas/i)).toBeInTheDocument();
  });

  it("rodapé institucional da UNICAP", () => {
    render(<LandingPage onNavigate={vi.fn()} />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveTextContent(/universidade católica de pernambuco/i);
  });

  it("landmark main único com id do skip-link (#conteudo)", () => {
    render(<LandingPage onNavigate={vi.fn()} />);

    const mains = screen.getAllByRole("main");
    expect(mains).toHaveLength(1);
    expect(mains[0]).toHaveAttribute("id", "conteudo");
  });

  it("CTA navega para /login via onNavigate (sem reload)", () => {
    const onNavigate = vi.fn();
    render(<LandingPage onNavigate={onNavigate} />);

    const [primeiroCta] = screen.getAllByRole("link", {
      name: /entrar como aluno/i,
    });
    fireEvent.click(primeiroCta!);
    expect(onNavigate).toHaveBeenCalledWith("/login");
  });
});
