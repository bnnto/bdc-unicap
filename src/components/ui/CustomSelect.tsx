import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";

export function CustomSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
  className = "",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Opção para onde a marcação está (ou deslizando).
  const [target, setTarget] = useState(value);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  // false na abertura: a marcação nasce na opção atual, sem deslizar do topo.
  const [pillReady, setPillReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // Mede a opção alvo (só transform/altura da marcação, sem layout em loop).
  useLayoutEffect(() => {
    if (!open) return;
    const el = optionRefs.current[target];
    if (el) setPill({ top: el.offsetTop, height: el.offsetHeight });
  }, [open, target]);

  // Liga a transição só depois da primeira medição.
  useEffect(() => {
    if (!open || pill === null || pillReady) return;
    const id = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(id);
  }, [open, pill, pillReady]);

  function toggle() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) {
      setOpen(false);
      return;
    }
    setTarget(value);
    setPillReady(false);
    setOpen(true);
  }

  function pick(event: ReactMouseEvent, next: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const unchanged = next === target;
    setTarget(next);
    onChange(next);
    // Teclado, movimento reduzido ou mesma opção: fecha na hora, sem animar.
    const instant =
      unchanged ||
      event.detail === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (instant) {
      setOpen(false);
    } else {
      closeTimer.current = setTimeout(() => setOpen(false), 200);
    }
  }

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={ref}>
      {label ? <span className="text-xs font-medium text-slate-500">{label}</span> : null}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || placeholder}
        onClick={toggle}
        disabled={disabled}
        className="flex h-11 w-full items-center justify-between rounded-xl border border-slate-300 bg-white pl-3.5 pr-3 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:focus:ring-offset-[#0f1218] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+8px)] z-50 max-h-60 w-full overflow-auto rounded-2xl border border-transparent bg-white p-1.5 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.15),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-[#171b22] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]">
          <ul className="relative flex flex-col gap-0.5">
            {/* Marcação única que desliza até a opção escolhida. */}
            {pill !== null ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 top-0 w-full rounded-xl bg-[#FDF2F4] will-change-transform dark:bg-white/5"
                style={{
                  height: pill.height,
                  transform: `translateY(${pill.top}px)`,
                  transition: pillReady
                    ? "transform 520ms cubic-bezier(0.23, 1, 0.32, 1)"
                    : "none",
                }}
              />
            ) : null}
            {options.map((option) => {
              const isTarget = target === option.value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    ref={(el) => {
                      optionRefs.current[option.value] = el;
                    }}
                    onClick={(e) => pick(e, option.value)}
                    className={`relative z-10 flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isTarget
                        ? "font-semibold text-primary"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {option.label}
                    {isTarget ? <Check className="h-4 w-4 text-primary" /> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}