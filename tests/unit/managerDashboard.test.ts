import { describe, expect, it } from "vitest";
import {
  buildManagerKpis,
  buildSkillsRadar,
  countRejectionReasons,
  employabilityByCourseRows,
  engagementCounts,
  partnerCompanyRows,
  partnerStatus,
  rejectionShare,
  skillDemandCounts,
  skillSupplyCounts,
} from "../../src/lib/managerDashboard";

/**
 * [REFACTOR_GESTOR] Etapa 4 — Painel Estratégico de Carreiras &
 * Empregabilidade. Regra pura que consolida os KPIs (dados reais quando
 * disponíveis) e os Insights Estratégicos.
 *
 * [GESTOR_BACKEND] — as agregações dos Insights Estratégicos (motivos de
 * reprovação, radar de competências demanda×oferta e engajamento) são
 * regras puras testadas aqui e executadas NO SERVIDOR pelas queries de
 * convex/manager.ts — a UI apenas exibe o que o banco responde.
 */
describe("REFACTOR_GESTOR — KPIs do Painel Estratégico", () => {
  it("consolida os 4 KPIs com os valores informados", () => {
    const kpis = buildManagerKpis({
      openJobs: 12,
      employabilityRate: 64,
      timeToHireDays: 21,
      availableTalents: 148,
    });
    expect(kpis.oportunidades.value).toBe(12);
    expect(kpis.oportunidades.label).toContain("Vagas ativas");
    expect(kpis.empregabilidade).toEqual({ value: "64%", hasData: true });
    expect(kpis.tempoContratacao).toEqual({
      value: "21",
      hasData: true,
      unit: "dias",
    });
    expect(kpis.talentos.value).toBe(148);
    expect(kpis.talentos.label).toContain("perfil ativo");
  });

  it("métricas sem amostra exibem — (sem mascarar a falta de dados)", () => {
    const kpis = buildManagerKpis({
      openJobs: 0,
      employabilityRate: null,
      timeToHireDays: null,
      availableTalents: 0,
    });
    expect(kpis.empregabilidade).toEqual({ value: "—", hasData: false });
    expect(kpis.tempoContratacao).toEqual({
      value: "—",
      hasData: false,
      unit: "dias",
    });
  });
});

describe("REFACTOR_GESTOR — status de empresa parceira", () => {
  it("com contratados no período → ativa", () => {
    expect(partnerStatus(5, 12)).toBe("ativa");
  });

  it("com vagas publicadas mas sem contratação → em_negociacao", () => {
    expect(partnerStatus(0, 8)).toBe("em_negociacao");
  });

  it("sem vagas e sem contratação → inativa", () => {
    expect(partnerStatus(0, 0)).toBe("inativa");
  });
});

describe("REFACTOR_GESTOR — distribuição dos motivos de reprovação (R5)", () => {
  it("calcula percentuais e ordena do maior para o menor", () => {
    const shares = rejectionShare([
      { reason: "requisitos_obrigatorios", count: 18 },
      { reason: "idioma_insuficiente", count: 9 },
      { reason: "formacao_incompativel", count: 11 },
    ]);
    expect(shares.map((s) => s.reason)).toEqual([
      "requisitos_obrigatorios",
      "formacao_incompativel",
      "idioma_insuficiente",
    ]);
    expect(shares[0]?.percent).toBe(47); // 18/38
    expect(shares[1]?.percent).toBe(29); // 11/38
    expect(shares[2]?.percent).toBe(24); // 9/38
  });

  it("base vazia retorna lista vazia (sem NaN)", () => {
    expect(rejectionShare([])).toEqual([]);
  });
});

describe("[GESTOR_BACKEND] — contagem dos motivos de reprovação", () => {
  it("conta apenas candidaturas reprovadas, agrupadas por motivo", () => {
    const counts = countRejectionReasons([
      { stage: "reprovado", rejectionReason: "requisitos_obrigatorios" },
      { stage: "reprovado", rejectionReason: "requisitos_obrigatorios" },
      { stage: "reprovado", rejectionReason: "idioma_insuficiente" },
      { stage: "aprovado", rejectionReason: null },
      { stage: "triagem", rejectionReason: null },
      { stage: "inscrito", rejectionReason: null },
    ]);
    expect(counts).toEqual([
      { reason: "requisitos_obrigatorios", count: 2 },
      { reason: "idioma_insuficiente", count: 1 },
    ]);
  });

  it("reprovado sem motivo gravado cai em 'outro' (defensivo, R5)", () => {
    const counts = countRejectionReasons([
      { stage: "reprovado", rejectionReason: null },
      { stage: "reprovado" },
    ]);
    expect(counts).toEqual([{ reason: "outro", count: 2 }]);
  });

  it("ignora motivo presente em etapa que não é reprovado", () => {
    const counts = countRejectionReasons([
      { stage: "aprovado", rejectionReason: "outro" },
      { stage: "triagem", rejectionReason: "outro" },
    ]);
    expect(counts).toEqual([]);
  });

  it("base sem reprovados retorna lista vazia", () => {
    expect(
      countRejectionReasons([{ stage: "inscrito", rejectionReason: null }]),
    ).toEqual([]);
  });
});

