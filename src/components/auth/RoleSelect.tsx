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
 *
 * Visual alinhado ao AuthPage: radio nativo escondido (`peer sr-only`, como
 * no ConsentCheckbox) + marcador customizado, cantos `rounded-xl`, hover
 * só em dispositivos com mouse, `active:scale`, curva padrão do auth e
 * anel de foco com offset.
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
        {PUBLIC_SIGNUP_ROLES.map((role) => {
          const selected = value === role;
          return (
            <label key={role} className="group relative cursor-pointer">
              <input
                type="radio"
                name="role"
                value={role}
                checked={selected}
                onChange={() => onChange(role)}
                className="peer sr-only"
              />
              <span
                className={`flex h-11 items-center justify-center gap-2 rounded-xl border text-sm transition-[background-color,border-color,color,transform] !duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-active:scale-[0.97] motion-reduce:group-active:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                  selected
                    ? "border-primary bg-[#FDF2F4] font-semibold text-primary dark:bg-white/10"
                    : "border-slate-300 bg-white text-slate-700 [@media(hover:hover)_and_(pointer:fine)]:group-hover:border-primary"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition-colors duration-200 ${
                    selected ? "border-primary" : "border-slate-300"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full bg-primary transition-[transform,opacity] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-opacity ${
                      selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                    }`}
                  />
                </span>
                {ROLE_LABELS[role]}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}