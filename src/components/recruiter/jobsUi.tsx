import { useId, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * Tokens visuais compartilhados por JobsPanel, JobForm e JobKanban.
 * Mesma linguagem do Banco de Talentos / Painel Estratégico: superfícies
 * suaves, serifada nos títulos, sans nos textos, movimento contido.
 */

/** Superfície padrão do projeto (anel + sombra longa; alto contraste volta borda). */
export const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

/** Variante compacta (cards do Kanban). */
export const CARD_SURFACE = SURFACE.replace("rounded-3xl", "rounded-2xl");

/** "Press" do projeto: resposta imediata (150ms) e retorno suave. */
export const PRESS =
  "transition-[background-color,color,border-color,box-shadow,transform] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.985] active:duration-150 motion-reduce:[transition-property:background-color,color,border-color,opacity] motion-reduce:active:scale-100";

/** Hover de card: só aprofunda a sombra e só com ponteiro preciso. */
export const CARD_HOVER =
  "transition-shadow duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[0_0_0_1px_rgba(15,23,42,0.1),0_2px_4px_rgba(15,23,42,0.05),0_24px_48px_-20px_rgba(15,23,42,0.22)]";

export const DIVIDER = "border-slate-100 dark:border-white/10";

export const LABEL_CLASS =
  "text-sm font-semibold text-slate-700 dark:text-slate-200";

export const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition-colors duration-150 placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:[color-scheme:dark] dark:[&_option]:bg-[#171b22] dark:[&_option]:text-slate-200";

export const TEXTAREA_CLASS =
  "w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm leading-relaxed text-slate-900 transition-colors duration-150 placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:focus:ring-offset-[#0f1218]";

/** `<select>` nativo com a mesma aparência (usado onde um dropdown custom seria cortado, ex.: modais). */
export const SELECT_CLASS =
  "w-full appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke-width=%222%22%20stroke=%22%2394a3b8%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_0.875rem_center] bg-[size:1.125em_1.125em] h-11 rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-900 transition-colors duration-150 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:focus:ring-offset-[#0f1218]";

/**
 * Keyframes locais (curva ease-out forte). `backwards` (e não `both`) para
 * que o estado final NÃO fique preso por cima de classes como opacity-50.
 * Movimento reduzido vira um fade curto.
 */
const MOTION_CSS = `
@keyframes jb-rise { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes jb-fade { from { opacity: 0; } to { opacity: 1; } }
.jb-rise { animation: jb-rise 260ms cubic-bezier(0.23, 1, 0.32, 1) backwards; }
.jb-fade { animation: jb-fade 200ms ease-out backwards; }
@media (prefers-reduced-motion: reduce) {
  .jb-rise { animation-name: jb-fade; animation-duration: 150ms; }
}
`;

export function MotionStyles() {
  return <style>{MOTION_CSS}</style>;
}

/** Cabeçalho editorial das páginas (título serifado + descrição + ações). */
export function PageHeader({
  title,
  description,
  actions,
  leading,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 max-w-3xl">
        {leading !== undefined ? <div className="mb-4">{leading}</div> : null}
        <h2 className="break-words font-serif text-3xl font-bold leading-[1.1] tracking-tight text-primary sm:text-4xl">
          {title}
        </h2>
        {description !== undefined ? (
          <p className="mt-3 text-base leading-relaxed text-slate-600 dark:text-slate-400">
            {description}
          </p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}

/** Ladrilho de ícone em tom institucional (títulos de seção e modais). */
export function IconTile({
  children,
  size = "md",
}: {
  children: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center bg-[#FDF2F4] text-primary ring-1 ring-primary/15 dark:bg-primary/15 ${
        size === "lg" ? "h-11 w-11 rounded-2xl" : "h-9 w-9 rounded-xl"
      }`}
    >
      {children}
    </span>
  );
}

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  hint?: string;
  /** Adorno à esquerda dentro do campo (ex.: "R$"). */
  prefix?: ReactNode;
};

/**
 * Campo de texto com label, dica e asterisco de obrigatório via CSS
 * (`::after` — não entra no nome acessível do campo).
 */
export function TextField({
  label,
  hint,
  prefix,
  required,
  className = "",
  id,
  ...rest
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={inputId}
        className={`${LABEL_CLASS} ${
          required === true
            ? "after:ml-0.5 after:text-danger after:content-['*']"
            : ""
        }`}
      >
        {label}
      </label>
      <div className="relative">
        {prefix !== undefined ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400"
          >
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          required={required}
          aria-describedby={hint !== undefined ? hintId : undefined}
          className={`${INPUT_CLASS} ${prefix !== undefined ? "pl-10" : ""}`}
          {...rest}
        />
      </div>
      {hint !== undefined ? (
        <p id={hintId} className="text-xs text-a11y-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}