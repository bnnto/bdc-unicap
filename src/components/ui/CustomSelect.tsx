import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export function CustomSelect({
  label,
  value,
  onChange,
  placeholder,
  options,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? placeholder;

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={ref}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-300 bg-white pl-3.5 pr-3 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:focus:ring-offset-[#0f1218]"
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
          <ul className="flex flex-col gap-0.5">
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        /* Removemos o dark:text-white para que o text-primary brilhe em ambos os temas! */
                        ? "bg-[#FDF2F4] font-semibold text-primary dark:bg-white/5"
                        : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                    }`}
                  >
                    {option.label}
                    {isSelected ? <Check className="h-4 w-4 text-primary" /> : null}
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