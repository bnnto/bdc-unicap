/**
 * [REFACTOR_ALUNO Etapa 2] — Página "Meu Currículo": layout de duas
 * colunas: sidebar sticky à esquerda (foto/iniciais, nome, curso e os
 * controles de privacidade do Banco de Talentos) e conteúdo à direita com
 * os 7 blocos do formulário + visualização/exportação do PDF.
 *
 * [UI_REDESIGN] Sidebar na mesma linguagem do ResumeForm (superfície,
 * curvas e ritmo de movimento da ProfilePage). A "Navegação rápida" por
 * âncoras saiu: o ResumeForm agora tem navegação própria com indicador
 * deslizante, scroll-spy e progresso por bloco.
 *
 * Container full-width max-w-[1440px] (Etapa 1.2). O landmark main
 * continua único no App — daqui sai apenas <section>/<aside>/<div>.
 *
 * [REFACTOR_ALUNO visual] — títulos em grotesca (24/600) com tracking
 * negativo; superfícies planas (borda OU sombra, nunca as duas); a faixa
 * do cartão de identidade é cor chapada (sem gradiente); a navegação
 * rápida usa check/bolha em vez de check/× (× lê como erro).
 */
import {
  useLayoutEffect,
  useRef,
  type ElementType,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { ResumeForm } from "./ResumeForm";
import { ResumeDownload } from "./ResumeDownload";
import {
  EyeOff,
  FileDown,
  Globe,
  GraduationCap,
  Lock,
  Mail,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { useAuthState } from "../auth/authContext";

/* ==========================================================================
   Tokens (espelham os do ResumeForm / ProfilePage)
   ========================================================================== */

const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";
const EASE_OUT = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/** Troca de ícone: opacidade + escala + blur leve (nunca scale(0)). */
const ICON_SWAP = `col-start-1 row-start-1 h-5 w-5 transition-[opacity,transform,scale,filter]  -300 ${EASE_OUT} motion-reduce:[transition-property:opacity]`;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Entrada pontual (WAAPI): opacidade + subida curta + escala a partir de
 * 0.985. Reduced motion → só um fade curto.
 */
type EnterProps = HTMLAttributes<HTMLElement> & {
  as?: ElementType;
  delay?: number;
  y?: number;
};

function Enter({ as: Tag = "div", delay = 0, y = 10, ...rest }: EnterProps) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null || typeof el.animate !== "function") return;
    const reduce = prefersReducedMotion();
    const animation = el.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translateY(${y}px) scale(0.985)` },
            { opacity: 1, transform: "translateY(0) scale(1)" },
          ],
      {
        duration: reduce ? 150 : 560,
        delay: reduce ? 0 : delay,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
        fill: "backwards",
      },
    );
    return () => animation.cancel();
    // Só na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <Tag ref={ref} {...rest} />;
}

/** Iniciais do avatar: primeira + última palavra (sem foto externa). */
function initialsOf(name: string): string {
  const parts = name.split(" ").filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0]!.charAt(0);
  const last = parts.length > 1 ? parts[parts.length - 1]!.charAt(0) : "";
  return (first + last).toUpperCase();
}

/* ==========================================================================
   Componentes de apresentação
   ========================================================================== */

/**
 * Linha de privacidade: ícone que troca conforme o estado, switch nativo
 * (`<input type="checkbox" role="switch">` — teclado e leitor de tela de
 * graça) e a explicação do estado atual, que entra com um fade curto.
 */
function SwitchRow({
  labelId,
  label,
  checked,
  disabled,
  onChange,
  iconOn: IconOn,
  iconOff: IconOff,
  children,
}: {
  labelId: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
  iconOn: LucideIcon;
  iconOff: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div>
      <label
        className={`flex items-center justify-between gap-4 ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-[background-color,color] duration-[600ms] ${EASE} ${
              checked
                ? "bg-[#FDF2F4] text-primary"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            <IconOn
              className={`${ICON_SWAP} ${
                checked ? "opacity-100" : "scale-75 opacity-0 blur-[2px]"
              }`}
            />
            <IconOff
              className={`${ICON_SWAP} ${
                checked ? "scale-75 opacity-0 blur-[2px]" : "opacity-100"
              }`}
            />
          </span>
          <span
            id={labelId}
            className="text-sm font-semibold leading-snug text-slate-900"
          >
            {label}
          </span>
        </span>

        <span className="relative shrink-0">
          <input
            type="checkbox"
            role="switch"
            aria-labelledby={labelId}
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={`block h-7 w-12 rounded-full bg-slate-300 transition-colors duration-[600ms] ${EASE} peer-checked:bg-primary peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 peer-disabled:opacity-50 after:absolute after:left-0.5 after:top-0.5 after:h-6 after:w-6 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-[600ms] after:content-[''] after:ease-[cubic-bezier(0.32,0.72,0,1)] peer-checked:after:translate-x-5 motion-reduce:after:transition-none`}
          />
        </span>
      </label>
      <Enter
        as="p"
        key={String(checked)}
        y={3}
        className="mt-3 text-xs leading-relaxed text-slate-500"
      >
        {children}
      </Enter>
    </div>
  );
}

