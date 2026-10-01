import { useEffect, useRef, useState } from "react";
import { SignOutButton } from "../auth/SignOutButton";
import { useAuthState } from "../auth/authContext";
import { StudentHomePage } from "./StudentHomePage";
import { ResumeBuilderPage } from "./ResumeBuilderPage";
import { JobOpportunities } from "./JobOpportunities";
import { MyApplicationsPage } from "./MyApplicationsPage";

/**
 * [REFACTOR_ALUNO Etapa 1] — StudentShell: navbar superior em largura
 * total (container max-w-[1440px]) com logo UNICAP à esquerda, abas ao
 * centro (padrão ARIA tabs — uma tela visível por vez) e avatar com
 * menu dropdown à direita ("Meu Perfil" e "Sair").
 *
 * [S8-2] — as abas usam role=tablist/tab/tabpanel com aria-controls e o
 * dropdown expõe aria-expanded/aria-haspopup="menu" (teclado + leitor
 * de tela); o landmark main continua único no App.
 */
export type StudentTab =
  "curriculo" | "oportunidades" | "candidaturas" | "perfil";

const TABS: Array<{ key: StudentTab; label: string }> = [
  { key: "curriculo", label: "Meu Currículo" },
  { key: "oportunidades", label: "Oportunidades" },
  { key: "candidaturas", label: "Minhas Candidaturas" },
];

/** Iniciais do avatar: primeira + última palavra em caixa alta. */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

export function StudentShell() {
  const { user } = useAuthState();
  const userName = user?.name ?? user?.email ?? "Aluno";
  const [active, setActive] = useState<StudentTab>("curriculo");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Fecha o dropdown ao clicar fora ou pressionar Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(event: MouseEvent) {
      if (
        menuRef.current !== null &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [menuOpen]);

  function selectTab(tab: StudentTab) {
    setActive(tab);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="border-b border-slate-200 bg-white shadow-level1">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-3">
          {/* Esquerda: logo institucional UNICAP. */}
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 items-center justify-center rounded bg-primary font-serif text-sm font-bold text-white"
            >
              UC
            </span>
            <div>
              <p className="font-serif text-lg font-bold leading-tight text-primary">
                Portal de Carreiras — UNICAP
              </p>
              <p className="text-xs text-slate-500">Portal do Aluno</p>
            </div>
          </div>

          {/* Centro: abas de navegação (padrão ARIA tabs). */}
          <nav aria-label="Seções do portal" className="order-3 lg:order-2">
            <ul className="flex flex-wrap items-center gap-1" role="tablist">
              {TABS.map((tab) => (
                <li key={tab.key} role="presentation">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={active === tab.key}
                    aria-controls={`panel-${tab.key}`}
                    id={`tab-${tab.key}`}
                    onClick={() => selectTab(tab.key)}
                    className={`rounded px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                      active === tab.key
                        ? "border-b-2 border-secondary bg-[#FDF2F4] text-primary"
                        : "border-b-2 border-transparent text-slate-600 hover:bg-[#FDF2F4] hover:text-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Direita: avatar com dropdown (Meu Perfil / Sair). */}
          <div
            ref={menuRef}
            className="relative order-2 flex items-center gap-2 lg:order-3"
          >
            <button
              type="button"
              aria-label="Menu do perfil"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-bold text-white transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              {initialsOf(userName)}
            </button>
            <span className="hidden text-sm font-semibold text-slate-700 sm:block">
              {userName}
            </span>
            {menuOpen ? (
              <div
                role="menu"
                aria-label="Menu do perfil"
                className="absolute right-0 top-full z-30 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-level2"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => selectTab("perfil")}
                  className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-slate-700 transition-colors hover:bg-[#FDF2F4] hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Meu Perfil
                </button>
                <div
                  role="menuitem"
                  className="mt-1 border-t border-slate-100 pt-1"
                >
                  <SignOutButton />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {/* Painéis: uma tela visível por vez (renderização condicional).
          [S8-2] landmark main único do fluxo do aluno (#conteudo). */}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Conteúdo principal"
        className="outline-none"
      >
        {active === "curriculo" ? (
          <div
            role="tabpanel"
            id="panel-curriculo"
            aria-labelledby="tab-curriculo"
            tabIndex={-1}
          >
            <ResumeBuilderPage />
          </div>
        ) : null}
        {active === "oportunidades" ? (
          <div
            role="tabpanel"
            id="panel-oportunidades"
            aria-labelledby="tab-oportunidades"
            tabIndex={-1}
          >
            <JobOpportunities />
          </div>
        ) : null}
        {active === "candidaturas" ? (
          <div
            role="tabpanel"
            id="panel-candidaturas"
            aria-labelledby="tab-candidaturas"
            tabIndex={-1}
          >
            <MyApplicationsPage />
          </div>
        ) : null}
        {active === "perfil" ? (
          // "Meu Perfil" vem do dropdown (sem aba correspondente no tablist).
          <div
            role="tabpanel"
            id="panel-perfil"
            aria-label="Meu Perfil"
            tabIndex={-1}
          >
            <StudentHomePage />
          </div>
        ) : null}
      </main>
    </>
  );
}
