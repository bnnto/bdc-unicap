import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Card } from "../ui/card";
import {
  EXTENSION_AREAS,
  EXTENSION_AREA_LABELS,
  type ExtensionArea,
} from "../../lib/extensionProject";
import {
  countByArea,
  filterProjectsForDashboard,
  hasActiveExtensionFilters,
  normalizeExtensionFilters,
  summarizeProjects,
} from "../../lib/extensionDashboard";

/**
 * [S7-4] Painel gestor de extensão — métricas e filtros (issue #37).
 *
 * CA 1 — contagens por área/status (KPIs + barras temáticas); CA 2 —
 * filtros COMBINÁVEIS (área, status, período) que atualizam todas as
 * métricas reativamente: cada mudança refina a mesma fonte `listProjects`
 * (guard R7, subscription reativa do Convex) com as regras puras da
 * S7-4 — o mesmo padrão do Painel Operacional da S5, para consistência
 * visual e de comportamento (KPI cards, barras, "Limpar filtros").
 */

const DAY = 24 * 60 * 60 * 1000;

const PERIOD_OPTIONS = [
  { value: "", label: "Todo o período" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "365", label: "Últimos 12 meses" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "ativo", label: "Ativos" },
  { value: "inativo", label: "Não ativos" },
] as const;

const SELECT_CLASS =
  "rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1";

type KpiCardProps = {
  testId: string;
  value: number;
  label: string;
  hint?: string;
};

function KpiCard({ testId, value, label, hint }: KpiCardProps) {
  return (
    <div
      data-testid={testId}
      className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-level1"
    >
      <p className="font-serif text-3xl font-bold text-primary">{value}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {hint !== undefined ? (
        <p className="mt-0.5 text-xs text-a11y-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function ExtensionDashboard() {
  // [S7-4] Estado dos filtros combináveis — compartilhado por todas as
  // métricas do painel (padrão da barra global da S5-5).
  const [area, setArea] = useState("");
  const [status, setStatus] = useState("");
  const [period, setPeriod] = useState("");

  const projects = useQuery(api.extensionProjects.listProjects, {});

  const filters = useMemo(
    () =>
      normalizeExtensionFilters({
        area,
        status,
        from: period !== "" ? Date.now() - Number(period) * DAY : undefined,
      }),
    [area, status, period],
  );
  const filtersActive = hasActiveExtensionFilters(filters);

  if (projects === undefined) {
    return (
      <div
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-level1"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-slate-500">Carregando painel de extensão…</p>
      </div>
    );
  }

  const filtered = filterProjectsForDashboard(projects, filters);
  const summary = summarizeProjects(filtered);
  const byArea = countByArea(filtered);
  const maxArea = Math.max(1, ...Object.values(byArea));
  const visibleAreas = Object.entries(byArea).filter(([, count]) => count > 0);

  // [S8-2]: role=region explícito — o main da página é único, no App (1.3.1).
  return (
    <section
      data-testid="extension-dashboard"
      role="region"
      aria-label="Painel de extensão"
    >
      {/* [S8-2]: div (não header) — evita banner aninhado dentro do main. */}
      <div className="mb-4">
        <p className="font-serif text-xs uppercase tracking-widest text-a11y-secondary">
          Setor de Extensão
        </p>
        <h2 className="font-serif text-2xl font-bold text-primary">
          Painel de Extensão
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Projetos cadastrados, status de divulgação e distribuição por área
          temática — atualizado em tempo real com o banco do portal.
        </p>
      </div>

      <section
        aria-label="Filtros do painel de extensão"
        className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-level1"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-serif text-sm font-bold uppercase tracking-wide text-primary">
            Filtros
          </h3>
          {filtersActive ? (
            <button
              type="button"
              data-testid="clear-extension-filters"
              onClick={() => {
                setArea("");
                setStatus("");
                setPeriod("");
              }}
              className="rounded border border-primary px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-[#FDF2F4] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
            >
              Limpar filtros
            </button>
          ) : (
            <span className="text-xs text-a11y-slate-500">
              aplicam-se a todas as métricas
            </span>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Área
            </span>
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Todas as áreas</option>
              {EXTENSION_AREAS.map((a) => (
                <option key={a} value={a}>
                  {EXTENSION_AREA_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Status do projeto
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={SELECT_CLASS}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Período de criação
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
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          testId="kpi-total"
          value={summary.total}
          label="Total de projetos"
          hint="no filtro atual"
        />
        <KpiCard
          testId="kpi-ativo"
          value={summary.ativo}
          label="Projetos ativos"
          hint="divulgados publicamente (R9)"
        />
        <KpiCard
          testId="kpi-inativo"
          value={summary.inativo}
          label="Não ativos"
          hint="ocultos da divulgação"
        />
        <KpiCard
          testId="kpi-areas"
          value={summary.areasWithProjects}
          label="Áreas com projetos"
          hint={`de ${EXTENSION_AREAS.length} áreas temáticas`}
        />
      </div>

      <section className="mt-3" aria-label="Projetos por área temática">
        <Card title="Projetos por área temática" accent="secondary">
          {visibleAreas.length === 0 ? (
            <p className="text-sm text-slate-600">
              Nenhum projeto no filtro atual. Ajuste os filtros ou cadastre
              novos projetos de extensão.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {visibleAreas.map(([areaKey, count]) => (
                <li key={areaKey} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 text-xs font-semibold text-slate-700">
                    {EXTENSION_AREA_LABELS[areaKey as ExtensionArea]}
                  </span>
                  <div
                    className="h-7 flex-1 overflow-hidden rounded bg-slate-100"
                    aria-hidden="true"
                  >
                    <div
                      data-testid={`area-bar-${areaKey}`}
                      className="flex h-full items-center justify-end rounded bg-primary px-2 text-xs font-semibold text-white"
                      style={{
                        width: `${Math.max(
                          count === 0 ? 0 : 8,
                          (count / maxArea) * 100,
                        )}%`,
                      }}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </div>
                  <span
                    className="w-8 shrink-0 text-right text-sm font-bold text-primary"
                    aria-label={`${count} projetos em ${
                      EXTENSION_AREA_LABELS[areaKey as ExtensionArea]
                    }`}
                  >
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </section>
  );
}
