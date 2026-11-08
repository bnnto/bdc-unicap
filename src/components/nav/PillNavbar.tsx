import {
  useCallback,
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
 *
 * Responsividade (mobile-first, baseada na largura REAL do header via
 * container queries — `[@container(min-width:...)]`, Tailwind >= 3.1):
 *
 *  - < 36rem  : pílula em 2 linhas (logo | usuário  /  abas em largura total).
 *               O título aparece a partir de 20rem e o nome do usuário a
 *               partir de 30rem, pois a linha de cima tem folga.
 *  - >= 36rem : uma única linha (logo | abas | usuário). Aqui só o avatar
 *               aparece, para sobrar espaço às abas.
 *  - >= 64rem : o nome do usuário volta a aparecer.
 *  - >= 72rem : o título "Banco de Currículos" volta a aparecer.
 *
 * As abas rolam na horizontal quando não cabem: o destaque rola junto
 * (vive dentro do scroller), a aba ativa é centralizada automaticamente,
 * e um fade nas bordas indica que há mais abas além da área visível.
 */

export type PillTab<K extends string> = {
  key: K;
  label: string;
  /** Ícone lucide opcional ao lado do texto. */
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Conteúdo extra depois do texto (ex.: badge de pendências). */
  badge?: ReactNode;
};

type Box = { left: number; top: number; width: number; height: number };
type Edges = { start: boolean; end: boolean };

/** Largura do degradê que sinaliza "tem mais abas" nas bordas do scroller. */
const FADE = "1.5rem";

function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

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
  const scrollerRef = useRef<HTMLDivElement>(null);
  const didInitialScroll = useRef(false);
  const [indicator, setIndicator] = useState<Box | null>(null);
  const [edges, setEdges] = useState<Edges>({ start: false, end: false });

  // Muda quando o conjunto de abas muda (não só a quantidade).
  const tabKeys = tabs.map((tab) => tab.key).join("|");

  // Descobre se há abas escondidas à esquerda/direita (para o fade).
  const updateEdges = useCallback(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    const max = scroller.scrollWidth - scroller.clientWidth;
    const start = scroller.scrollLeft > 1;
    const end = scroller.scrollLeft < max - 1;
    setEdges((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);

  // Mede a aba ativa e reposiciona o destaque. O destaque vive DENTRO do
  // scroller (o mesmo elemento é o offsetParent das abas), então as
  // coordenadas são estáveis durante a rolagem e ele rola junto com as abas.
  // O ResizeObserver cobre badges (mudam a largura da aba), o carregamento
  // da fonte e mudanças de largura do container (empilhar/desempilhar).
  useLayoutEffect(() => {
    const measure = () => {
      const el = active === null ? null : tabRefs.current[active];
      const next: Box | null = el
        ? {
            left: el.offsetLeft,
            top: el.offsetTop,
            width: el.offsetWidth,
            height: el.offsetHeight,
          }
        : null;
      setIndicator((prev) => (sameBox(prev, next) ? prev : next));
      updateEdges();
    };
    measure();
    const ro = new ResizeObserver(measure);
    Object.values(tabRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });
    if (scrollerRef.current) ro.observe(scrollerRef.current);
    return () => ro.disconnect();
  }, [active, tabKeys, updateEdges]);

  // Traz a aba ativa para o centro da área visível quando as abas rolam.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const el = active === null ? null : tabRefs.current[active];
    if (scroller === null || el === null || el === undefined) return;
    if (scroller.scrollWidth <= scroller.clientWidth) return;
    const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scroller.scrollTo({
      left: Math.max(0, left),
      // Primeira renderização: posiciona direto, sem animar.
      behavior:
        reduceMotion || !didInitialScroll.current ? "auto" : "smooth",
    });
    didInitialScroll.current = true;
  }, [active, tabKeys]);

  // Fade só nas bordas que realmente têm conteúdo escondido.
  const maskImage = `linear-gradient(to right, ${
    edges.start ? `transparent 0, #000 ${FADE}` : "#000 0"
  }, ${
    edges.end ? `#000 calc(100% - ${FADE}), transparent 100%` : "#000 100%"
  })`;
  const maskStyle =
    edges.start || edges.end
      ? { maskImage, WebkitMaskImage: maskImage }
      : undefined;

  const initials = userName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return (
    // O header é o container das queries. Padding lateral >= 1rem (as "orelhas"
    // da pílula avançam 1rem para fora) e respeito à safe-area (notch/iOS).
    <header className="manager-nav pointer-events-none sticky top-0 z-40 flex justify-center pt-[env(safe-area-inset-top,0px)] ps-[max(1rem,env(safe-area-inset-left,0px))] pe-[max(1rem,env(safe-area-inset-right,0px))] [container-type:inline-size]">
      {/*
        Grid da pílula:
          estreito -> 2 colunas (1fr | auto): linha 1 = logo | usuário,
                      linha 2 = abas ocupando as 2 colunas.
          largo    -> 3 colunas (auto | 1fr | auto) em uma linha.
      */}
      <div className="manager-nav-pill pointer-events-auto relative grid w-full max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-b-3xl px-3 py-2.5 [@container(min-width:36rem)]:w-auto [@container(min-width:36rem)]:grid-cols-[auto_minmax(0,1fr)_auto] [@container(min-width:36rem)]:gap-x-6 [@container(min-width:36rem)]:px-3.5 [@container(min-width:36rem)]:py-[11px]">
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
        <div className="col-start-1 row-start-1 flex min-w-0 items-center gap-2.5">
          <img
            src="/logounicap.png"
            alt="UNICAP"
            decoding="async"
            className="manager-nav-logo h-9 w-auto shrink-0 rounded-[10px] object-contain"
          />
          <span className="hidden min-w-0 truncate text-base font-semibold tracking-tight [@container(min-width:20rem)_and_(max-width:35.999rem)]:inline [@container(min-width:72rem)]:inline">
            Banco de Currículos
          </span>
        </div>

        {/* Centro: abas de navegação (padrão ARIA tabs). */}
        <nav
          aria-label={navLabel}
          className="col-span-2 col-start-1 row-start-2 min-w-0 [@container(min-width:36rem)]:col-span-1 [@container(min-width:36rem)]:col-start-2 [@container(min-width:36rem)]:row-start-1"
        >
          {/*
            Scroller: é o offsetParent das abas e contém o destaque.
            O padding de 6px (compensado por margem negativa) dá espaço ao
            anel de foco, que seria cortado pelo overflow. Não pode haver
            outro elemento posicionado entre o scroller e as abas.
          */}
          <div
            ref={scrollerRef}
            onScroll={updateEdges}
            style={maskStyle}
            className="relative -mx-1.5 -my-1.5 overflow-x-auto overscroll-x-contain px-1.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {indicator !== null ? (
              <span
                aria-hidden="true"
                // `left-0` físico de propósito: offsetLeft também é físico.
                className="manager-nav-indicator pointer-events-none absolute left-0 top-0 rounded-lg"
                style={{
                  width: indicator.width,
                  height: indicator.height,
                  transform: `translate(${indicator.left}px, ${indicator.top}px)`,
                }}
              />
            ) : null}
            <ul
              className="flex w-max min-w-full items-center gap-1"
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
                      <tab.icon className="h-4 w-4 shrink-0" aria-hidden={true} />
                    ) : null}
                    {tab.label}
                    {tab.badge}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Direita: foto + nome (leva a /perfil, onde também mora o "Sair"). */}
        <button
          type="button"
          aria-label="Meu perfil e configurações"
          aria-current={userActive ? "page" : undefined}
          onClick={() => navigateTo("/perfil")}
          className="manager-nav-user col-start-2 row-start-1 flex shrink-0 items-center gap-2 justify-self-end rounded-xl py-1.5 ps-1.5 pe-3 [@container(min-width:36rem)]:col-start-3"
        >
          {userImage ? (
            <img
              src={userImage}
              alt=""
              className="h-7 w-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="manager-nav-avatar flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
            >
              {initials}
            </span>
          )}
          <span className="hidden max-w-[10rem] truncate text-sm font-semibold [@container(min-width:30rem)_and_(max-width:35.999rem)]:block [@container(min-width:64rem)]:block">
            {userName}
          </span>
        </button>
      </div>
    </header>
  );
}