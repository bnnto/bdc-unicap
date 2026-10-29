import { useId, useLayoutEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, ExternalLink, History, UserCheck, UserX, X } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { friendlyErrorMessage } from "../../lib/toastMessages";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { EmptyState } from "../ui/emptyState";
import { Modal } from "../ui/modal";

type Filter = "pendente" | "aprovado" | "recusado" | "todos";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "pendente", label: "Pendentes" },
  { key: "aprovado", label: "Aprovados" },
  { key: "recusado", label: "Recusados" },
  { key: "todos", label: "Todos" },
];

const STATUS_BADGE = {
  pendente: { variant: "triagem", label: "Pendente" },
  aprovado: { variant: "aprovado", label: "Aprovado" },
  recusado: { variant: "reprovado", label: "Recusado" },
} as const;

type RefuseTarget = { id: Id<"users">; name: string; wasApproved: boolean };

const OCCURRENCE_LABELS: Record<string, string> = {
  recusado: "Cadastro recusado",
  revogado: "Acesso revogado",
  conta_excluida: "Excluiu a conta após ser recusado",
  em_revisao: "Vaga enviada para revisão",
  suspensa: "Vaga suspensa",
  excluida: "Vaga excluída",
};

const MIN_REASON = 5;
const MAX_REASON = 500;

/** Mesma superfície do Painel Estratégico: anel semitransparente + sombra
 *  longa e suave; no alto contraste volta uma borda sólida. */
const SURFACE =
  "rounded-3xl border border-transparent bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.12)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)] [.high-contrast_&]:border-black [.high-contrast_&]:shadow-none [.dark.high-contrast_&]:border-white";

const PRESS =
  "transition-[background-color,color,border-color,box-shadow,transform] duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] active:scale-[0.985] active:duration-150 motion-reduce:[transition-property:background-color,color,border-color,opacity] motion-reduce:active:scale-100";

const LINK =
  "inline-flex items-center gap-1 rounded-md font-semibold text-primary transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse space-y-3">
      <span className="sr-only">Carregando recrutadores…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 rounded-3xl bg-slate-100" />
      ))}
    </div>
  );
}

/**
 * [MODERACAO_RECRUTADOR] Aba "Recrutadores" do gestor: aprovar, recusar
 * (com motivo) e revogar cadastros de recrutador.
 *
 * Visual alinhado ao Painel Estratégico: filtro em controle segmentado,
 * linhas em superfícies suaves com avatar, ação destrutiva discreta e
 * modal com contador de caracteres. Lógica e fluxos inalterados.
 */
