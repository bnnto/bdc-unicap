import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "../ui/card";
import { formatEmployabilityRate } from "../../lib/operationalPanel";

/**
 * Painel Operacional (issues [S5-1] e [S5-2]).
 * Cards com totais de vagas por status, taxa de empregabilidade e
 * Time-to-Hire médio com filtros — TODOS os números vêm das queries
 * agregadas no servidor (consistentes com o banco); a UI apenas exibe
 * e aplica os filtros.
 */

const DAY = 24 * 60 * 60 * 1000;

const PERIOD_OPTIONS = [
  { value: "", label: "Todo o período" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
] as const;

const SELECT_CLASS =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15";

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

/**
 * [S5-2] CA 2 — Time-to-Hire médio com filtros de período, curso e
 * empresa. Os filtros são argumentos da query: a agregação acontece
 * no servidor sobre os dados filtrados (CA 1).
 */
function TimeToHireSection() {
  const [period, setPeriod] = useState<string>("");
  const [course, setCourse] = useState<string>("");
  const [company, setCompany] = useState<string>("");

  const stats = useQuery(api.operational.timeToHireStats, {
    from: period !== "" ? Date.now() - Number(period) * DAY : undefined,
    course: course !== "" ? course : undefined,
    company: company !== "" ? company : undefined,
  });

  return (
    <section
      data-testid="time-to-hire"
      className="mt-3"
      aria-label="Time to hire"
    >
      <Card title="Time-to-Hire médio" accent="secondary">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Período
            </span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className={SELECT_CLASS}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Curso
            </span>
            <select
              value={course}
              onChange={(e) => setCourse(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Todos os cursos</option>
              {(stats?.facets.courses ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Empresa
            </span>
            <select
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Todas as empresas</option>
              {(stats?.facets.companies ?? []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 flex items-baseline gap-3">
          <p className="font-serif text-3xl font-bold text-primary">
            {stats === undefined ? "…" : stats.label}
          </p>
          <p className="text-xs text-slate-500">
            {stats === undefined
              ? "calculando…"
              : stats.samplesCount === 0
                ? "sem contratações no filtro selecionado"
                : `${stats.samplesCount} ${stats.samplesCount === 1 ? "contratação" : "contratações"} no filtro`}
          </p>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Média de dias entre a candidatura do contratado e o preenchimento da
          vaga.
        </p>
      </Card>
    </section>
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

      <TimeToHireSection />
    </section>
  );
}
