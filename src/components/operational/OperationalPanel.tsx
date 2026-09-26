import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "../ui/card";
import { formatEmployabilityRate } from "../../lib/operationalPanel";

/**
 * Painel Operacional (issue [S5-1]).
 * Cards com totais de vagas por status e taxa de empregabilidade —
 * TODOS os números vêm da query agregada `operationalSummary` no
 * servidor (CA 1: consistentes com o banco; CA 2: taxa calculada a
 * partir de aprovações). A UI apenas exibe e formata.
 */

type KpiCardProps = {
  value: string | number;
  label: string;
  hint?: string;
};

function KpiCard({ value, label, hint }: KpiCardProps) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-level1">
      <p className="font-serif text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {hint !== undefined ? (
        <p className="mt-0.5 text-xs text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export function OperationalPanel() {
  const summary = useQuery(api.operational.operationalSummary, {});

  if (summary === undefined) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-slate-500">Carregando indicadores…</p>
      </div>
    );
  }

  return (
    <section data-testid="operational-panel" aria-label="Painel operacional">
      <header className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-secondary">
          Indicadores
        </p>
        <h2 className="font-serif text-2xl font-bold text-primary">
          Painel Operacional
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Visão geral das vagas e do desempenho dos processos seletivos —
          atualizado em tempo real com o banco do portal.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          value={summary.jobs.open}
          label="Vagas abertas"
          hint="recebendo candidaturas"
        />
        <KpiCard value={summary.jobs.closed} label="Vagas fechadas" />
        <KpiCard
          value={summary.jobs.filled}
          label="Vagas preenchidas"
          hint="encerradas (R4)"
        />
        <KpiCard value={summary.jobs.total} label="Total de vagas" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card title="Taxa de Empregabilidade" accent="secondary">
          <p className="font-serif text-3xl font-bold text-primary">
            {formatEmployabilityRate(summary.employability.rate)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aprovados sobre finalizados (CA 2)
          </p>
        </Card>
        <Card title="Candidaturas em andamento">
          <p className="font-serif text-3xl font-bold text-primary">
            {summary.applications.inProgress}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Inscrito, triagem e entrevista
          </p>
        </Card>
        <Card title="Resultados finais">
          <p className="font-serif text-3xl font-bold text-primary">
            {summary.applications.finalized}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {summary.applications.approved} aprovados ·{" "}
            {summary.applications.rejected} reprovados
          </p>
        </Card>
      </div>
    </section>
  );
}
