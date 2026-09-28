import { useId } from "react";
import {
  PUBLIC_SIGNUP_ROLES,
  ROLE_LABELS,
  type PublicSignupRole,
} from "../../lib/roles";

type RoleSelectProps = {
  label: string;
  value: PublicSignupRole;
  onChange: (role: PublicSignupRole) => void;
  required?: boolean;
};

/**
 * Seleção de papel no cadastro (issue [S1-1]) — radio group acessível.
 * [REFACTOR_GESTOR] Etapa 3: o público escolhe apenas aluno ou recrutador;
 * a opção "Gestor" NÃO aparece (contas de gestor são provisionadas
 * manualmente pela coordenação via Convex Dashboard). Navegação por
 * teclado nativa (setas) e label por opção.
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
        className="grid grid-cols-2 gap-2"
        role="radiogroup"
        aria-label={label}
        id={groupId}
      >
        {PUBLIC_SIGNUP_ROLES.map((role) => (
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
