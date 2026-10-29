import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { navigateTo } from "../../lib/router";
import "../../managerNavbar.css";

/**
 * Navbar "pílula flutuante" compartilhada (gestor, recrutador, estudante).
 *
 * Logo (imagem) + "Banco de Currículos" à esquerda, abas no meio com um
 * destaque único que desliza entre elas (só `transform`, sem recalcular
 * layout) e, à direita, foto + nome do usuário (leva a /perfil).
 *
 * Os estilos continuam em `managerNavbar.css` (variáveis --mn-*): claro,
 * escuro e alto contraste. Mantém o padrão ARIA tabs: cada aba controla o
 * `tabpanel` renderizado pelo AuthGate (`panel-${key}`).
 */

export type PillTab<K extends string> = {
  key: K;
  label: string;
  /** Ícone lucide opcional ao lado do texto. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Conteúdo extra depois do texto (ex.: badge de pendências). */
  badge?: ReactNode;
};

export function PillNavbar<K extends string>({
  tabs,
  active,
  onChange,
  userName,
  userImage,
  userActive,
  navLabel = "Seções do portal",
}: {
  tabs: PillTab<K>[];
  active: K | null;
  onChange: (tab: K) => void;
  userName: string;
  /** Foto de avatar (data URL) quando definida. */
  userImage?: string;
  /** Destaca o botão do usuário (usado na página de perfil). */
  userActive?: boolean;
  navLabel?: string;
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicator, setIndicator] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  // Mede a aba ativa e reposiciona o destaque. O ResizeObserver cobre os
  // badges (que mudam a largura da aba) e o carregamento da fonte.
  useLayoutEffect(() => {
    const measure = () => {
      const el = active === null ? null : tabRefs.current[active];
      setIndicator(
        el
          ? {
              left: el.offsetLeft,
              top: el.offsetTop,
              width: el.offsetWidth,
              height: el.offsetHeight,
            }
          : null,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    Object.values(tabRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [active, tabs.length]);

  return (
    <header className="manager-nav pointer-events-none sticky top-0 z-40 flex justify-center px-4">
      <div className="manager-nav-pill pointer-events-auto relative flex max-w-full items-center gap-6 rounded-b-3xl px-3.5 py-[11px]">
        {/* Pontas côncavas no topo (efeito "orelha" da pílula). */}
        <span
          aria-hidden="true"
          className="manager-nav-ear--left absolute -left-4 top-0 h-4 w-4"
        />
        <span
          aria-hidden="true"
          className="manager-nav-ear--right absolute -right-4 top-0 h-4 w-4"
        />

        {/* Esquerda: logo + nome do portal. */}
        <div className="flex shrink-0 items-center gap-2.5">
          <img
            src="/logounicap.png"    
            alt="UNICAP"
            className="manager-nav-logo h-9 w-auto shrink-0 rounded-[10px] object-contain"
          />
          <span className="hidden text-base font-semibold tracking-tight md:inline">
            Banco de Currículos
          </span>
        </div>

        {/* Centro: abas de navegação (padrão ARIA tabs). */}
        <nav aria-label={navLabel} className="relative min-w-0">
          {indicator !== null ? (
            <span
              aria-hidden="true"
              className="manager-nav-indicator pointer-events-none absolute left-0 top-0 rounded-lg"
              style={{
                width: indicator.width,
                height: indicator.height,
                transform: `translate(${indicator.left}px, ${indicator.top}px)`,
              }}
            />
          ) : null}
          <ul
            className="flex items-center gap-1 overflow-x-auto"
            role="tablist"
          >
            {tabs.map((tab) => (
              <li key={tab.key} role="presentation" className="shrink-0">
                <button
                  ref={(el) => {
                    tabRefs.current[tab.key] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={active === tab.key}
                  aria-controls={`panel-${tab.key}`}
                  id={`tab-${tab.key}`}
                  onClick={() => onChange(tab.key)}
                  className="manager-nav-tab relative z-10 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
                >
                  {tab.icon !== undefined ? (
                    <tab.icon className="h-4 w-4" aria-hidden={true} />
                  ) : null}
                  {tab.label}
                  {tab.badge}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* Direita: foto + nome (leva a /perfil, onde também mora o "Sair"). */}
        <button
          type="button"
          aria-label="Meu perfil e configurações"
          aria-current={userActive ? "page" : undefined}
          onClick={() => navigateTo("/perfil")}
          className="manager-nav-user flex shrink-0 items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-3"
        >
          {userImage ? (
            <img
              src={userImage}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="manager-nav-avatar flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold"
            >
              {userName
                .split(" ")
                .slice(0, 2)
                .map((part) => part.charAt(0).toUpperCase())
                .join("")}
            </span>
          )}
          <span className="hidden max-w-[10rem] truncate text-sm font-semibold sm:block">
            {userName}
          </span>
        </button>
      </div>
    </header>
  );
}