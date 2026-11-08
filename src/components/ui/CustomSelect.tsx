import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Check, ChevronDown } from "lucide-react";

/** Curva forte de saída (nunca ease-in em UI). */
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

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
  // Três estados para a lista poder ter animação de saída:
  // - open: intenção (aria-expanded);
  // - mounted: está no DOM;
  // - shown: está visualmente "presente" (opacity/scale).
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  // Opção para onde a marcação está (ou deslizando).
  const [target, setTarget] = useState(value);
  const [pill, setPill] = useState<{ top: number; height: number } | null>(null);
  // false na abertura: a marcação nasce na opção atual, sem deslizar do topo.
  const [pillReady, setPillReady] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleClickOutside(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handleClickOutside);
    return () => document.removeEventListener("pointerdown", handleClickOutside);
  }, []);

  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  // Entrada/saída da lista: monta, espera 2 frames para o estado inicial
  // ser pintado (senão a transição não dispara) e só então "mostra".
  // Na saída, esconde primeiro e desmonta quando a transição termina.
  useEffect(() => {
    if (open && mounted) {
      let second = 0;
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(first);
        cancelAnimationFrame(second);
      };
    }
    if (!open) {
      setShown(false);
      const id = window.setTimeout(() => setMounted(false), 160);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [open, mounted]);

  // Mede a opção alvo (só transform/altura da marcação, sem layout em loop).
  useLayoutEffect(() => {
    if (!mounted) return;
    const el = optionRefs.current[target];
    if (el) setPill({ top: el.offsetTop, height: el.offsetHeight });
  }, [mounted, target]);

  // Liga a transição só depois da primeira medição.
  useEffect(() => {
    if (!mounted || pill === null || pillReady) return;
    const id = requestAnimationFrame(() => setPillReady(true));
    return () => cancelAnimationFrame(id);
  }, [mounted, pill, pillReady]);

  function toggle() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) {
      setOpen(false);
      return;
    }
    setTarget(value);
    setPillReady(false);
    setMounted(true);
    setOpen(true);
  }

  function pick(event: ReactMouseEvent, next: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const unchanged = next === target;
    setTarget(next);
    onChange(next);
    // Teclado, movimento reduzido ou mesma opção: fecha na hora, sem esperar.
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
  // Sem seleção ("Todos…"): texto em tom suave, como um placeholder.
  const isEmpty = value === "";

  return (
    <div
      className={`relative flex flex-col gap-1.5 ${className}`}
      ref={ref}
      onKeyDown={(event) => {
        // Esc fecha a lista e devolve o foco ao botão (sem fechar um modal pai).
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          triggerRef.current?.focus();
        }
      }}
    >
      {/* Mesmo estilo do LABEL_CLASS (jobsUi) usado pelo TextField e pelos
          demais campos, para os rótulos ficarem na mesma altura/peso. */}
      {label ? (
        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </span>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label || placeholder}
        onClick={toggle}
        disabled={disabled}
        className={`flex h-11 w-full items-center justify-between rounded-xl border bg-white ps-3.5 pe-3 text-sm shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-[border-color,box-shadow,background-color,transform] duration-200 ${EASE_OUT} active:scale-[0.985] active:duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 motion-reduce:active:scale-100 dark:bg-white/5 dark:shadow-none dark:focus-visible:ring-offset-[#0f1218] ${
          open
            ? "border-primary ring-2 ring-primary/20"
            : "border-slate-300 hover:border-slate-400 dark:border-white/10 dark:hover:border-white/20"
        }`}
      >
        <span
          className={`truncate ${
            isEmpty
              ? "text-a11y-slate-500"
              : "text-slate-900 dark:text-slate-200"
          }`}
        >
          {selectedLabel}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 transition-[transform,color] duration-[250ms] ${EASE_OUT} motion-reduce:transition-none ${
            open ? "rotate-180 text-primary" : "text-slate-400"
          }`}
        />
      </button>

      {mounted ? (
        <div
          className={`absolute top-[calc(100%+8px)] z-50 max-h-[min(15rem,50dvh)] w-full origin-top overflow-auto rounded-2xl border border-transparent bg-white/90 p-1.5 shadow-[0_0_0_1px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7),0_8px_16px_-8px_rgba(15,23,42,0.12),0_24px_48px_-16px_rgba(15,23,42,0.22)] backdrop-blur-xl backdrop-saturate-150 transition-[opacity,transform] ${EASE_OUT} will-change-transform dark:bg-[#171b22]/90 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.08),inset_0_1px_0_rgba(255,255,255,0.06),0_24px_48px_-16px_rgba(0,0,0,0.6)] [.high-contrast_&]:border-black [.high-contrast_&]:bg-white [.dark.high-contrast_&]:border-white [.dark.high-contrast_&]:bg-black [@media(prefers-reduced-transparency:reduce)]:bg-white [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none dark:[@media(prefers-reduced-transparency:reduce)]:bg-[#171b22] ${
            shown
              ? "translate-y-0 scale-100 opacity-100 duration-[180ms]"
              : "-translate-y-1 scale-[0.97] opacity-0 duration-[140ms] motion-reduce:translate-y-0 motion-reduce:scale-100"
          }`}
        >
          <ul className="relative flex flex-col gap-0.5">
            {/* Marcação única que desliza até a opção escolhida. */}
            {pill !== null ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute start-0 top-0 w-full rounded-xl bg-[#FDF2F4] will-change-transform dark:bg-[#2c1a21]"
                style={{
                  height: pill.height,
                  transform: `translateY(${pill.top}px)`,
                  transition: pillReady
                    ? "transform 300ms cubic-bezier(0.23, 1, 0.32, 1)"
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
                    className={`relative z-10 flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-start text-sm [@media(pointer:coarse)]:min-h-11 transition-[background-color,color,transform] duration-150 ${EASE_OUT} active:scale-[0.98] active:duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:active:scale-100 ${
                      isTarget
                        ? "font-semibold text-primary"
                        : "text-slate-700 dark:text-slate-300 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-slate-100 dark:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-white/5"
                    }`}
                  >
                    <span className="min-w-0 truncate">{option.label}</span>
                    {isTarget ? (
                      <Check
                        aria-hidden="true"
                        className="h-4 w-4 shrink-0 text-primary"
                      />
                    ) : null}
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