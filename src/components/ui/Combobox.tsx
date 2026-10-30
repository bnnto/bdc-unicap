import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { dictionaryKey } from "../../lib/skills";

/**
 * [DICIONARIO_FECHADO] Combobox pesquisável de dicionário (UX TAREFA 1/2).
 *
 * O select nativo e o datalist ficam péssimos com listas grandes:
 * aqui o utilizador DIGITA num `<input type="text">` (role
 * `combobox`), a lista suspensa filtra em tempo real e o termo só entra
 * no formulário quando ele CLIQUE numa opção (ou confirma com Enter sobre
 * uma opção destacada). Texto que não corresponde a nenhum termo oficial
 * mostra "Nenhum resultado" e NUNCA é confirmado — o chamador recebe "",
 * o que mantém o botão de adicionar desabilitado.
 *
 * A filtragem usa a MESMA normalização do backend (`dictionaryKey`):
 * "psiocologia" encontra "Psicologia Clínica", "next js" encontra
 * "Next.js" — mas a forma gravada é sempre a oficial do dicionário.
 */

/** Área agrupada de opções (mesmo formato de `SKILLS_GROUPS`). */
export type ComboboxGroup = {
  readonly label: string;
  readonly items: readonly string[];
};

type ComboboxProps = {
  /** Nome acessível do campo (aria-label — o `<input>` é role=combobox). */
  ariaLabel: string;
  /** Opções oficiais agrupadas (dicionário de competências, idiomas…). */
  groups: readonly ComboboxGroup[];
  /** Termo canônico confirmado (controlado pelo formulário pai). */
  value: string;
  /** Recebe o termo escolhido; `""` sempre que o texto digitado não existe. */
  onSelect: (term: string) => void;
  id?: string;
  placeholder?: string;
  describedBy?: string;
  disabled?: boolean;
  required?: boolean;
  /** Mensagem do estado vazio (default: "Nenhum resultado"). */
  emptyText?: string;
  /** Abre a lista ao focar/clicar (default). Com `false`, só abre ao digitar. */
  openOnFocus?: boolean;
  autoConfirmExact?: boolean;
};

/**
 * Mesmo visual do dropdown padronizado (Regra de Ouro 1): seta SVG à
 * direita, altura h-10, cantos rounded-xl.
 */
const COMBOBOX_INPUT_CLASS =
  "dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-white/20 dark:focus:ring-offset-[#0f1218] w-full appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20fill=%22none%22%20viewBox=%220%200%2024%2024%22%20stroke-width=%222%22%20stroke=%22%2394a3b8%22%3E%3Cpath%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22%20d=%22M19%209l-7%207-7-7%22/%3E%3C/svg%3E')] bg-no-repeat bg-[position:right_0.75rem_center] bg-[size:1rem_1rem] h-11 rounded-xl border border-slate-300 bg-white px-3.5 pr-10 text-sm text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

