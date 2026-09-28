import { useId, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { RoleSelect } from "./RoleSelect";
import {
  PUBLIC_SIGNUP_ROLES,
  ROLE_LABELS,
  type PublicSignupRole,
} from "../../lib/roles";
import {
  CONSENT_TERM,
  CONSENT_TERM_VERSION,
  consentSummary,
} from "../../lib/consentTerm";

/**
 * Página de autenticação (issue [S1-1]): entrada única com abas Entrar/Criar
 * conta. O cadastro exige nome e papel (aluno, recrutador, gestor).
 * Identidade UNICAP: bordô primário, dourado no destaque (DESIGN.md).
 */
export function AuthPage() {
  const authActions = useAuthActions();
  const signIn = authActions?.signIn;
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<PublicSignupRole>("aluno");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const consentErrorId = useId();

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setError(null);
    setPending(true);
    if (signIn === undefined) {
      setError("Autenticação indisponível nesta tela.");
      setPending(false);
      return;
    }
    try {
      if (mode === "signUp") {
        // R7 (issue [S1-2]): a versão do termo aceito vai ao servidor,
        // que valida contra a versão vigente antes de criar a conta.
        await signIn("credentials-email", {
          email,
          password,
          name,
          role,
          flow: "signUp",
          consentTermVersion: CONSENT_TERM_VERSION,
        });
      } else {
        await signIn("credentials-email", { email, password, flow: "signIn" });
      }
      // Sucesso: o ConvexAuthProvider reage e a UI troca para o painel.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha na autenticação.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-10">
      <header className="mb-8 text-center">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Universidade Católica de Pernambuco
        </p>
        <h1 className="mt-2 font-serif text-3xl font-bold text-primary">
          Portal de Carreiras
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Acesso ao Portal de Carreiras e ao Setor de Extensão
        </p>
      </header>

      {/* [S8-2]: main único da página (o App não aninha outro) e destino
          do skip-link. */}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Autenticação"
        className="w-full max-w-md outline-none"
      >
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-level2">
          <div
            role="tablist"
            aria-label="Modo de autenticação"
            className="mb-6 grid grid-cols-2 gap-1 rounded border border-slate-200 bg-canvas p-1"
          >
            {(["signIn", "signUp"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                aria-controls="painel-auth"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`rounded px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  mode === m
                    ? "bg-primary text-white"
                    : "text-slate-600 hover:text-primary"
                }`}
              >
                {m === "signIn" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <form
            id="painel-auth"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmit(e);
            }}
            className="flex flex-col gap-4"
          >
            {/* [UX-P2] H9-2 — erro de autenticação é do FORMULÁRIO (credenciais
                inválidas, e-mail já cadastrado), não do campo senha: alerta
                no topo, sem vínculo aria ao campo. */}
            {error !== null ? (
              <p
                role="alert"
                className="rounded border border-danger bg-white px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            ) : null}
            {mode === "signUp" ? (
              <>
                <Input
                  label="Nome completo"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
                <RoleSelect
                  label="Perfil de acesso"
                  value={role}
                  onChange={setRole}
                  required
                />
                <ConsentCheckbox
                  checked={consentAccepted}
                  onChange={setConsentAccepted}
                  errorId={consentErrorId}
                />
              </>
            ) : null}

            <Input
              label="E-mail"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label="Senha"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "signUp" ? "new-password" : "current-password"
              }
            />

            <Button
              type="submit"
              variant="primary"
              disabled={pending || (mode === "signUp" && !consentAccepted)}
              aria-describedby={
                mode === "signUp" && !consentAccepted
                  ? consentErrorId
                  : undefined
              }
            >
              {pending
                ? "Processando…"
                : mode === "signIn"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-a11y-slate-500">
          {PUBLIC_SIGNUP_ROLES.map((r) => ROLE_LABELS[r]).join(" · ")}
        </p>
      </main>
    </div>
  );
}

type ConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  errorId: string;
};

/**
 * Checkbox obrigatória de aceite do termo LGPD (issue [S1-2], R7).
 * Bloqueia o submit até o aceite e dá acesso ao texto integral do termo
 * vigente em <details> acessível (sem dependências externas).
 */
function ConsentCheckbox({ checked, onChange, errorId }: ConsentCheckboxProps) {
  return (
    <div className="flex flex-col gap-2">
      <label className="flex cursor-pointer items-start gap-2 text-sm text-a11y-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required
          className="mt-0.5 accent-primary"
          aria-required="true"
        />
        <span>
          Li e aceito o Termo de Consentimento LGPD ({CONSENT_TERM_VERSION}) —{" "}
          <span className="text-a11y-slate-500">{consentSummary()}</span>
        </span>
      </label>
      <details className="rounded border border-slate-200 bg-canvas px-3 py-2">
        <summary className="cursor-pointer text-xs font-semibold text-primary">
          Ler o termo completo
        </summary>
        <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-600">
          {CONSENT_TERM}
        </pre>
      </details>
      {!checked ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs font-medium text-danger"
        >
          O aceite do termo é obrigatório para criar a conta.
        </p>
      ) : null}
    </div>
  );
}