function ProfileMeta({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

export function ResumeBuilderPage() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const setVisibility = useMutation(api.students.setVisibility);

  const isPublic =
    (profile?.visibility ?? "somente_candidaturas") === "publico";

  async function handleVisibility(next: "publico" | "somente_candidaturas") {
    try {
      await setVisibility({ visibility: next });
    } catch {
      // Erro exibido pelos próprios controles do formulário/privacidade;
      // aqui o toggle volta ao estado salvo pela reação do useQuery.
    }
  }

  const setContactConsent = useMutation(api.students.setContactConsent);
  const showContact = profile?.showContactToRecruiters ?? false;

  async function handleContactConsent(next: boolean) {
    try {
      await setContactConsent({ allow: next });
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    }
  }

  const { user } = useAuthState();
  const bannerUrl = useQuery(
    api.students.myBannerUrl,
    profile ? {} : "skip",
  );
  const switchesDisabled = profile === undefined || profile === null;

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 pb-20 pt-8 sm:px-8">
      {/* Cabeçalho da página (h1 único da tela). */}
      <Enter as="header" y={8} className="mb-8">
        <h1 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
          Meu Currículo
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600">
          Mantenha seus dados acadêmicos, técnicos e projetos atualizados. O PDF
          gerado é o espelho exato desta tela, cores, colunas e identidade
          UNICAP preservadas na impressão.
        </p>
      </Enter>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
        {/* SIDEBAR — fixa/sticky na rolagem (Etapa 2.1). */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24">
          {/* Cartão de identidade. */}
          <Enter delay={90}>
            <section className={`${SURFACE} overflow-hidden`}>
              <div
                aria-hidden="true"
                className="relative h-24 overflow-hidden bg-[linear-gradient(120deg,#4f0d1c,#6b1426_45%,#8f2238)]"
              >
                {bannerUrl ? (
                  <Enter key={bannerUrl} y={0} className="absolute inset-0">
                    <img
                      src={bannerUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  </Enter>
                ) : (
                  <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,rgba(200,157,60,0.32),transparent)]" />
                )}
              </div>
              <div className="relative -mt-12 flex flex-col items-center px-6 pb-7 text-center">
                {/* Avatar com aro bordô e dourado (igual ao da ProfilePage). */}
                <div className="rounded-full bg-[conic-gradient(from_200deg,#6b1426,#c89d3c,#6b1426)] p-[3px]">
                  <span className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#FDF2F4] font-serif text-3xl font-bold text-primary ring-4 ring-white dark:ring-[#171b22]">
                    {user?.image ? (
                      <img
                        src={user.image}
                        alt="Sua foto de perfil"
                        className="h-full w-full object-cover"
                      />
                    ) : profile === undefined || profile === null ? (
                      "…"
                    ) : (
                      initialsOf(profile.fullName)
                    )}
                  </span>
                </div>

                {profile === undefined ? (
                  <div
                    role="status"
                    aria-live="polite"
                    className="mt-4 flex w-full flex-col items-center gap-2"
                  >
                    <span className="sr-only">Carregando perfil…</span>
                    <div className="h-5 w-40 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
                    <div className="h-4 w-28 animate-pulse rounded-full bg-slate-100 motion-reduce:animate-none" />
                  </div>
                ) : profile === null ? (
                  /* [ONBOARDING_RECOVERY] conta nova: sem beco sem saída — o
                     próprio Bloco 1 do currículo cria o perfil (upsert). */
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    Perfil novo: preencha o Bloco 1 (Dados Pessoais) abaixo e
                    salve — seus dados ficam por aqui, direto no currículo.
                  </p>
                ) : (
                  <Enter y={6} className="mt-4 flex flex-col items-center">
                    <h2 className="break-words font-serif text-xl font-bold leading-tight tracking-tight text-slate-900">
                      {profile.fullName}
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-primary">
                      {profile.course}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <ProfileMeta icon={GraduationCap}>
                        {profile.semester !== undefined &&
                        profile.semester !== null
                          ? `${profile.semester}º semestre · `
                          : ""}
                        Conclusão {profile.graduationYear}
                      </ProfileMeta>
                      <ProfileMeta icon={User}>
                        Matrícula{" "}
                        <span className="tabular-nums">
                          {profile.enrollment}
                        </span>
                      </ProfileMeta>
                    </div>
                  </Enter>
                )}
              </div>
            </section>
          </Enter>

          {/* Privacidade (R2) — Público vs Privado + consentimento de contato. */}
          <Enter delay={180}>
            <section
              aria-label="Privacidade do currículo"
              className={`${SURFACE} flex flex-col gap-6 p-6`}
            >
              <SwitchRow
                labelId="visibility-switch-label"
                label="Visibilidade no Banco de Talentos"
                checked={isPublic}
                disabled={switchesDisabled}
                onChange={(next) =>
                  void handleVisibility(next ? "publico" : "somente_candidaturas")
                }
                iconOn={Globe}
                iconOff={Lock}
              >
                {isPublic ? (
                  <>
                    <strong className="font-semibold text-primary">
                      Público:
                    </strong>{" "}
                    seu currículo aparece nas buscas do banco de talentos.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-primary">
                      Privado:
                    </strong>{" "}
                    visível apenas a recrutadores de vagas em que você é
                    candidato.
                  </>
                )}
              </SwitchRow>

              <div className="border-t border-slate-100 pt-6">
                <SwitchRow
                  labelId="contact-switch-label"
                  label="Permitir contato de recrutadores"
                  checked={showContact}
                  disabled={switchesDisabled}
                  onChange={(next) => void handleContactConsent(next)}
                  iconOn={Mail}
                  iconOff={EyeOff}
                >
                  {showContact ? (
                    <>
                      <strong className="font-semibold text-primary">
                        Autorizado:
                      </strong>{" "}
                      recrutadores podem ver seu e-mail e enviar convites por
                      e-mail pelo portal.
                    </>
                  ) : (
                    <>
                      <strong className="font-semibold text-primary">
                        Não autorizado:
                      </strong>{" "}
                      seu e-mail fica oculto e você não recebe convites.
                    </>
                  )}
                </SwitchRow>
              </div>
            </section>
          </Enter>
        </aside>

        {/* CONTEÚDO — os 7 blocos + exportação (Etapa 2.2/2.3). */}
        <div className="flex min-w-0 flex-col gap-6">
          <ResumeForm />
          <Enter
            as="section"
            id="bloco-exportar"
            aria-labelledby="exportar-heading"
            className={`${SURFACE} scroll-mt-44 p-6 sm:p-8`}
          >
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FDF2F4] text-primary"
              >
                <FileDown className="h-6 w-6" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h2
                  id="exportar-heading"
                  className="font-serif text-xl font-bold leading-tight tracking-tight text-slate-900 sm:text-2xl"
                >
                  Visualizador e Exportação PDF
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                  Confira a prévia final e baixe em PDF.
                </p>
              </div>
            </div>
            <div className="mt-7">
              <ResumeDownload />
            </div>
          </Enter>
        </div>
      </div>
    </div>
  );
}
