import { useId } from "react";
import { ROLES, ROLE_LABELS, type Role } from "../../lib/roles";

type RoleSelectProps = {
  label: string;
  value: Role;
  onChange: (role: Role) => void;
  required?: boolean;
};

/**
 * Seleção de papel (issue [S1-1]) — radio group acessível com os papéis
 * do sistema. [REFACTOR_UI] O papel "empresa" foi descontinuado: restam
 * aluno, recrutador e gestor. Navegação por teclado nativa (setas) e
 * label por opção.
 */
export function RoleSelect({
  label,
  value,
  onChange,
  required,
}: RoleSelectProps) {
  const groupId = useId();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-semibold text-slate-700">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </legend>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={label}
        id={groupId}
      >
        {ROLES.map((role) => (
          <label
            key={role}
            className={`flex cursor-pointer items-center justify-center gap-2 rounded border px-3 py-2 text-sm transition-colors ${
              value === role
                ? "border-primary bg-[#FDF2F4] font-semibold text-primary"
                : "border-slate-300 bg-white text-slate-700 hover:border-primary"
            }`}
          >
            <input
              type="radio"
              name="role"
              value={role}
              checked={value === role}
              onChange={() => onChange(role)}
              className="accent-primary"
            />
            {ROLE_LABELS[role]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
