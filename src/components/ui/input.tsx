import { useId } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  /** Texto de ajuda exibido sob o campo (não-substitutivo do label). */
  hint?: string;
};

/**
 * Campo de formulário do Design System UNICAP (DESIGN.md):
 * label acima em label-md, foco com borda bordô e halo dourado,
 * asterisco vermelho para obrigatórios e erro acessível via aria.
 */
export function Input({
  label,
  error,
  hint,
  id,
  required,
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
      <input
        id={inputId}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [error ? errorId : null, hint ? hintId : null]
            .filter((x) => x !== null)
            .join(" ") || undefined
        }
        className={`rounded border bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 ${
          error ? "border-danger" : "border-slate-300"
        }`}
        {...rest}
      />
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
