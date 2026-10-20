import { describe, expect, it } from "vitest";
import { reviewJobContent } from "../../src/lib/jobModeration";

const base = {
  title: "Estágio em Desenvolvimento Web",
  description: "Apoio no desenvolvimento de aplicações web com mentoria.",
  contractType: "estagio",
};

describe("reviewJobContent", () => {
  it("vaga normal passa", () => {
    expect(reviewJobContent(base).verdict).toBe("ok");
  });
  it("bloqueia cobrança de taxa", () => {
    const r = reviewJobContent({
      ...base,
      description: "Vaga com taxa de inscrição de R$ 50 para o material.",
    });
    expect(r.verdict).toBe("bloqueada");
  });
  it("WhatsApp e link vão para revisão", () => {
    expect(
      reviewJobContent({ ...base, description: "Chame no WhatsApp para saber mais." })
        .verdict,
    ).toBe("revisao");
    expect(
      reviewJobContent({ ...base, description: "Inscreva-se em https://site.com/vaga" })
        .verdict,
    ).toBe("revisao");
  });
  it("bolsa de estágio muito alta vai para revisão", () => {
    expect(reviewJobContent({ ...base, salaryMax: 9000 }).verdict).toBe("revisao");
  });
});