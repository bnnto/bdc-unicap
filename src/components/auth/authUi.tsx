import { useState, type AnimationEvent, type ReactNode } from "react";
import {
  Check,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { passwordRules } from "../../lib/auth";

/**
 * Base visual das telas públicas de acesso (/login e /recuperar-senha).
 *
 * Layout em duas colunas: painel de marca bordô (fixo, só em telas grandes)
 * + coluna do formulário. Cada parte entra em cascata (`.rise`, 60–80ms
 * entre itens) e as trocas de estado usam `.auth-swap` (fade + subida curta +
 * blur de 3px para mascarar o crossfade). Tudo só com transform/opacity e
 * respeitando `prefers-reduced-motion` (ver bloco [AUTH_REDESIGN] no
 * index.css).
 */

export const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/* ------------------------------------------------------------------ */
/* Hooks / utilidades                                                  */
/* ------------------------------------------------------------------ */

/** Tremida curta (±6px, 360ms) para erro de envio. Aplique no wrapper interno. */
export function useShake() {
  const [active, setActive] = useState(false);
  return {
    trigger: () => setActive(true),
    className: active ? "auth-shake" : "",
    onAnimationEnd: (event: AnimationEvent<HTMLElement>) => {
      if (event.animationName === "auth-shake") setActive(false);
    },
  };
}

/** "a, b e c" */
export function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/* ------------------------------------------------------------------ */
/* Peças compartilhadas                                                */
/* ------------------------------------------------------------------ */

/** Expande/recolhe (altura + fade) sem desmontar — fecha com visibility. */
export function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-[opacity,visibility] ${
        open
          ? "visible grid-rows-[1fr] opacity-100"
          : "invisible grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="-mx-1 min-h-0 overflow-hidden px-1">{children}</div>
    </div>
  );
}

/** Olhinho de mostrar/ocultar senha: os dois ícones fazem crossfade com blur. */
export function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: (next: boolean) => void;
}) {
  const base =
    "absolute h-4 w-4 transition-[opacity,transform,filter] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity";
  return (
    <button
      type="button"
      onClick={() => onToggle(!visible)}
      className="relative grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition-[color,transform] !duration-150 ease-out active:scale-90 motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className="sr-only">
        {visible ? "Ocultar senha" : "Mostrar senha"}
      </span>
      <Eye
        aria-hidden="true"
        className={`${base} ${
          visible ? "scale-75 opacity-0 blur-[2px]" : "scale-100 opacity-100"
        }`}
      />
      <EyeOff
        aria-hidden="true"
        className={`${base} ${
          visible ? "scale-100 opacity-100" : "scale-75 opacity-0 blur-[2px]"
        }`}
      />
    </button>
  );
}

export type PasswordRule = ReturnType<typeof passwordRules>[number];

/**
 * Medidor + checklist de requisitos. A barra cresce com `scaleX` (GPU) e muda
 * de cor (fraca → quase lá → forte); cada requisito marca com transição.
 */
