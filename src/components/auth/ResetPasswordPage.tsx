import { useMemo, useState, type FormEvent } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { navigateTo } from "../../lib/router";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Mail, ShieldCheck } from "lucide-react";

/**
 * [ONBOARDING_RECOVERY] Etapa 3 — página pública `/recuperar-senha`.
 *
 * - SEM token na URL: pede o e-mail e dispara `passwordResets.requestReset`
 *   (resposta idêntica com ou sem conta — sem enumeração de usuários).
 * - COM `?token=` na URL: formulário "Nova senha" + "Confirmar nova senha"
 *   que chama `passwordResets.resetPassword`.
 *
 * Todo o feedback (sucesso "E-mail de recuperação enviado!", senhas
 * diferentes, "Token inválido ou expirado") sai por Toast global — a
 * mesma convenção do resto do portal (UX_REFINEMENT Etapa 1).
 */
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
    } finally {
      setPending(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setPending(true);
    try {
      await resetPassword({ token: token ?? "", password });
      toast.success("Senha redefinida com sucesso! Entre com a nova senha.");
      navigateTo("/login");
    } catch (err) {
      // Token inválido/expirado e demais erros viram Toast amigável.
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
          Portal de Carreiras
        </h1>
      </header>

      {/* [S8-2] main único desta página (mesma estrutura da AuthPage). */}
      <main
        id="conteudo"
        tabIndex={-1}
        aria-label="Recuperação de senha"
        className="w-full max-w-md outline-none"
      >
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-level2">
          {token === null ? (
            <>
              <h2 className="font-serif text-xl font-bold text-primary">
                Esqueci minha senha
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Informe o e-mail da sua conta e enviaremos um link para criar
                uma nova senha (válido por 30 minutos).
              </p>

              {sent ? (
                <div className="mt-4 rounded border border-slate-200 bg-canvas p-4">
                  <p className="text-sm text-slate-700">
                    Se existir uma conta com este e-mail, o link de recuperação
                    já está a caminho. Não encontrou? Confira a caixa de spam.
                  </p>
                </div>
              ) : (
                <form
                  aria-label="Solicitar recuperação de senha"
                  onSubmit={(event) => {
                    void handleRequest(event);
                  }}
                  className="mt-4 flex flex-col gap-4"
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
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    {pending ? "Enviando…" : "Enviar link de recuperação"}
                  </Button>
                </form>
              )}
            </>
          ) : (
            <>
              <h2 className="font-serif text-xl font-bold text-primary">
                Recuperar senha
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                Escolha uma nova senha para a sua conta. Depois é só entrar com
                ela normalmente.
              </p>
              <form
                aria-label="Redefinir senha"
                onSubmit={(event) => {
                  void handleReset(event);
                }}
                className="mt-4 flex flex-col gap-4"
              >
                <Input
                  label="Nova senha"
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  hint="Mínimo de 8 caracteres"
                />
                <Input
                  label="Confirmar nova senha"
                  type="password"
                  required
                  minLength={8}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                />
                <Button type="submit" variant="primary" disabled={pending}>
                  <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                  {pending ? "Salvando…" : "Redefinir senha"}
                </Button>
              </form>
            </>
          )}

          <p className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => navigateTo("/login")}
              className="font-semibold text-primary underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Voltar para o login
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
