import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { navigateTo } from "../../lib/router";
import { passwordRules, PASSWORD_MAX_LENGTH } from "../../lib/auth";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  ArrowLeft,
  Check,
  KeyRound,
  Loader2,
  Mail,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  AuthCard,
  AuthShell,
  Collapse,
  PasswordMeter,
  PasswordToggle,
  useShake,
} from "./authUi";

/**
 * [ONBOARDING_RECOVERY] Etapa 3 — página pública `/recuperar-senha`.
 *
 * - SEM token na URL: pede o e-mail e dispara `passwordResets.requestReset`
 *   (resposta idêntica com ou sem conta — sem enumeração de usuários).
 * - COM `?token=` na URL: formulário "Nova senha" + "Confirmar nova senha"
 *   que chama `passwordResets.resetPassword`. A senha segue as mesmas
 *   regras do cadastro (src/lib/auth.ts), repetidas no servidor.
 *
 * Todo o feedback (sucesso "E-mail de recuperação enviado!", senhas
 * diferentes, "Token inválido ou expirado") sai por Toast global — a
 * mesma convenção do resto do portal (UX_REFINEMENT Etapa 1).
 *
 * Redesign: mesmo AuthShell do login; cada etapa (pedir e-mail, e-mail
 * enviado, nova senha) entra com crossfade; medidor de senha, indicador de
 * "senhas coincidem" e tremida curta quando o envio falha.
 */

type View = "request" | "sent" | "reset";

/** Ícone no topo do cartão: surge com um "pop" curto. */
function IconChip({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="auth-pop mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-[#FDF2F4] text-primary"
    >
      {children}
    </span>
  );
}

function BackToLogin() {
  return (
    <p className="mt-6 text-center">
      <button
        type="button"
        onClick={() => navigateTo("/login")}
        className="group inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-primary transition-[background-color,transform] !duration-150 active:scale-[0.97] motion-reduce:active:scale-100 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#FDF2F4] [@media(hover:hover)_and_(pointer:fine)]:dark:hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ArrowLeft
          className="h-4 w-4 transition-transform !duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-0.5"
          aria-hidden="true"
        />
        Voltar para o login
      </button>
    </p>
  );
}

