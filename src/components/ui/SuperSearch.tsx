import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { Search, X, type LucideIcon } from "lucide-react";

/**
 * SuperSearch — caixa de busca única com atalhos por categoria.
 *
 * O texto digitado continua sendo a busca livre (o pai debounça e envia
 * ao servidor). Em paralelo, o componente sugere "atalhos": competências,
 * cursos, idiomas, disponibilidade, formação… Escolher um atalho chama
 * `onPick` (o pai aplica o filtro) e limpa o texto. `actions` são ações
 * sobre o texto digitado (ex.: "Filtrar por cidade: …").
 *
 * Teclado: ↓/↑ navegam, Enter confirma o item destacado (sem item
 * destacado, Enter não faz nada — a busca livre já está valendo), Esc
 * fecha e, se já estiver fechado, apaga o texto. Sem animação na lista:
 * ela abre ao digitar (ação de teclado, repetida o dia todo).
 */

export type SuperSearchSource = {
  id: string;
  /** Título da seção, ex.: "Competências". */
  label: string;
  icon: LucideIcon;
  items: readonly { value: string; label: string }[];
  /** Máximo de sugestões da seção (padrão 5). */
  limit?: number;
};

export type SuperSearchAction = {
  id: string;
  icon: LucideIcon;
  label: (query: string) => string;
  run: (query: string) => void;
};

type SuperSearchProps = {
  id?: string;
  ariaLabel: string;
  placeholder?: string;
  value: string;
  onChange: (text: string) => void;
  sources: readonly SuperSearchSource[];
  actions?: readonly SuperSearchAction[];
  onPick: (sourceId: string, value: string) => void;
  inputRef?: { current: HTMLInputElement | null };
};

type Row =
  | {
      type: "item";
      index: number;
      key: string;
      sourceId: string;
      value: string;
      label: string;
      icon: LucideIcon;
    }
  | {
      type: "action";
      index: number;
      key: string;
      actionId: string;
      label: string;
      icon: LucideIcon;
    };

type Section = { key: string; label: string; rows: Row[] };

/** Minúsculo e sem acentos (mesma regra do servidor). */
function fold(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Destaca o trecho que casou com a busca (ignora acentos). */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query).trim();
  const folded = fold(text);
  const at = q.length > 0 ? folded.indexOf(q) : -1;
  if (at < 0 || folded.length !== text.length) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <mark className="bg-transparent font-semibold text-primary">
        {text.slice(at, at + q.length)}
      </mark>
      {text.slice(at + q.length)}
    </>
  );
}

export function SuperSearch({
  id,
  ariaLabel,
  placeholder,
  value,
  onChange,
  sources,
  actions = [],
  onPick,
  inputRef,
}: SuperSearchProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? innerRef;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const sections = useMemo<Section[]>(() => {
    const q = fold(value).trim();
    if (q.length === 0) return [];
    let index = 0;
    const out: Section[] = [];
    for (const source of sources) {
      const matches = source.items
        .map((item) => ({ item, folded: fold(item.label) }))
        .filter(({ folded }) => folded.includes(q))
        // Quem começa com o termo vem primeiro.
        .sort(
          (a, b) =>
            Number(b.folded.startsWith(q)) - Number(a.folded.startsWith(q)),
        )
        .slice(0, source.limit ?? 5);
      if (matches.length === 0) continue;
      out.push({
        key: source.id,
        label: source.label,
        rows: matches.map(({ item }) => ({
          type: "item" as const,
          index: index++,
          key: `${source.id}:${item.value}`,
          sourceId: source.id,
          value: item.value,
          label: item.label,
          icon: source.icon,
        })),
      });
    }
    if (actions.length > 0) {
      out.push({
        key: "actions",
        label: "Ações",
        rows: actions.map((action) => ({
          type: "action" as const,
          index: index++,
          key: `action:${action.id}`,
          actionId: action.id,
          label: action.label(value.trim()),
          icon: action.icon,
        })),
      });
    }
    return out;
  }, [value, sources, actions]);

  const flat = useMemo(() => sections.flatMap((s) => s.rows), [sections]);
  const listVisible = open && flat.length > 0;
  const optionId = (index: number) => `${listId}-option-${index}`;

  // Mantém o item destacado pelo teclado visível na lista.
  useEffect(() => {
    if (!listVisible || active < 0) return;
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, listVisible]);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  function run(row: Row) {
    if (row.type === "item") {
      onPick(row.sourceId, row.value);
    } else {
      actions.find((a) => a.id === row.actionId)?.run(value.trim());
    }
    onChange("");
    close();
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      if (flat.length === 0) return;
      event.preventDefault();
      if (!listVisible) {
        setOpen(true);
        return;
      }
      setActive((current) => (current + 1) % flat.length);
      return;
    }
    if (event.key === "ArrowUp") {
      if (!listVisible) return;
      event.preventDefault();
      setActive((current) => (current <= 0 ? flat.length - 1 : current - 1));
      return;
    }
    if (event.key === "Enter") {
      const row = flat[active];
      if (listVisible && row !== undefined) {
        event.preventDefault();
        run(row);
      }
      return;
    }
    if (event.key === "Escape") {
      if (listVisible) {
        event.preventDefault();
        close();
      } else if (value.length > 0) {
        event.preventDefault();
        onChange("");
      }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        ref={ref}
        id={id}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={listVisible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          listVisible && active >= 0 ? optionId(active) : undefined
        }
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) close();
        }}
        className="h-12 w-full rounded-2xl border border-slate-300 bg-slate-50/70 pl-12 pr-12 text-[0.9375rem] text-slate-900 transition-colors duration-150 placeholder:text-a11y-slate-500 hover:border-slate-400 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:focus:bg-white/5 dark:focus:ring-offset-[#0f1218]"
      />
      {value.length > 0 ? (
        <button
          type="button"
          aria-label="Apagar texto da busca"
          onClick={() => {
            onChange("");
            close();
            ref.current?.focus();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}

      {listVisible ? (
        <div className="absolute inset-x-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_4px_20px_-4px_rgba(15,23,42,0.15),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-[#171b22] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]">
          <ul
            id={listId}
            role="listbox"
            aria-label={ariaLabel}
            className="max-h-80 overflow-auto p-1.5"
          >
            {sections.map((section) => (
              <li key={section.key} role="presentation">
                <p className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  {section.label}
                </p>
                <ul role="presentation" className="flex flex-col gap-0.5">
                  {section.rows.map((row) => {
                    const Icon = row.icon;
                    const isActive = row.index === active;
                    return (
                      <li
                        key={row.key}
                        id={optionId(row.index)}
                        role="option"
                        aria-selected={isActive}
                        // mousedown antes do blur: o clique chega à opção.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => run(row)}
                        onMouseMove={() => setActive(row.index)}
                        className={`flex cursor-pointer select-none items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-100 ${
                          isActive
                            ? "bg-[#FDF2F4] text-slate-900 dark:bg-white/5 dark:text-slate-100"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                            isActive
                              ? "bg-white text-primary dark:bg-white/10"
                              : "bg-slate-100 text-slate-500 dark:bg-white/5"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1 truncate">
                          {row.type === "item" ? (
                            <Highlight text={row.label} query={value} />
                          ) : (
                            row.label
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
          <div
            aria-hidden="true"
            className="hidden items-center gap-4 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 md:flex dark:border-white/10"
          >
            <span>↑↓ navegar</span>
            <span>Enter selecionar</span>
            <span>Esc fechar</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}