describe("[GESTOR_BACKEND] — demanda de competências (vagas)", () => {
  it("conta quantas vagas pedem cada competência (exigida ou não)", () => {
    const demand = skillDemandCounts([
      {
        prerequisites: [
          { item: "React", required: true },
          { item: "SQL", required: false },
        ],
      },
      { prerequisites: [{ item: "React", required: true }] },
    ]);
    expect(demand).toEqual([
      { skill: "React", demand: 2 },
      { skill: "SQL", demand: 1 },
    ]);
  });

  it("competência repetida na mesma vaga conta uma única vez", () => {
    const demand = skillDemandCounts([
      {
        prerequisites: [
          { item: "React", required: true },
          { item: "React", required: false },
        ],
      },
    ]);
    expect(demand).toEqual([{ skill: "React", demand: 1 }]);
  });

  it("case-insensitive e ignora itens vazios", () => {
    const demand = skillDemandCounts([
      {
        prerequisites: [
          { item: "  react  ", required: true },
          { item: "   ", required: true },
        ],
      },
      { prerequisites: [{ item: "React", required: true }] },
    ]);
    expect(demand).toEqual([{ skill: "React", demand: 2 }]);
  });
});

describe("[GESTOR_BACKEND] — oferta de competências (alunos)", () => {
  it("conta em quantos perfis cada competência aparece", () => {
    const supply = skillSupplyCounts([
      { skills: ["React", "SQL"] },
      { skills: ["React"] },
    ]);
    expect(supply).toEqual([
      { skill: "React", supply: 2 },
      { skill: "SQL", supply: 1 },
    ]);
  });

  it("aluno sem competências não contribui; duplicata conta uma vez", () => {
    const supply = skillSupplyCounts([
      { skills: undefined },
      { skills: [] },
      { skills: ["react", "React"] },
    ]);
    expect(supply).toEqual([{ skill: "react", supply: 1 }]);
  });
});

describe("[GESTOR_BACKEND] — radar de competências (demanda × oferta)", () => {
  it("mescla demanda e oferta case-insensitive, mantendo rótulo da demanda", () => {
    const radar = buildSkillsRadar(
      [{ skill: "React", demand: 3 }],
      [{ skill: "react", supply: 2 }],
    );
    expect(radar).toEqual([{ skill: "React", demand: 3, supply: 2 }]);
  });

  it("ordena por demanda desc; empate resolve por oferta desc", () => {
    const radar = buildSkillsRadar(
      [
        { skill: "SQL", demand: 5 },
        { skill: "React", demand: 5 },
        { skill: "Python", demand: 9 },
      ],
      [
        { skill: "React", supply: 1 },
        { skill: "SQL", supply: 4 },
      ],
    );
    expect(radar.map((r) => r.skill)).toEqual(["Python", "SQL", "React"]);
    expect(radar.find((r) => r.skill === "React")).toEqual({
      skill: "React",
      demand: 5,
      supply: 1,
    });
  });

  it("skill só pedida pelas vagas aparece com oferta zero (maior gargalo)", () => {
    const radar = buildSkillsRadar(
      [{ skill: "Power BI", demand: 7 }],
      [{ skill: "React", supply: 3 }],
    );
    expect(radar).toEqual([
      { skill: "Power BI", demand: 7, supply: 0 },
      { skill: "React", demand: 0, supply: 3 },
    ]);
  });

  it("limita ao Top N (padrão 6) após a ordenação", () => {
    const demand = ["A", "B", "C", "D", "E", "F", "G"].map((skill, i) => ({
      skill,
      demand: 10 - i,
    }));
    const radar = buildSkillsRadar(demand, [], 6);
    expect(radar).toHaveLength(6);
    expect(radar.map((r) => r.skill)).toEqual(["A", "B", "C", "D", "E", "F"]);
  });

  it("sem dados retorna lista vazia", () => {
    expect(buildSkillsRadar([], [])).toEqual([]);
  });
});