export function ManagerRecruitersPage() {
  const [filter, setFilter] = useState<Filter>("pendente");
  const rows = useQuery(api.moderation.listRecruiters, { status: filter });
  const decide = useMutation(api.moderation.decideRecruiter);
  const [refuse, setRefuse] = useState<RefuseTarget | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();

  const tabsRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Partial<Record<Filter, HTMLButtonElement | null>>>({});
  const [pill, setPill] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  useLayoutEffect(() => {
    const measure = () => {
      const el = tabRefs.current[filter];
      setPill(
        el
          ? {
              left: el.offsetLeft,
              top: el.offsetTop,
              width: el.offsetWidth,
              height: el.offsetHeight,
            }
          : null,
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (tabsRef.current) ro.observe(tabsRef.current);
    Object.values(tabRefs.current).forEach((el) => {
      if (el) ro.observe(el);
    });
    return () => ro.disconnect();
  }, [filter]);

  function closeRefuse() {
    setRefuse(null);
    setReason("");
  }

  async function approve(id: Id<"users">) {
    setBusy(true);
    try {
      await decide({ recruiterId: id, decision: "aprovado" });
      toast.success("Recrutador aprovado.");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRefuse() {
    if (refuse === null) return;
    setBusy(true);
    try {
      await decide({
        recruiterId: refuse.id,
        decision: "recusado",
        reason,
      });
      toast.success(
        refuse.wasApproved ? "Acesso revogado." : "Cadastro recusado.",
      );
      closeRefuse();
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const reasonLength = reason.trim().length;

  return (
    <section aria-label="Recrutadores" className="flex flex-col gap-8 pb-16 pt-6">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-serif text-4xl font-bold leading-[1.1] tracking-tight text-primary sm:text-5xl">
            Recrutadores
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Aprove ou recuse os cadastros de recrutadores e revogue acessos
            quando necessário.
          </p>
        </div>

        {/* Controle segmentado: o filtro ativo "sobe" como uma peça branca. */}
        <div
          ref={tabsRef}
          role="group"
          aria-label="Filtrar por situação"
          className="relative inline-flex max-w-full flex-wrap gap-1 rounded-2xl bg-[#e8ecf1] p-1 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] dark:bg-[#242b3a] dark:shadow-none"
        >
          {/* Peça branca única que desliza entre as opções (só transform). */}
          {pill !== null ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 rounded-xl bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_1px_3px_rgba(15,23,42,0.1)] will-change-transform transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]"
              style={{
                width: pill.width,
                height: pill.height,
                transform: `translate(${pill.left}px, ${pill.top}px)`,
              }}
            />
          ) : null}

          {FILTERS.map((item, index) => {
            const active = filter === item.key;
            const prevActive = index > 0 && FILTERS[index - 1]?.key === filter;
            const showDivider = index > 0 && !active && !prevActive;
            return (
              <button
                key={item.key}
                ref={(el) => {
                  tabRefs.current[item.key] = el;
                }}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(item.key)}
                className={`relative z-10 inline-flex min-w-[6.75rem] items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold before:absolute before:-left-[2.5px] before:bottom-2.5 before:top-2.5 before:w-px before:bg-slate-300 before:transition-opacity before:duration-[450ms] dark:before:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${PRESS} ${
                  showDivider ? "before:opacity-100" : "before:opacity-0"
                } ${
                  active
                    ? "text-primary"
                    : "text-slate-600 hover:bg-white/60 hover:text-slate-900 dark:hover:bg-white/5 dark:hover:text-slate-100"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>
      <div key={filter} className="view-enter">
        {rows === undefined ? (
          <ListSkeleton />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={UserCheck}
            title="Nenhum recrutador nesta lista"
            description="Quando alguém se cadastrar como recrutador, o pedido aparece aqui para a sua decisão."
          />
        ) : (
          <ul className="flex flex-col gap-4" aria-label="Recrutadores">
            {rows.map((row) => {
              const badge = STATUS_BADGE[row.status];
              return (
                <li
                  key={row.userId}
                  className={`${SURFACE} flex flex-col gap-5 p-6 [overflow-wrap:anywhere] lg:flex-row lg:items-center lg:justify-between`}
                >
                  <div className="flex min-w-0 items-start gap-4">
                    <span
                      aria-hidden="true"
                      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FDF2F4] font-serif text-base font-bold text-primary"
                    >
                      {initials(row.name)}
                    </span>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="text-base font-semibold text-slate-900">
                          {row.name}
                        </p>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                      <p className="mt-0.5 truncate text-sm text-slate-600">
                        {row.email}
                      </p>

                      <p className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
                        {row.linkedinUrl !== null ? (
                          <a
                            href={row.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={LINK}
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            Ver LinkedIn
                            <span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        ) : null}
                        {row.website !== null &&
                        row.website.startsWith("https://") ? (
                          <a
                            href={row.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={LINK}
                          >
                            <ExternalLink className="h-4 w-4" aria-hidden="true" />
                            Ver site
                            <span className="sr-only"> (abre em nova aba)</span>
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">
                            Site não informado
                          </span>
                        )}
                      </p>

                      {row.previousCount > 0 ? (
                        <div className="mt-4 w-fit max-w-full rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-200">
                          <p className="flex items-center gap-1.5 font-semibold">
                            <History className="h-3.5 w-3.5" aria-hidden="true" />
                            Este e-mail tem {row.previousCount} ocorrência(s) em
                            contas anteriores
                          </p>
                          <details className="mt-1.5">
                            <summary className="w-fit cursor-pointer rounded font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                              Ver detalhes
                            </summary>
                            <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
                              {row.previous.map((item, index) => (
                                <li key={index}>
                                  {new Date(item.at).toLocaleDateString("pt-BR")}{" "}
                                  · {OCCURRENCE_LABELS[item.action] ?? item.action}
                                  {item.subject !== null
                                    ? ` “${item.subject}”`
                                    : ""}
                                  : {item.reason}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {row.status !== "aprovado" ? (
                      <Button
                        variant="primary"
                        disabled={busy}
                        onClick={() => void approve(row.userId)}
                      >
                        <Check className="h-4 w-4" aria-hidden="true" />
                        Aprovar
                      </Button>
                    ) : null}
                    {row.status !== "recusado" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setRefuse({
                            id: row.userId,
                            name: row.name,
                            wasApproved: row.status === "aprovado",
                          })
                        }
                        className={`inline-flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50 dark:border-red-400/40 dark:text-red-300 dark:hover:bg-red-500/10 ${PRESS}`}
                      >
                        <UserX className="h-4 w-4" aria-hidden="true" />
                        {row.status === "aprovado" ? "Revogar" : "Recusar"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {refuse !== null ? (
        <Modal titleId={titleId} onClose={closeRefuse}>
          <h3
            id={titleId}
            className="flex items-center gap-2.5 font-serif text-xl font-bold tracking-tight text-slate-900"
          >
            <span aria-hidden="true" className="text-primary">
              <UserX className="h-5 w-5" />
            </span>
            {refuse.wasApproved ? "Revogar acesso" : "Recusar cadastro"}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {refuse.name} verá o motivo abaixo e receberá um e-mail.
          </p>

          <label className="mt-5 flex flex-col gap-1.5 text-sm font-medium text-slate-700">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={MAX_REASON}
              aria-describedby={`${titleId}-hint`}
              className="resize-none rounded-xl border border-slate-300 bg-white p-3 text-sm font-normal text-slate-900 transition-colors hover:border-slate-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </label>
          <p
            id={`${titleId}-hint`}
            className="mt-1.5 flex justify-between gap-3 text-xs text-a11y-slate-500"
          >
            <span>
              {reasonLength < MIN_REASON
                ? `Escreva pelo menos ${MIN_REASON} caracteres.`
                : "Pronto para confirmar."}
            </span>
            <span className="tabular-nums">
              {reason.length}/{MAX_REASON}
            </span>
          </p>

          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={closeRefuse}
              className={`rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-white/5 ${PRESS}`}
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              disabled={busy || reasonLength < MIN_REASON}
              onClick={() => void confirmRefuse()}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Confirmar
            </Button>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}