export function Combobox({
  ariaLabel,
  groups,
  value,
  onSelect,
  id,
  placeholder,
  describedBy,
  disabled = false,
  required = false,
  emptyText = "Nenhum resultado",
  openOnFocus = true,
  autoConfirmExact = true,
}: ComboboxProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  /** Último valor EMITIDO — distingue mudanças externas de digitação. */
  const lastEmitted = useRef(value);

  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  // O pai pode limpar o valor por fora (reset, chip já adicionado…) —
  // só nesse caso o texto do input é reescrito; digitação nunca é
  // sobrescrita.
  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setQuery(value);
    }
  }, [value]);

  const allItems = useMemo(
    () => groups.flatMap((group) => group.items),
    [groups],
  );

  // Filtro em tempo real com a normalização canônica do dicionário.
  const fold = dictionaryKey(query);
  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        label: group.label,
        items: group.items.filter(
          (item) => fold.length === 0 || dictionaryKey(item).includes(fold),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, fold]);

  const visibleItems = useMemo(
    () => visibleGroups.flatMap((group) => group.items),
    [visibleGroups],
  );

  const trimmedActive =
    visibleItems.length === 0
      ? -1
      : Math.min(Math.max(active, 0), visibleItems.length - 1);

  function emit(term: string) {
    if (term === lastEmitted.current) return;
    lastEmitted.current = term;
    onSelect(term);
  }

  function pick(term: string) {
    setQuery(term);
    setOpen(false);
    setActive(0);
    emit(term);
  }

  function handleChange(text: string) {
    setQuery(text);
    setOpen(true);
    setActive(0);
        // Modo "só ao escolher": digitar nunca emite nada.
    if (!autoConfirmExact) return;

    // Confirma automático SOMENTE com correspondência exata de um termo
    // oficial; qualquer outro texto invalida o rascunho do formulário.
    const key = dictionaryKey(text);
    if (key.length === 0) {
      emit("");
      return;
    }
    const exact = allItems.find((item) => dictionaryKey(item) === key);
    emit(exact ?? "");
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        setActive(0);
        return;
      }
      setActive((current) =>
        visibleItems.length === 0 ? 0 : (current + 1) % visibleItems.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      if (!open || visibleItems.length === 0) return;
      event.preventDefault();
      setActive(
        (current) => (current - 1 + visibleItems.length) % visibleItems.length,
      );
      return;
    }
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "Enter") {
      // Com a lista aberta, Enter só escolhe uma opção da lista — nunca
      // submete o formulário com texto não confirmado.
      if (!open) return;
      event.preventDefault();
      const term = visibleItems[trimmedActive];
      if (term !== undefined) pick(term);
    }
  }

  // Com `openOnFocus={false}`, a lista só aparece enquanto há texto digitado.
  const listVisible = open && !disabled && (openOnFocus || fold.length > 0);

  const activeId =
    listVisible && trimmedActive >= 0
      ? `${listId}-option-${trimmedActive}`
      : undefined;

  return (
    <div ref={rootRef} className="relative w-full">
      <input
        type="text"
        role="combobox"
        id={id}
        aria-label={ariaLabel}
        aria-expanded={listVisible}
        aria-controls={listId}
        aria-activedescendant={activeId}
        aria-autocomplete="list"
        aria-describedby={describedBy}
        required={required}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        placeholder={placeholder}
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        onFocus={() => !disabled && openOnFocus && setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={(event) => {
          if (!rootRef.current?.contains(event.relatedTarget)) {
            setOpen(false);
            // Texto que não é um termo oficial não fica na tela parecendo escolhido.
            setQuery(lastEmitted.current);
          }
        }}
        className={COMBOBOX_INPUT_CLASS}
      />
      {listVisible ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute inset-x-0 top-[calc(100%+8px)] z-50 max-h-60 overflow-auto rounded-2xl border border-transparent bg-white p-1.5 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.15),0_0_0_1px_rgba(15,23,42,0.06)] dark:bg-[#171b22] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
        >
          {visibleItems.length === 0 ? (
            <li
              role="presentation"
              className="px-3.5 py-2 text-sm text-slate-500"
            >
              {emptyText}
            </li>
          ) : (
            visibleGroups.flatMap((group, groupIndex) => [
              <li
                key={`group-${group.label}`}
                role="presentation"
                className="px-3.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              >
                {group.label}
              </li>,
              ...group.items.map((item, itemIndex) => {
                const flatIndex =
                  visibleGroups
                    .slice(0, groupIndex)
                    .reduce((total, previous) => {
                      return total + previous.items.length;
                    }, 0) + itemIndex;
                return (
                  <li
                    key={item}
                    id={`${listId}-option-${flatIndex}`}
                    role="option"
                    aria-selected={dictionaryKey(item) === dictionaryKey(value)}
                    // mousedown antes do blur do input: o clique chega à opção.
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pick(item)}
                    onMouseEnter={() => setActive(flatIndex)}
                    className={`cursor-pointer select-none rounded-xl px-3 py-2 text-sm ${
                      flatIndex === trimmedActive
                        ? "bg-[#FDF2F4] text-primary dark:bg-white/5"
                        : "text-slate-900 dark:text-slate-200"
                    }`}
                  >
                    {item}
                  </li>
                );
              }),
            ])
          )}
        </ul>
      ) : null}
    </div>
  );
}