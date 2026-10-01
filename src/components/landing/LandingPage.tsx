/**
 * [UX_UPGRADE] Etapa 1/4 — Landing Page pública em "/" (a vitrine do
 * Portal de Carreiras). Visita autenticada não é obrigatória para ver a
 * página: os CTAs levam a "/login" (rota da AuthPage) sem reload, via
 * `onNavigate` do AuthGate.
 *
 * Identidade UNICAP (DESIGN.md): bordô primário, dourado no destaque,
 * tipografia serifada nos títulos. Landmark main único com id
 * "conteudo" (destino do skip-link do App, [S8-2]).
 */
import type { MouseEvent } from "react";

type LandingPageProps = {
  /** Navegação SPA para "/login" (sem reload da página). */
  onNavigate: (path: string) => void;
};

/** Diferenciais do produto exibidos na seção de benefícios. */
const BENEFITS = [
  {
    title: "Gerador de CV em PDF",
    description:
      "Monte seu currículo no portal com skills, idiomas e disponibilidade e exporte um PDF profissional em minutos.",
  },
  {
    title: "Match Score Inteligente",
    description:
      "Cada candidatura mostra a compatibilidade do seu perfil com a vaga, calculada no servidor com dados reais do seu currículo.",
  },
  {
    title: "Gestão Ágil de Vagas",
    description:
      "Empresas publicam vagas e acompanham o funil completo em um Kanban auditável, do inscrito à contratação.",
  },
] as const;

/** Passos do fluxo exibidos na seção "Como funciona". */
const STEPS = [
  {
    title: "Crie seu perfil",
    description:
      "Cadastre-se como aluno, monte seu currículo e deixe seu talento visível para as empresas parceiras.",
  },
  {
    title: "Candidate-se às vagas",
    description:
      "Veja o Match Score de cada oportunidade e candidate-se em um clique, com o consentimento LGPD sempre em suas mãos.",
  },
  {
    title: "Acompanhe cada etapa",
    description:
      "Triagem, entrevista e resultado em tempo real — você sabe exatamente onde está em cada processo seletivo.",
  },
] as const;

