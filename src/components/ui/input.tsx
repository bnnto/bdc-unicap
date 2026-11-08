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
 * label acima em label-md, foco com borda bordô e anel com offset (mesmo
 * padrão dos demais controles do auth), asterisco vermelho para
 * obrigatórios e erro acessível via aria.
 *
 * [UX_QUICK_WINS] `type="file"` deixa o botão nativo crú: as variantes
 * `file:*` do Tailwind vestem o "Escolher arquivo" com um botão premium
 * e agora com contraste correto também no dark mode.
 * `trailing` abre um slot à direita para o estado da senha (olho Mostrar/Ocultar).
 *
 * `className` é MESCLADO às classes do campo (antes, ao passar `className`,
 * o `{...rest}` substituía todas elas). No estado de erro a borda vermelha
 * é mantida também em foco e em hover.
 */
export function Input({
  label,
  error,
  hint,
  id,
  required,
  trailing,
  className = "",
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
          {...rest}
          className={`w-full rounded-md border bg-white px-3 py-2 text-slate-900 transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] placeholder:text-a11y-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 file:mr-4 file:cursor-pointer file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:shadow-sm file:transition-colors [@media(hover:hover)_and_(pointer:fine)]:hover:file:bg-[#520F1D] ${
            error
              ? "border-danger focus:border-danger focus:ring-danger"
              : "border-slate-300 focus:border-primary focus:ring-primary [@media(hover:hover)_and_(pointer:fine)]:hover:border-slate-400"
          } ${trailing ? "pr-10" : ""} ${className}`}
        />
        {trailing ? (
          <span className="absolute inset-y-0 right-1 flex items-center">
            {trailing}
          </span>
        ) : null}
      </div>
      {hint ? (
        <p id={hintId} className="mt-1 text-xs text-a11y-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs font-medium text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}