export function PasswordMeter({
  rules,
  show,
}: {
  rules: PasswordRule[];
  show: boolean;
}) {
  const total = rules.length;
  const done = rules.filter((rule) => rule.ok).length;
  const ratio = total === 0 ? 0 : done / total;
  const tone =
    ratio === 1 ? "bg-success" : ratio >= 0.6 ? "bg-warning" : "bg-danger";
  const label = ratio === 1 ? "Forte" : ratio >= 0.6 ? "Quase lá" : "Fraca";
  const labelTone =
    ratio === 1
      ? "text-success"
      : ratio >= 0.6
        ? "text-warning"
        : "text-danger";

  return (
    <Collapse open={show}>
      <div className="pb-1 pt-1">
        <div className="flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100"
            aria-hidden="true"
          >
            <div
              className={`h-full w-full origin-left rounded-full transition-[transform,background-color] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${tone}`}
              style={{ transform: `scaleX(${Math.max(ratio, 0.04)})` }}
            />
          </div>
          <span
            className={`w-14 text-right text-xs font-bold transition-colors duration-300 ${labelTone}`}
          >
            {label}
          </span>
        </div>
        <ul
          aria-label="Requisitos da senha"
          aria-live="polite"
          className="mt-3 flex flex-col gap-1.5 text-xs"
        >
          {rules.map((rule) => (
            <li
              key={rule.id}
              className={`flex items-start gap-2 transition-colors duration-200 ${
                rule.ok ? "font-medium text-success" : "text-a11y-slate-500"
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-px grid h-4 w-4 shrink-0 place-items-center rounded-full border transition-[background-color,border-color] duration-200 ${
                  rule.ok
                    ? "border-success bg-success text-white"
                    : "border-slate-300 text-transparent"
                }`}
              >
                <Check
                  className={`h-2.5 w-2.5 transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
                    rule.ok ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                  strokeWidth={3.5}
                />
              </span>
              <span>
                {rule.label}
                <span className="sr-only">
                  {rule.ok ? " (atendido)" : " (pendente)"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Collapse>
  );
}

/** Cartão do formulário (entra com `.rise`). */
export function AuthCard({
  children,
  delay = 60,
}: {
  children: ReactNode;
  delay?: number;
}) {
  return (
    <div
      className={`${SURFACE} rise p-7 sm:p-8`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Painel de marca                                                     */
/* ------------------------------------------------------------------ */

const FEATURES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  {
    icon: FileText,
    title: "Currículo que fala por você",
    text: "Monte seu perfil uma vez e use em todas as candidaturas.",
  },
  {
    icon: Target,
    title: "Compatibilidade calculada",
    text: "Veja o % de match com cada vaga antes de se candidatar.",
  },
  {
    icon: ShieldCheck,
    title: "Seu contato, sua decisão",
    text: "Você libera ou revoga o contato por vaga, em conformidade com a LGPD.",
  },
];

const RINGS = [60, 110, 160, 210, 260];

function Decor() {
  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(48rem_32rem_at_100%_0%,rgba(200,157,60,0.24),transparent_62%),radial-gradient(36rem_28rem_at_0%_100%,rgba(0,0,0,0.32),transparent_60%)]"
      />
      {/* Anéis concêntricos que se desenham uma vez e ficam parados. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 600 600"
        fill="none"
        className="pointer-events-none absolute -bottom-44 -right-44 h-[46rem] w-[46rem] -rotate-90"
      >
        {RINGS.map((radius, index) => (
          <circle
            key={radius}
            cx="300"
            cy="300"
            r={radius}
            pathLength={1}
            strokeWidth={index === 3 ? 1.5 : 1}
            stroke={index === 3 ? "#c89d3c" : "#ffffff"}
            strokeOpacity={index === 3 ? 0.6 : 0.14}
            className="auth-draw"
            style={{ animationDelay: `${200 + index * 160}ms` }}
          />
        ))}
      </svg>
    </>
  );
}

function LogoChip({ className = "" }: { className?: string }) {
  return (
    // bg-[#fff] (e não bg-white) para o modo escuro não repintar o logo.
    <span
      className={`grid shrink-0 place-items-center rounded-2xl bg-[#fff] p-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.08)] ${className}`}
    >
      <img
        src="/logounicap.png"
        alt=""
        className="h-full w-full object-contain"
      />
    </span>
  );
}

function BrandPanel() {
  return (
    <div className="relative hidden animate-[view-enter-fade_700ms_ease-out_both] overflow-hidden bg-primary text-white motion-reduce:animate-none lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:justify-between lg:self-start lg:p-12 xl:p-16">
      <Decor />

      <div className="rise relative z-10 flex items-center gap-3 [animation-delay:100ms]">
        <LogoChip className="h-12 w-12" />
        <p className="font-serif text-lg font-bold tracking-tight">UNICAP</p>
      </div>

      <div className="relative z-10 max-w-lg">
        <p className="rise font-serif text-xs font-semibold uppercase tracking-[0.16em] text-[#e9cf94] [animation-delay:180ms]">
          Universidade Católica de Pernambuco
        </p>
        <p className="rise mt-4 font-serif text-5xl font-bold leading-[1.05] tracking-[-0.02em] [animation-delay:260ms] xl:text-6xl">
          Banco de Currículos
        </p>
        <p className="rise mt-5 max-w-md text-base leading-relaxed text-white/85 [animation-delay:340ms]">
          O encontro entre quem está se formando e quem está contratando.
        </p>

        <ul className="mt-10 flex flex-col gap-5">
          {FEATURES.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              className="rise flex items-start gap-4"
              style={{ animationDelay: `${440 + index * 80}ms` }}
            >
              <span
                aria-hidden="true"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[#e9cf94] ring-1 ring-white/15"
              >
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{title}</span>
                <span className="mt-0.5 block text-sm leading-relaxed text-white/75">
                  {text}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

/**
 * Estrutura comum. O `<main id="conteudo">` é único e destino do skip-link
 * (WCAG 2.4.1) — cada página que usa o shell continua dona do seu landmark.
 */
export function AuthShell({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <BrandPanel />

      <main
        id="conteudo"
        tabIndex={-1}
        aria-label={ariaLabel}
        className="flex min-h-screen items-center justify-center px-4 py-10 outline-none sm:px-8"
      >
        <div className="w-full max-w-md">
          {/* Marca compacta para telas pequenas (o painel só aparece no lg). */}
          <div className="rise mb-6 flex items-center gap-3 lg:hidden">
            <LogoChip className="h-11 w-11" />
            <div>
              <p className="font-serif text-lg font-bold leading-tight tracking-tight text-primary">
                Banco de Currículos
              </p>
              <p className="text-xs text-a11y-slate-500">
                Universidade Católica de Pernambuco
              </p>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}