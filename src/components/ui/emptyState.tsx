import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  /** Ícone grande do Lucide (ex.: Inbox, FolderOpen, Search). */
  icon: LucideIcon;
  title: string;
  description: string;
  /** Call-to-action primária opcional (botão). */
  action?: { label: string; onClick: () => void };
  /** Tamanho compacto para uso dentro de colunas/cards estreitos. */
  compact?: boolean;
};

/**
 * [UI_OVERHAUL] Empty State ilustrado: ícone grande em halo institucional,
 * título, texto de apoio e CTA opcional. Substitui blocos de "sem dados"
 * por um convite à próxima ação (padrão SaaS premium).
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 text-center ${
        compact ? "gap-2 p-6" : "gap-3 p-10"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 ${
          compact ? "h-12 w-12" : "h-16 w-16"
        }`}
      >
        <Icon className={compact ? "h-6 w-6" : "h-8 w-8"} strokeWidth={1.75} />
      </span>
      <div className="max-w-sm">
        <p
          className={`font-semibold text-slate-800 ${
            compact ? "text-sm" : "text-base"
          }`}
        >
          {title}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-1 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-200 ease-in-out hover:bg-[#520F1D] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98]"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
