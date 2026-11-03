import { useRef } from "react";
import { ArrowDown, ArrowRight, ShieldAlert } from "lucide-react";

/**
 * Aviso de "contato não liberado".
 *
 * - Aparece/desaparece com uma colapsada suave (grid-rows 0fr↔1fr + opacity),
 *   então nada "pula" na tela quando o aluno libera a última vaga.
 * - Mantém o último número exibido durante a animação de saída.
 * - O halo do ícone pulsa só 3 vezes (chama atenção sem cansar).
 */
type Props = {
  /** Quantidade de vagas com contato não liberado. 0 = aviso recolhido. */
  count: number;
  /** Botão de ação. Omita para mostrar só o texto-guia. */
  action?: { label: string; onClick: () => void };
  /** Texto-guia quando não há botão (ex.: "veja abaixo"). */
  guide?: string;
};

export function ContactNotice({ count, action, guide }: Props) {
  const shown = count > 0;
  const last = useRef(count);
  if (count > 0) last.current = count;
  const n = last.current;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
        shown ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
      }`}
      aria-hidden={!shown}
    >
      <div className="-mx-2 min-h-0 overflow-hidden px-2 pb-3 pt-6">
        {n > 0 ? (
          <div className="relative overflow-hidden rounded-3xl border border-amber-200/80 bg-[#FFFBEB] shadow-[0_0_0_1px_rgba(180,83,9,0.06),0_12px_32px_-16px_rgba(180,83,9,0.28)] dark:border-amber-400/25 dark:bg-[#26200f] [.high-contrast_&]:border-black [.high-contrast_&]:bg-white [.dark.high-contrast_&]:border-white [.dark.high-contrast_&]:bg-black">
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1.5 bg-warning"
            />
            <div className="flex flex-col gap-5 p-6 pl-8 sm:flex-row sm:items-center">
              <div className="relative shrink-0 self-start sm:self-center">
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-ping rounded-2xl bg-warning/40 motion-reduce:hidden"
                  style={{ animationIterationCount: 3 }}
                />
                <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-warning text-white">
                  <ShieldAlert className="h-6 w-6" aria-hidden="true" />
                </span>
                <span
                  key={n}
                  aria-hidden="true"
                  className="badge-pop absolute -right-2 -top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-secondary px-1.5 text-xs font-bold tabular-nums text-slate-900 ring-2 ring-[#FFFBEB] dark:ring-[#26200f]"
                >
                  {n > 99 ? "99+" : n}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-serif text-xl font-bold tracking-tight text-slate-900">
                  Contato não liberado em {n} {n === 1 ? "vaga" : "vagas"}
                </p>
                <p className="mt-1 max-w-prose text-sm leading-relaxed text-slate-600">
                  {n === 1
                    ? "O recrutador dessa vaga ainda não vê seus dados de contato e não consegue te chamar para a próxima etapa. Libere para não perder a chance."
                    : "Os recrutadores dessas vagas ainda não veem seus dados de contato e não conseguem te chamar para as próximas etapas. Libere para não perder a chance."}
                </p>
              </div>

              {action !== undefined ? (
                <button
                  type="button"
                  onClick={action.onClick}
                  tabIndex={shown ? 0 : -1}
                  className="group inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-white transition-transform !duration-150 ease-out active:scale-[0.97] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#520f1d] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                >
                  {action.label}
                  <ArrowRight
                    className="h-4 w-4 transition-transform !duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              ) : guide !== undefined ? (
                <p className="flex shrink-0 items-center gap-2 text-sm font-semibold text-warning">
                  {guide}
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}