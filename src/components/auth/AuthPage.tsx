import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { navigateTo } from "../../lib/router";
import { PASSWORD_RESET_PATH } from "../../lib/passwordReset";
import { passwordRules, PASSWORD_MAX_LENGTH } from "../../lib/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChevronRight, KeyRound, Loader2, LogIn, UserPlus } from "lucide-react";
import { RoleSelect } from "./RoleSelect";
import { type PublicSignupRole } from "../../lib/roles";
import {
  validateRecruiterLinkedin,
  validateRecruiterWebsite,
} from "../../lib/recruiterSignup";
import { CONSENT_TERM, CONSENT_TERM_VERSION } from "../../lib/consentTerm";
import {
  AuthCard,
  AuthShell,
  Collapse,
  PasswordMeter,
  PasswordToggle,
  joinPt,
  useShake,
} from "./authUi";

/**
 * Página de autenticação (issue [S1-1]): entrada única com abas Entrar/Criar
 * conta. O cadastro exige nome e papel (aluno, recrutador, gestor).
 * Identidade UNICAP: bordô primário, dourado no destaque (DESIGN.md).
 *
 * [UX_REFINEMENT Etapa 1] — erros de autenticação saem das caixas cruas
 * (`[CONVEX A(auth:signIn)]…`) e viram Toast global com mensagem
 * amigável (H9-2: o campo senha nunca carrega o erro).
 *
 * Redesign: layout em duas colunas (AuthShell), entrada em cascata, troca de
 * modo com crossfade, medidor de senha, dica do que falta para criar a conta
 * e tremida curta quando o envio falha.
 */

const MODES = ["signIn", "signUp"] as const;
type Mode = (typeof MODES)[number];
const MODE_LABEL: Record<Mode, string> = {
  signIn: "Entrar",
  signUp: "Criar conta",
};

