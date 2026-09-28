import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import {
  STAGE_LABELS,
  checkRequiredPrerequisites,
} from "../../lib/application";
import { CONTRACT_LABELS, formatSalaryRange } from "../../lib/job";
import {
  MATCH_BAND_LABELS,
  matchBand,
  type MatchBand,
} from "../../lib/matching";

type MatchChipVariant = Record<
  MatchBand,
  "aprovado" | "andamento" | "reprovado"
>;

const MATCH_CHIP: MatchChipVariant = {
  strong: "aprovado",
  medium: "andamento",
  low: "reprovado",
};

type OpenJob = Doc<"jobs">;

function MatchChip({ score }: { score: number }) {
  const band = matchBand(score);
  return (
    <Badge variant={MATCH_CHIP[band]}>
      {score}% · {MATCH_BAND_LABELS[band]}
    </Badge>
  );
}

/**
 * Oportunidades para o aluno (issue [S3-4]): vagas abertas dentro do
 * prazo (R4) com candidatura em um clique. O % de compatibilidade
 * (R8) é calculado NO SERVIDOR (applyToJob — fonte da verdade, CA 1)
 * e exibido em chips por faixa (CA 2). Etapa inicial: "inscrito" (CA 3).
 */
export function JobOpportunities() {
  const openJobs = useQuery(api.applications.openJobs, {});
  const myApplications = useQuery(api.applications.myApplications, {});
  const profile = useQuery(api.students.myProfile, {});
  const apply = useMutation(api.applications.applyToJob);
  const acceptProcess = useMutation(api.applications.acceptProcess);
  const revokeProcessAcceptance = useMutation(
    api.applications.revokeProcessAcceptance,
  );

  const [notice, setNotice] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Pré-candidaturas: ids das vagas já aplicadas (idempotência na UI).
  const appliedJobIds = new Set(
    (myApplications ?? []).map((a) => String(a.jobId)),
  );

  // Perfil mínimo exigido para candidatar (cadastro completo).
  const hasProfile = profile !== undefined && profile !== null;

  // [S3-5] Aviso claro por vaga: quais requisitos obrigatórios faltam
  // (mesma regra pura do servidor — o bloqueio final é sempre lá).
  function missingPrerequisitesFor(job: OpenJob): string[] {
    if (!hasProfile) return [];
    return checkRequiredPrerequisites(
      { prerequisites: job.prerequisites },
      profile.skills ?? [],
    ).missing;
  }

  if (openJobs === undefined || myApplications === undefined) {
    return (
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        Carregando oportunidades…
      </p>
    );
  }

  return (
    <Card
      title="Oportunidades (vagas abertas)"
      accent="secondary"
      headingLevel={2}
    >
      {notice !== null ? (
        <p
          role="status"
          className="mb-3 rounded border border-success bg-white px-3 py-2 text-sm font-medium text-success"
        >
          {notice}
        </p>
      ) : null}

      {openJobs.length === 0 ? (
        <p className="text-sm text-slate-600">
          Nenhuma vaga aberta no momento. Volte em breve!
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {openJobs.map((job: OpenJob) => {
            const applied = appliedJobIds.has(String(job._id));
            const error = errors[String(job._id)];
            const missing = missingPrerequisitesFor(job);
            const blocked = missing.length > 0;
            return (
              <li
                key={job._id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="font-serif text-base font-bold text-primary">
                      {job.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {CONTRACT_LABELS[job.contractType]} ·{" "}
                      {formatSalaryRange(
                        job.salaryMin ?? null,
                        job.salaryMax ?? null,
                      )}
                      {job.location !== undefined ? ` · ${job.location}` : ""}
                    </p>
                  </div>
                  {applied ? (
                    <Badge variant="andamento">Candidatura enviada</Badge>
                  ) : null}
                </div>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                  {job.description}
                </p>
                <ul
                  className="mt-2 flex flex-wrap gap-2"
                  aria-label="Pré-requisitos"
                >
                  {job.prerequisites.map((p, i) => (
                    <li key={`${p.item}-${i}`}>
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                          p.required
                            ? "border-primary bg-[#FDF2F4] text-primary"
                            : "border-secondary bg-white text-slate-700"
                        }`}
                      >
                        {p.item}
                        {p.required ? " · obrigatório" : " · opcional"}
                      </span>
                    </li>
                  ))}
                </ul>

                {blocked ? (
                  <p
                    role="alert"
                    className="mt-3 rounded border border-warning bg-white px-3 py-2 text-xs font-medium text-warning"
                  >
                    {missing.length === 1
                      ? `Requisito obrigatório não atendido: ${missing[0]}.`
                      : `Requisitos obrigatórios não atendidos: ${missing.join(", ")}.`}{" "}
                    Complete o perfil com as competências necessárias para se
                    candidatar.
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="primary"
                    disabled={applied || !hasProfile || blocked}
                    title={
                      blocked
                        ? "Complete os requisitos obrigatórios no seu perfil para se candidatar."
                        : undefined
                    }
                    onClick={() => {
                      setNotice(null);
                      void (async () => {
                        try {
                          const result = await apply({ jobId: job._id });
                          setNotice(
                            `Candidatura registrada — match de ${result.matchScore}%. Etapa: ${STAGE_LABELS.inscrito}.`,
                          );
                        } catch (err) {
                          setErrors((prev) => ({
                            ...prev,
                            [String(job._id)]:
                              err instanceof Error
                                ? err.message
                                : "Falha ao se candidatar.",
                          }));
                        }
                      })();
                    }}
                  >
                    {applied ? "Você já se candidatou" : "Candidatar-se"}
                  </Button>
                  {error !== undefined ? (
                    <span className="text-xs text-danger" role="alert">
                      {error}
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-6 border-t border-slate-200 pt-4">
        <h3 className="font-serif text-sm font-bold text-primary">
          Minhas candidaturas
        </h3>{" "}
        {(myApplications ?? []).length === 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            Nenhuma candidatura ainda. Candidate-se às vagas acima — o % de
            compatibilidade é calculado automaticamente no servidor.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {(myApplications ?? []).map((application) => (
              <li
                key={application.applicationId}
                className="flex flex-col gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {application.jobTitle}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">
                      {STAGE_LABELS[application.stage] ?? application.stage}
                    </span>
                    <MatchChip score={application.matchScore} />
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* [S4-3] R6 — aceite em participar do processo libera o
                      contato ao recrutador desta vaga; revogável a qualquer
                      momento (LGPD). */}
                  {application.processAccepted ? (
                    <span className="text-xs text-success">
                      Contato liberado para esta vaga (aceite no processo)
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500">
                      Contato não liberado para esta vaga
                    </span>
                  )}
                  <Button
                    variant={
                      application.processAccepted ? "secondary" : "accent"
                    }
                    aria-label={
                      application.processAccepted
                        ? `Revogar aceite do processo da vaga ${application.jobTitle}`
                        : `Autorizar contato e aceitar participar do processo da vaga ${application.jobTitle}`
                    }
                    onClick={() => {
                      void (application.processAccepted
                        ? revokeProcessAcceptance({
                            applicationId: application.applicationId,
                          })
                        : acceptProcess({
                            applicationId: application.applicationId,
                          }));
                    }}
                  >
                    {application.processAccepted
                      ? "Revogar aceite"
                      : "Aceitar participar (libera contato)"}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
