import { useId, useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { navigateTo } from "../../lib/router";
import { PASSWORD_RESET_PATH } from "../../lib/passwordReset";
import { passwordRules, PASSWORD_MAX_LENGTH } from "../../lib/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Eye, EyeOff, KeyRound, LogIn } from "lucide-react";
import { RoleSelect } from "./RoleSelect";
import { type PublicSignupRole } from "../../lib/roles";
import {
  validateRecruiterLinkedin,
  validateRecruiterWebsite,
} from "../../lib/recruiterSignup";
import { CONSENT_TERM, CONSENT_TERM_VERSION } from "../../lib/consentTerm";

/**
 * Página de autenticação (issue [S1-1]): entrada única com abas Entrar/Criar
 * conta. O cadastro exige nome e papel (aluno, recrutador, gestor).
 * Identidade UNICAP: bordô primário, dourado no destaque (DESIGN.md).
 *
 * [UX_REFINEMENT Etapa 1] — erros de autenticação saem das caixas cruas
 * (`[CONVEX A(auth:signIn)]…`) e viram Toast global com mensagem
 * amigável (H9-2: o campo senha nunca carrega o erro).
 */
export function AuthPage() {
  const authActions = useAuthActions();
  const signIn = authActions?.signIn;
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<PublicSignupRole>("aluno");
  const [pending, setPending] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const isRecruiterSignUp = mode === "signUp" && role === "recrutador";
  const linkedinCheck = validateRecruiterLinkedin(linkedinUrl);
  const linkedinOk = !isRecruiterSignUp || linkedinCheck.ok;
  const [website, setWebsite] = useState("");
  const websiteCheck = validateRecruiterWebsite(website);
  const websiteOk = !isRecruiterSignUp || websiteCheck.ok;
  /** [UX_QUICK_WIN] — olhinho alterna password/texto no campo senha. */
  const [showPassword, setShowPassword] = useState(false);
  const consentErrorId = useId();

  // Requisitos de senha (mesma regra do servidor, em src/lib/auth.ts).
  const rules = passwordRules(password, { email, name });
  const passwordOk = rules.every((rule) => rule.ok);
  // A lista só aparece no cadastro e depois que a pessoa começa a digitar.
  const showPasswordRules = mode === "signUp" && password.length > 0;

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (mode === "signUp" && !passwordOk) {
      toast.error("A senha não atende a todos os requisitos.");
      return;
    }
    if (isRecruiterSignUp && !linkedinCheck.ok) {
      toast.error(linkedinCheck.error);
      return;
    }
    if (isRecruiterSignUp && !websiteCheck.ok) {
      toast.error(websiteCheck.error);
      return;
    }
    setPending(true);
    if (signIn === undefined) {
      toast.error("Autenticação indisponível nesta tela.");
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
          ...(isRecruiterSignUp && linkedinCheck.ok
            ? {
                linkedinUrl: linkedinCheck.normalized,
                ...(websiteCheck.ok && websiteCheck.normalized !== undefined
                  ? { website: websiteCheck.normalized }
                  : {}),
              }
            : {}),
        });
      } else {
        await signIn("credentials-email", { email, password, flow: "signIn" });
      }
      // Sucesso: o ConvexAuthProvider reage e a UI troca para o painel.
      toast.success(
        mode === "signUp"
          ? isRecruiterSignUp
            ? "Conta criada! Seu cadastro será analisado pela coordenação."
            : "Conta criada com sucesso. Bem-vindo(a)!"
          : "Bem-vindo(a) de volta!",
      );
    } catch (err) {
      // [UX_REFINEMENT] Toast amigável — nunca a mensagem crua do servidor.
      toast.error(friendlyErrorMessage(err));
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
          Banco de Currículos
        </h1>
      </header>

      {/* [S8-2]: main único da página (o App não aninha outro) e destino do skip-link. */}
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
            className="relative mb-6 grid grid-cols-2 rounded border border-slate-200 bg-canvas p-1"
          >
            {/* Indicador que desliza entre as abas */}
            <span
              aria-hidden="true"
              className={`absolute left-1 top-1 h-[calc(100%-0.5rem)] w-[calc(50%-0.25rem)] rounded bg-primary shadow-level1 transition-transform duration-300 ease-out ${
                mode === "signUp" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            {(["signIn", "signUp"] as const).map((m) => (
              <button
                key={m}
                role="tab"
                type="button"
                aria-selected={mode === m}
                aria-controls="painel-auth"
                onClick={() => setMode(m)}
                className={`relative z-10 rounded px-3 py-2 text-sm font-semibold transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  mode === m
                    ? "text-white"
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
            className="flex flex-col"
          >
            <Collapse open={mode === "signUp"}>
              <div className="flex flex-col gap-4 pb-4">
                <Input
                  label="Nome completo"
                  required={mode === "signUp"}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  tabIndex={mode === "signUp" ? 0 : -1}
                />
                <RoleSelect
                  label="Perfil de acesso"
                  value={role}
                  onChange={setRole}
                  required={mode === "signUp"}
                />
                {role === "recrutador" ? (
                  <>
                    <Input
                      label="LinkedIn"
                      type="url"
                      required={isRecruiterSignUp}
                      value={linkedinUrl}
                      onChange={(e) => setLinkedinUrl(e.target.value)}
                      placeholder="https://www.linkedin.com/in/seu-perfil"
                      autoComplete="url"
                      tabIndex={isRecruiterSignUp ? 0 : -1}
                    />
                    <div className="flex flex-col gap-1">
                      <Input
                        label="Site (opcional)"
                        type="text"
                        inputMode="url"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://suaempresa.com.br"
                        autoComplete="off"
                        tabIndex={isRecruiterSignUp ? 0 : -1}
                      />
                      {website.trim().length > 0 && !websiteCheck.ok ? (
                        <p role="alert" className="text-xs text-red-700">
                          {websiteCheck.error}
                        </p>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
            </Collapse>

            <div className="flex flex-col gap-4 pb-4">
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
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                maxLength={PASSWORD_MAX_LENGTH}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signUp" ? "new-password" : "current-password"
                }
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="rounded p-1 text-slate-400 transition-colors hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="sr-only">
                      {showPassword ? "Ocultar senha" : "Mostrar senha"}
                    </span>
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                }
              />
              {showPasswordRules ? (
                <ul
                  aria-label="Requisitos da senha"
                  aria-live="polite"
                  className="-mt-2 flex flex-col gap-1 text-xs"
                >
                  {rules.map((rule) => (
                    <li
                      key={rule.id}
                      className={
                        rule.ok
                          ? "font-medium text-success"
                          : "text-a11y-slate-500"
                      }
                    >
                      <span aria-hidden="true">{rule.ok ? "✓" : "○"}</span>{" "}
                      {rule.label}
                      <span className="sr-only">
                        {rule.ok ? " (atendido)" : " (pendente)"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <Collapse open={mode === "signUp"}>
              <div className="pb-4">
                <ConsentCheckbox
                  checked={consentAccepted}
                  onChange={setConsentAccepted}
                  errorId={consentErrorId}
                  enabled={mode === "signUp"}
                />
              </div>
            </Collapse>

            <Button
              type="submit"
              variant="primary"
              disabled={
                pending ||
                (mode === "signUp" &&
                  (!consentAccepted ||
                    !passwordOk ||
                    !linkedinOk ||
                    !websiteOk))
              }
              aria-describedby={
                mode === "signUp" && !consentAccepted
                  ? consentErrorId
                  : undefined
              }
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              {pending
                ? "Processando…"
                : mode === "signIn"
                  ? "Entrar"
                  : "Criar conta"}
            </Button>

            <Collapse open={mode === "signIn"}>
              <p className="pt-4 text-center text-sm">
                <button
                  type="button"
                  onClick={() => navigateTo(PASSWORD_RESET_PATH)}
                  className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Esqueci minha senha
                </button>
              </p>
            </Collapse>
          </form>
        </div>
      </main>
    </div>
  );
}

/** Expande/recolhe com animação de altura + fade, sem desmontar o conteúdo. */
function Collapse({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!open}
      className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-in-out ${
        open
          ? "visible grid-rows-[1fr] opacity-100"
          : "invisible grid-rows-[0fr] opacity-0"
      }`}
    >
      <div className="-mx-1 overflow-hidden px-1">{children}</div>
    </div>
  );
}

type ConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  errorId: string;
  enabled: boolean;
};

/**
 * Checkbox obrigatória de aceite do termo LGPD simplificada e mais compacta.
 * Bloqueia o submit até o aceite e dá acesso ao texto integral do termo
 * vigente em <details> acessível (sem dependências externas).
 */
function ConsentCheckbox({
  checked,
  onChange,
  errorId,
  enabled,
}: ConsentCheckboxProps) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 mt-1">
      <label className="flex cursor-pointer items-center gap-2 text-sm text-a11y-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={enabled}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-primary"
          aria-required={enabled}
          tabIndex={enabled ? 0 : -1}
        />
        <span id={errorId} className="font-medium text-slate-800">
          Li e aceito os termos de LGPD ({CONSENT_TERM_VERSION})
        </span>
      </label>
      <details className="group ml-6">
        <summary className="cursor-pointer text-xs font-semibold text-primary hover:underline outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 rounded-sm w-fit">
          Ler o termo completo
        </summary>
        <pre className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded border border-slate-200 bg-white p-3 font-sans text-xs leading-relaxed text-slate-600 shadow-inner">
          {CONSENT_TERM}
        </pre>
      </details>
    </div>
  );
}
