import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { Card } from "../ui/card";
import type { StudentVisibility } from "../../lib/visibility";

const VISIBILITY_LABELS: Record<StudentVisibility, string> = {
  publico: "Visível para recrutadores",
  somente_candidaturas: "Apenas para candidaturas ativas",
};

/**
 * Privacidade do aluno (issue [S1-4], R2/R6):
 * - Toggle de visibilidade do perfil no banco de talentos (R2).
 * - Toggle de autorização geral de contato (R6) — default: desautorizado.
 * Persistência reativa via mutations próprias; explicação do efeito ao lado.
 */
export function PrivacySettings() {
  const profile: Doc<"students"> | null | undefined = useQuery(
    api.students.myProfile,
    {},
  );
  const setVisibility = useMutation(api.students.setVisibility);
  const setContactConsent = useMutation(api.students.setContactConsent);
  const [error, setError] = useState<string | null>(null);

  if (profile === undefined) {
    return (
      <p className="text-sm text-slate-500" role="status" aria-live="polite">
        Carregando privacidade…
      </p>
    );
  }

  if (profile === null) {
    return null; // perfil ainda não criado — formulário S1-3 cuida disso
  }

  const visibility: StudentVisibility =
    profile.visibility ?? "somente_candidaturas";
  const showContact = profile.showContactToRecruiters ?? false;

  async function handleVisibility(next: StudentVisibility) {
    setError(null);
    try {
      await setVisibility({ visibility: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  }

  async function handleContactConsent(next: boolean) {
    setError(null);
    try {
      await setContactConsent({ allow: next });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar.");
    }
  }

  return (
    <Card
      title="Privacidade e visibilidade"
      accent="secondary"
      headingLevel={2}
    >
      {error !== null ? (
        <p role="alert" className="mb-3 text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-semibold text-slate-700">
          Onde seu perfil aparece
        </legend>
        {(Object.keys(VISIBILITY_LABELS) as StudentVisibility[]).map(
          (option) => (
            <label
              key={option}
              className={`flex cursor-pointer items-start gap-2 rounded border px-3 py-2 text-sm transition-colors ${
                visibility === option
                  ? "border-primary bg-[#FDF2F4] text-primary"
                  : "border-slate-300 bg-white text-slate-700 hover:border-primary"
              }`}
            >
              <input
                type="radio"
                name="visibility"
                checked={visibility === option}
                onChange={() => void handleVisibility(option)}
                className="mt-0.5 accent-primary"
              />
              <span>
                <span className="font-semibold">
                  {VISIBILITY_LABELS[option]}
                </span>
                <span className="block text-xs text-slate-500">
                  {option === "publico"
                    ? "Seu perfil (sem contato, ver abaixo) aparece nas buscas do banco de talentos. Alunos inativos nunca aparecem."
                    : "Seu perfil só fica visível a recrutadores de vagas em que você é candidato ativo."}
                </span>
              </span>
            </label>
          ),
        )}
      </fieldset>

      <div className="mt-4 flex items-start gap-2 rounded border border-slate-200 bg-canvas px-3 py-2">
        <input
          id="contact-consent"
          type="checkbox"
          checked={showContact}
          onChange={(e) => void handleContactConsent(e.target.checked)}
          className="mt-0.5 accent-primary"
        />
        <label
          htmlFor="contact-consent"
          className="cursor-pointer text-sm text-slate-700"
        >
          <span className="font-semibold">
            Autorizo recrutadores a ver meus dados de contato
          </span>
          <span className="block text-xs text-slate-500">
            Sem essa autorização, seu e-mail/telefone ficam ocultos — inclusive
            em candidaturas —, salvo se você liberar o contato ao participar de
            um processo seletivo (regra LGPD do portal).
          </span>
        </label>
      </div>
    </Card>
  );
}
