import { useId, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { Check, ExternalLink, UserCheck, UserX, X } from "lucide-react";
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

/**
 * [MODERACAO_RECRUTADOR] Aba "Recrutadores" do gestor: aprovar, recusar
 * (com motivo) e revogar cadastros de recrutador.
 */
export function ManagerRecruitersPage() {
  const [filter, setFilter] = useState<Filter>("pendente");
  const rows = useQuery(api.moderation.listRecruiters, { status: filter });
  const decide = useMutation(api.moderation.decideRecruiter);
  const [refuse, setRefuse] = useState<RefuseTarget | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const titleId = useId();

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
      setRefuse(null);
      setReason("");
    } catch (err) {
      toast.error(friendlyErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Recrutadores" className="flex flex-col gap-6">
      <h2 className="flex items-center gap-2 font-serif text-2xl font-bold text-primary">
        <UserCheck className="h-6 w-6" aria-hidden="true" />
        Recrutadores
      </h2>

      <div
        role="group"
        aria-label="Filtrar por situação"
        className="flex flex-wrap gap-2"
      >
        {FILTERS.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={filter === item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              filter === item.key
                ? "border-primary bg-primary text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-primary hover:text-primary"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {rows === undefined ? (
        <p role="status" className="text-sm text-slate-500">
          Carregando…
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={UserCheck}
          title="Nenhum recrutador nesta lista"
          description="Quando alguém se cadastrar como recrutador, o pedido aparece aqui para a sua decisão."
        />
      ) : (
        <ul className="flex flex-col gap-3" aria-label="Recrutadores">
          {rows.map((row) => {
            const badge = STATUS_BADGE[row.status];
            return (
              <li
                key={row.userId}
                className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-6 shadow-level1 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{row.name}</p>
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </div>
                  <p className="truncate text-sm text-slate-600">{row.email}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    {row.linkedinUrl !== null ? (
                      <a
                        href={row.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                        className="inline-flex items-center gap-1 font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
                </div>

                <div className="flex flex-wrap gap-2">
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
                      className="inline-flex items-center gap-2 rounded-md border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 transition-colors hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 disabled:opacity-50"
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

      {refuse !== null ? (
        <Modal
          titleId={titleId}
          onClose={() => {
            setRefuse(null);
            setReason("");
          }}
        >
          <h3
            id={titleId}
            className="flex items-center gap-2 font-serif text-lg font-bold text-primary"
          >
            <UserX className="h-5 w-5" aria-hidden="true" />
            {refuse.wasApproved ? "Revogar acesso" : "Recusar cadastro"}
          </h3>
          <p className="mt-2 text-sm text-slate-600">
            {refuse.name} verá o motivo abaixo e receberá um e-mail.
          </p>
          <label className="mt-4 flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Motivo
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              maxLength={500}
              className="rounded-md border border-slate-300 p-2 text-sm font-normal focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setRefuse(null);
                setReason("");
              }}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Cancelar
            </button>
            <Button
              variant="primary"
              disabled={busy || reason.trim().length < 5}
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
