import { useId, type ReactNode } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Texto de ajuda exibido sob o campo (não-substitutivo do label). */
  hint?: string;
  /** Slot opcional alinhado à direita do campo (ex.: olho da senha). */
  trailing?: ReactNode;
};

/**
 * Campo de formulário do Design System UNICAP (DESIGN.md):
 * label acima em label-md, foco com borda bordô e halo dourado,
 * asterisco vermelho para obrigatórios e erro acessível via aria.
 *
 * [UX_QUICK_WINS] `type="file"` deixa o botão nativo crú: as variantes
 * `file:*` do Tailwind vestem o "Escolher arquivo" (pílula bordô) sem
 * tocar nos outros campos. `trailing` abre um slot à direita para o
 * estado da senha (olho Mostrar/Ocultar).
 */
export function Input({
  label,
  error,
  hint,
  id,
  required,
  trailing,
  ...rest
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-semibold text-slate-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      <div className="relative">
        <input
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={
            [error ? errorId : null, hint ? hintId : null]
              .filter((x) => x !== null)
              .join(" ") || undefined
          }
          className={`rounded-md border bg-white px-3 py-2 text-slate-900 transition-all duration-200 ease-in-out placeholder:text-slate-400 hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary ${
            error ? "border-danger" : "border-slate-300"
          } ${trailing ? "pr-10" : ""}`}
          {...rest}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