describe("[GESTOR_BACKEND] — engajamento (R1: inativo nunca conta)", () => {
  it("total cobre apenas alunos com vínculo (ativo/egresso)", () => {
    const metrics = engagementCounts([
      { status: "ativo", skills: ["React"], resumeData: { headline: "Dev" } },
      { status: "egresso", skills: ["SQL"] },
      { status: "inativo", skills: [] },
    ]);
    expect(metrics).toEqual({ total: 2, incompleteProfiles: 0, noResume: 1 });
  });

  it("perfil incompleto = sem competências registradas", () => {
    const metrics = engagementCounts([
      { status: "ativo", skills: [] },
      { status: "ativo", skills: undefined },
      { status: "ativo", skills: ["React"] },
    ]);
    expect(metrics.incompleteProfiles).toBe(2);
    expect(metrics.total).toBe(3);
  });

  it("sem currículo = resumeData ausente (mesmo com skills)", () => {
    const metrics = engagementCounts([
      { status: "ativo", skills: ["React"] },
      { status: "ativo", skills: ["React"], resumeData: { headline: "x" } },
    ]);
    expect(metrics.noResume).toBe(1);
  });

  it("todos inativos → zeros em tudo", () => {
    const metrics = engagementCounts([
      { status: "inativo" },
      { status: "inativo", skills: ["React"] },
    ]);
    expect(metrics).toEqual({ total: 0, incompleteProfiles: 0, noResume: 0 });
  });
});

describe("[GESTOR_BACKEND_PT2] — empregabilidade por curso", () => {
  it("taxa = alunos do curso com aprovação / total do curso, arredondada", () => {
    const rows = employabilityByCourseRows([
      { course: "Ciência da Computação", approved: true },
      { course: "Ciência da Computação", approved: false },
      { course: "Ciência da Computação", approved: false },
      { course: "Direito", approved: false },
    ]);
    expect(rows).toEqual([
      {
        course: "Ciência da Computação",
        total: 3,
        approved: 1,
        percent: 33,
      },
      { course: "Direito", total: 1, approved: 0, percent: 0 },
    ]);
  });

  it("várias aprovações do mesmo aluno contam uma vez no numerador", () => {
    const rows = employabilityByCourseRows([
      { course: "Direito", approved: true },
      { course: "Direito", approved: true },
      { course: "Direito", approved: false },
    ]);
    expect(rows).toEqual([
      { course: "Direito", total: 3, approved: 2, percent: 67 },
    ]);
  });

  it("ordenada da maior taxa para a menor, empate alfabético", () => {
    const rows = employabilityByCourseRows([
      { course: "Z Academia", approved: true },
      { course: "A Letras", approved: true },
      { course: "A Letras", approved: false },
      { course: "M Medicina", approved: false },
    ]);
    expect(rows.map((r) => r.course)).toEqual([
      "Z Academia",
      "A Letras",
      "M Medicina",
    ]);
    expect(rows.map((r) => r.percent)).toEqual([100, 50, 0]);
  });

  it("sem alunos → lista vazia", () => {
    expect(employabilityByCourseRows([])).toEqual([]);
  });
});

describe("[GESTOR_BACKEND_PT2] — agregação de empresas parceiras", () => {
  it("agrupa por recrutador e ordena por contratados desc", () => {
    const rows = partnerCompanyRows(
      [
        { userId: "u1", companyName: "Alpha Tech" },
        { userId: "u2", companyName: "Beta Consultoria" },
      ],
      [
        { recruiterId: "u2", hiredCount: 0 },
        { recruiterId: "u2", hiredCount: 0 },
        { recruiterId: "u1", hiredCount: 3 },
      ],
    );
    expect(rows).toEqual([
      {
        recruiterId: "u1",
        companyName: "Alpha Tech",
        published: 1,
        hired: 3,
      },
      {
        recruiterId: "u2",
        companyName: "Beta Consultoria",
        published: 2,
        hired: 0,
      },
    ]);
  });

  it("recrutador só com conta criada aparece com zeros (status inativa)", () => {
    const rows = partnerCompanyRows(
      [{ userId: "u1", companyName: "Gama Mídia" }],
      [],
    );
    expect(rows).toEqual([
      {
        recruiterId: "u1",
        companyName: "Gama Mídia",
        published: 0,
        hired: 0,
      },
    ]);
    expect(partnerStatus(rows[0]!.hired, rows[0]!.published)).toBe("inativa");
  });

  it("empate de contratados resolve por vagas publicadas desc", () => {
    const rows = partnerCompanyRows(
      [
        { userId: "u1", companyName: "Alpha Tech" },
        { userId: "u2", companyName: "Beta Consultoria" },
      ],
      [
        { recruiterId: "u1", hiredCount: 2 },
        { recruiterId: "u2", hiredCount: 2 },
        { recruiterId: "u2", hiredCount: 0 },
      ],
    );
    expect(rows.map((r) => r.companyName)).toEqual([
      "Beta Consultoria",
      "Alpha Tech",
    ]);
  });

  it("sem recrutadores → lista vazia", () => {
    expect(partnerCompanyRows([], [])).toEqual([]);
  });
});