export function ResetPasswordPage() {
  // Token lido UMA vez da URL (o e-mail do reset abre esta rota direto).
  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("token");
  }, []);

  const requestReset = useMutation(api.passwordResets.requestReset);
  const resetPassword = useMutation(api.passwordResets.resetPassword);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  /** [UX_QUICK_WIN] — olhinho alterna password/texto por campo. */
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const shake = useShake();

  // Requisitos de senha (mesma regra do servidor). O e-mail do titular só
  // é conhecido no servidor, que confere "não contém o e-mail" no envio.
  const rules = passwordRules(password);
  const passwordOk = rules.every((rule) => rule.ok);
  const showPasswordRules = password.length > 0;
  const matches = confirm.length > 0 && confirm === password;

  const view: View = token === null ? (sent ? "sent" : "request") : "reset";

  async function handleRequest(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setPending(true);
    try {
      await requestReset({ email });
      setSent(true);
      // Sem enumeração: mensagem única, exista a conta ou não.
      toast.success(
        "E-mail de recuperação enviado! Verifique a sua caixa de entrada.",
      );
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
      shake.trigger();
    } finally {
      setPending(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      shake.trigger();
      return;
    }
    if (!passwordOk) {
      toast.error("A senha não atende a todos os requisitos.");
      shake.trigger();
      return;
    }
    setPending(true);
    try {
      await resetPassword({ token: token ?? "", password });
      toast.success("Senha redefinida com sucesso! Entre com a nova senha.");
      navigateTo("/login");
    } catch (err) {
      // Token inválido/expirado, senha fraca e demais erros viram Toast amigável.
      toast.error(friendlyErrorMessage(err));
      shake.trigger();
    } finally {
      setPending(false);
    }
  }

  return (
    // [S8-2] main único desta página (renderizado pelo AuthShell, #conteudo).
    <AuthShell ariaLabel="Recuperação de senha">
      <AuthCard>
        <div className={shake.className} onAnimationEnd={shake.onAnimationEnd}>
          {/* `key` remonta a etapa e dispara o crossfade a cada mudança. */}
          <div key={view} className="auth-swap">
            {view === "request" ? (
              <>
                <IconChip>
                  <KeyRound className="h-6 w-6" />
                </IconChip>
                <h1 className="font-serif text-3xl font-bold leading-tight tracking-[-0.02em] text-primary">
                  Esqueceu sua senha?
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Informe o e-mail da sua conta e enviaremos um link para criar
                  uma nova senha (válido por 30 minutos).
                </p>

                <form
                  aria-label="Solicitar recuperação de senha"
                  onSubmit={(event) => {
                    void handleRequest(event);
                  }}
                  className="mt-6 flex flex-col gap-4"
                >
                  <Input
                    label="E-mail"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                  />
                  <Button type="submit" variant="primary" disabled={pending}>
                    {pending ? (
                      <Loader2
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <Mail className="h-4 w-4" aria-hidden="true" />
                    )}
                    {pending ? "Enviando…" : "Enviar link de recuperação"}
                  </Button>
                </form>
              </>
            ) : null}

            {view === "sent" ? (
              <div role="status" aria-live="polite">
                {/* Anel que se desenha + selo de confirmação. */}
                <span
                  aria-hidden="true"
                  className="relative mb-5 grid h-16 w-16 place-items-center rounded-full bg-[#FDF2F4] text-primary"
                >
                  <svg
                    viewBox="0 0 64 64"
                    fill="none"
                    className="absolute inset-0 h-full w-full -rotate-90"
                  >
                    <circle
                      cx="32"
                      cy="32"
                      r="30"
                      pathLength={1}
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      className="auth-draw"
                      style={{ animationDelay: "120ms" }}
                    />
                  </svg>
                  <Mail className="h-7 w-7" />
                  <span
                    className="auth-pop absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-success text-white ring-2 ring-white dark:ring-[#171b22]"
                    style={{ animationDelay: "700ms" }}
                  >
                    <Check className="h-3.5 w-3.5" strokeWidth={3} />
                  </span>
                </span>
                <h1 className="font-serif text-3xl font-bold leading-tight tracking-[-0.02em] text-primary">
                  Confira seu e-mail
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Se existir uma conta com{" "}
                  <strong className="break-all font-semibold text-slate-800">
                    {email}
                  </strong>
                  , o link de recuperação já está a caminho. Não encontrou?
                  Confira a caixa de spam.
                </p>
                <div className="mt-6 flex flex-col">
                  <Button variant="secondary" onClick={() => setSent(false)}>
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Usar outro e-mail
                  </Button>
                </div>
              </div>
            ) : null}

            {view === "reset" ? (
              <>
                <IconChip>
                  <ShieldCheck className="h-6 w-6" />
                </IconChip>
                <h1 className="font-serif text-3xl font-bold leading-tight tracking-[-0.02em] text-primary">
                  Crie uma nova senha
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Escolha uma nova senha para a sua conta. Depois é só entrar
                  com ela normalmente.
                </p>
                <form
                  aria-label="Redefinir senha"
                  onSubmit={(event) => {
                    void handleReset(event);
                  }}
                  className="mt-6 flex flex-col gap-4"
                >
                  <Input
                    label="Nova senha"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={PASSWORD_MAX_LENGTH}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="new-password"
                    trailing={
                      <PasswordToggle
                        visible={showPassword}
                        onToggle={setShowPassword}
                      />
                    }
                  />
                  <PasswordMeter rules={rules} show={showPasswordRules} />
                  <Input
                    label="Confirmar nova senha"
                    type={showConfirm ? "text" : "password"}
                    required
                    minLength={8}
                    maxLength={PASSWORD_MAX_LENGTH}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    trailing={
                      <PasswordToggle
                        visible={showConfirm}
                        onToggle={setShowConfirm}
                      />
                    }
                  />

                  {/* Confere em tempo real se as duas senhas são iguais. */}
                  <Collapse open={confirm.length > 0}>
                    <p
                      key={matches ? "ok" : "no"}
                      aria-live="polite"
                      className={`auth-swap -mt-1 flex items-center gap-2 pb-1 text-xs font-medium ${
                        matches ? "text-success" : "text-warning"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`grid h-4 w-4 place-items-center rounded-full text-white ${
                          matches ? "bg-success" : "bg-warning"
                        }`}
                      >
                        {matches ? (
                          <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                        ) : (
                          <X className="h-2.5 w-2.5" strokeWidth={3.5} />
                        )}
                      </span>
                      {matches
                        ? "As senhas coincidem"
                        : "As senhas ainda não coincidem"}
                    </p>
                  </Collapse>

                  <Button
                    type="submit"
                    variant="primary"
                    disabled={pending || !passwordOk}
                  >
                    {pending ? (
                      <Loader2
                        className="h-4 w-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                      />
                    ) : (
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    )}
                    {pending ? "Salvando…" : "Redefinir senha"}
                  </Button>
                </form>
              </>
            ) : null}
          </div>

          <BackToLogin />
        </div>
      </AuthCard>
    </AuthShell>
  );
}