export function AuthPage() {
  const authActions = useAuthActions();
  const signIn = authActions?.signIn;
  const [mode, setMode] = useState<Mode>("signIn");
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
  const hintId = useId();
  const shake = useShake();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const lastHint = useRef("");

  // Requisitos de senha (mesma regra do servidor, em src/lib/auth.ts).
  const rules = passwordRules(password, { email, name });
  const passwordOk = rules.every((rule) => rule.ok);
  // O medidor só aparece no cadastro e depois que a pessoa começa a digitar.
  const showPasswordRules = mode === "signUp" && password.length > 0;

  // O que ainda impede o botão "Criar conta" (dica sob o botão).
  const missing: string[] = [];
  if (mode === "signUp") {
    if (!passwordOk) missing.push("atender aos requisitos da senha");
    if (isRecruiterSignUp && !linkedinCheck.ok)
      missing.push("informar um LinkedIn válido");
    if (isRecruiterSignUp && !websiteCheck.ok) missing.push("corrigir o site");
    if (!consentAccepted) missing.push("aceitar o termo de LGPD");
  }
  const touched = email.length > 0 || name.length > 0 || password.length > 0;
  const showMissing = mode === "signUp" && touched && missing.length > 0;
  if (showMissing) lastHint.current = `Para continuar, falta ${joinPt(missing)}.`;

  function onTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "ArrowLeft" || event.key === "Home" ? 0 : 1;
    setMode(MODES[next]);
    tabRefs.current[next]?.focus();
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (mode === "signUp" && !passwordOk) {
      toast.error("A senha não atende a todos os requisitos.");
      shake.trigger();
      return;
    }
    if (isRecruiterSignUp && !linkedinCheck.ok) {
      toast.error(linkedinCheck.error);
      shake.trigger();
      return;
    }
    if (isRecruiterSignUp && !websiteCheck.ok) {
      toast.error(websiteCheck.error);
      shake.trigger();
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
      shake.trigger();
    } finally {
      setPending(false);
    }
  }

  return (
    // [S8-2]: o AuthShell renderiza o main único (#conteudo, destino do skip-link).
    <AuthShell ariaLabel="Autenticação">
      <AuthCard>
        <div className={shake.className} onAnimationEnd={shake.onAnimationEnd}>
          {/* Abas Entrar / Criar conta — indicador desliza (só transform). */}
          <div
            role="tablist"
            aria-label="Modo de autenticação"
            onKeyDown={onTabKeyDown}
            className="rise relative mb-7 grid grid-cols-2 rounded-full bg-slate-100 p-1 [animation-delay:120ms]"
          >
            <span
              aria-hidden="true"
              className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-primary shadow-level1 transition-transform duration-[280ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none ${
                mode === "signUp" ? "translate-x-full" : "translate-x-0"
              }`}
            />
            {MODES.map((m, index) => (
              <button
                key={m}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                role="tab"
                type="button"
                aria-selected={mode === m}
                aria-controls="painel-auth"
                tabIndex={mode === m ? 0 : -1}
                onClick={() => setMode(m)}
                className={`relative z-10 h-10 rounded-full px-3 text-sm font-semibold transition-[transform,color] !duration-200 ease-out active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  mode === m
                    ? "text-white"
                    : "text-slate-600 [@media(hover:hover)_and_(pointer:fine)]:hover:text-primary"
                }`}
              >
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>

          {/* Título e subtítulo trocam com crossfade a cada modo. */}
          <div key={mode} className="auth-swap mb-6">
            <h1 className="font-serif text-3xl font-bold leading-tight tracking-[-0.02em] text-primary">
              {mode === "signIn" ? "Bem-vindo(a) de volta" : "Crie sua conta"}
            </h1>
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
                  <div className="auth-swap flex flex-col gap-4">
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
                        <p
                          role="alert"
                          className="auth-swap text-xs font-medium text-danger"
                        >
                          {websiteCheck.error}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            </Collapse>

            <div className="rise flex flex-col gap-4 pb-4 [animation-delay:260ms]">
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
                  <PasswordToggle
                    visible={showPassword}
                    onToggle={setShowPassword}
                  />
                }
              />
              <PasswordMeter rules={rules} show={showPasswordRules} />
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

            <div className="rise flex flex-col [animation-delay:340ms]">
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
                    : showMissing
                      ? hintId
                      : undefined
                }
              >
                {pending ? (
                  <Loader2
                    className="h-4 w-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                ) : mode === "signIn" ? (
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <UserPlus className="h-4 w-4" aria-hidden="true" />
                )}
                {pending ? "Processando…" : MODE_LABEL[mode]}
              </Button>
            </div>

            {/* O que falta para liberar o botão de cadastro. */}
            <Collapse open={showMissing}>
              <p
                id={hintId}
                aria-live="polite"
                className="pt-3 text-center text-xs leading-relaxed text-a11y-slate-500"
              >
                {lastHint.current}
              </p>
            </Collapse>

            <Collapse open={mode === "signIn"}>
              <p className="pt-5 text-center text-sm">
                <button
                  type="button"
                  onClick={() => navigateTo(PASSWORD_RESET_PATH)}
                  className="group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold text-primary transition-[background-color,transform] !duration-150 active:scale-[0.97] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#FDF2F4] [@media(hover:hover)_and_(pointer:fine)]:dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  tabIndex={mode === "signIn" ? 0 : -1}
                >
                  <KeyRound className="h-4 w-4" aria-hidden="true" />
                  Esqueci minha senha 
                </button>
              </p>
            </Collapse>
          </form>
        </div>
      </AuthCard>
    </AuthShell>
  );
}

type ConsentCheckboxProps = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  errorId: string;
  enabled: boolean;
};

/**
 * Checkbox obrigatória de aceite do termo LGPD. Bloqueia o submit até o
 * aceite e dá acesso ao texto integral do termo vigente em <details>
 * acessível (sem dependências externas). O "check" se desenha ao marcar.
 */
function ConsentCheckbox({
  checked,
  onChange,
  errorId,
  enabled,
}: ConsentCheckboxProps) {
  return (
    <div className="mt-1 flex flex-col gap-3 rounded-2xl bg-slate-50 p-4">
      <label className="group flex cursor-pointer items-start gap-3 text-sm text-a11y-slate-700">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          required={enabled}
          className="peer sr-only"
          aria-required={enabled}
          tabIndex={enabled ? 0 : -1}
        />
        <span
          aria-hidden="true"
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-[background-color,border-color,transform] duration-200 ease-out group-active:scale-90 motion-reduce:group-active:scale-100 peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
            checked
              ? "border-primary bg-primary"
              : "border-slate-300 bg-white"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3 text-white" fill="none">
            <path
              d="M3 8.5l3.2 3.2L13 5"
              pathLength={1}
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition-[stroke-dashoffset] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
              style={{
                strokeDasharray: 1,
                strokeDashoffset: checked ? 0 : 1,
              }}
            />
          </svg>
        </span>
        <span id={errorId} className="font-medium text-slate-800">
          Li e aceito os termos de LGPD ({CONSENT_TERM_VERSION})
        </span>
      </label>
      <details className="group ml-8">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-sm text-xs font-semibold text-primary outline-none transition-transform !duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 [&::-webkit-details-marker]:hidden">
          <ChevronRight
            className="h-3.5 w-3.5 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [details[open]_&]:rotate-90"
            aria-hidden="true"
          />
          Ler o termo completo
        </summary>
        <pre className="auth-details-body mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-xl bg-white p-3 font-sans text-xs leading-relaxed text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)]">
          {CONSENT_TERM}
        </pre>
      </details>
    </div>
  );
}