export function LandingPage({ onNavigate }: LandingPageProps) {
  /** Navega para "/login" sem recarregar a página (links âncora seguem padrão). */
  function goToLogin(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    onNavigate("/login");
  }

  return (
    <div className="min-h-screen bg-canvas">
      {/* Cabeçalho institucional (banner). */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded bg-primary font-serif text-sm font-bold text-white"
            >
              UC
            </span>
            <div>
              <p className="font-serif text-lg font-bold leading-tight text-primary">
                Portal de Carreiras — UNICAP
              </p>
              <p className="text-xs text-slate-500">
                Universidade Católica de Pernambuco
              </p>
            </div>
          </div>
          <nav aria-label="Navegação da vitrine" className="hidden md:block">
            <ul className="flex items-center gap-6 text-sm font-semibold text-slate-600">
              <li>
                <a
                  href="#beneficios"
                  className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Benefícios
                </a>
              </li>
              <li>
                <a
                  href="#como-funciona"
                  className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Como funciona
                </a>
              </li>
            </ul>
          </nav>
          <a
            href="/login"
            onClick={goToLogin}
            className="rounded border border-primary bg-white px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-[#FDF2F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Entrar
          </a>
        </div>
      </header>

      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Portal de Carreiras — apresentação"
        className="outline-none"
      >
        {/* Hero institucional em bordô com destaque dourado. */}
        <section className="relative overflow-hidden bg-primary text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-secondary/20"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-1/4 h-64 w-64 rounded-full bg-secondary/10"
          />
          <div className="mx-auto w-full max-w-6xl px-6 py-20 sm:py-28">
            <p className="font-serif text-sm uppercase tracking-widest text-secondary">
              Universidade Católica de Pernambuco
            </p>
            <h1 className="mt-4 max-w-3xl font-serif text-4xl font-bold leading-tight sm:text-5xl">
              O seu futuro começa aqui.
            </h1>
            <p className="mt-3 max-w-2xl font-serif text-2xl text-secondary sm:text-3xl">
              Conectando os talentos da UNICAP ao mercado.
            </p>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
              O Portal de Carreiras reúne alunos e empresas em um processo
              seletivo transparente: currículo em PDF, match inteligente e
              acompanhamento de cada etapa — da inscrição à contratação.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="/login"
                onClick={goToLogin}
                className="rounded bg-secondary px-6 py-3 text-sm font-semibold text-slate-900 transition-transform hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                Entrar como Aluno
              </a>
              <a
                href="/login"
                onClick={goToLogin}
                className="rounded border border-white px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2 focus-visible:ring-offset-primary"
              >
                Portal da Empresa
              </a>
            </div>
          </div>
        </section>

        {/* Seção de benefícios — os 3 diferenciais do produto. */}
        <section
          id="beneficios"
          aria-labelledby="beneficios-title"
          className="mx-auto w-full max-w-6xl px-6 py-16"
        >
          <h2
            id="beneficios-title"
            className="font-serif text-3xl font-bold text-primary"
          >
            Por que o Portal de Carreiras?
          </h2>
          <p className="mt-2 max-w-2xl text-slate-600">
            Tudo o que aluno e empresa precisam para se encontrar, em um só
            lugar e com privacidade desde o primeiro clique.
          </p>
          <ul className="mt-8 grid gap-6 md:grid-cols-3">
            {BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1 transition-shadow hover:shadow-level2"
              >
                <span
                  aria-hidden="true"
                  className="mb-4 block h-1.5 w-12 rounded bg-secondary"
                />
                <h3 className="font-serif text-xl font-bold text-primary">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  {benefit.description}
                </p>
              </li>
            ))}
          </ul>
        </section>

        {/* Como funciona — o caminho do talento até a vaga. */}
        <section
          id="como-funciona"
          aria-labelledby="como-funciona-title"
          className="border-y border-slate-200 bg-white"
        >
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <h2
              id="como-funciona-title"
              className="font-serif text-3xl font-bold text-primary"
            >
              Como funciona
            </h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-serif text-lg font-bold text-white"
                  >
                    {index + 1}
                  </span>
                  <h3 className="font-serif text-lg font-bold text-primary">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Chamada final para a conversão. */}
        <section
          aria-labelledby="cta-title"
          className="mx-auto w-full max-w-6xl px-6 py-16"
        >
          <div className="rounded-lg border border-slate-200 bg-[#FDF2F4] p-8 text-center sm:p-12">
            <h2
              id="cta-title"
              className="font-serif text-2xl font-bold text-primary sm:text-3xl"
            >
              Pronto para dar o próximo passo na sua carreira?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-slate-600">
              Crie sua conta como aluno ou acesse o painel da sua empresa e
              publique a primeira vaga hoje mesmo.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-4">
              <a
                href="/login"
                onClick={goToLogin}
                className="rounded bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#520F1D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Entrar como Aluno
              </a>
              <a
                href="/login"
                onClick={goToLogin}
                className="rounded border border-primary bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-[#FDF2F4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                Portal da Empresa
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Rodapé institucional. */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="font-serif text-lg font-bold text-primary">
              Portal de Carreiras — UNICAP
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Universidade Católica de Pernambuco — talentos conectados ao
              mercado de trabalho.
            </p>
          </div>
          <nav aria-label="Links do rodapé">
            <ul className="flex flex-col gap-2 text-sm text-slate-600">
              <li>
                <a
                  href="/login"
                  onClick={goToLogin}
                  className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Entrar
                </a>
              </li>
              <li>
                <a
                  href="#beneficios"
                  className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Benefícios
                </a>
              </li>
              <li>
                <a
                  href="#como-funciona"
                  className="hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Como funciona
                </a>
              </li>
            </ul>
          </nav>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Universidade Católica de Pernambuco.
          Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}
