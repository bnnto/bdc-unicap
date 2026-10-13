/**
 * [REFATORACAO_UI] As 5 Regras de Ouro de UI — varredura de TODO o código.
 *
 * Testes de leitura de fonte (padrão já usado em a11yLandmarks): cada
 * ofensor é reportado com `ficheiro:linha` para corrigir sem caça ao erro.
 *
 *  REGRA 1 — nenhum `<select>` usa a seta nativa: todos usam o dropdown
 *            SVG padronizado (appearance-none + data-URL + pr-10);
 *  REGRA 2 — Button alinhado a Input/labels: container `items-start`
 *            (nunca `items-end` junto de `<Input>`) + botão com
 *            `h-10 shrink-0` (e `mt-6` para saltar a label);
 *  REGRA 3 — `border-l-4` existe só no Card partilhado e só com a cor
 *            Bordô (`primary`); sem acentos "secondary" (faixa cinza/dourada
 *            sem remapeamento no dark mode = bagaça visual);
 *  REGRA 4 — todo botão de ação e todo título de secção estático traz
 *            ícone lucide acompanhando a cor do texto;
 *  REGRA 5 — containers com borda/sombra de card usam p-6/p-8 (nada de
 *            p-4/p-5 sufocados) e botões de "Adicionar" têm folga
 *            (mt-* ou contexto gap-*).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx)$/.test(name)) out.push(path);
  }
  return out;
}

const files = walk(SRC);
const sources = new Map(files.map((f) => [f, readFileSync(f, "utf8")]));

/** Nome curto do ficheiro para as mensagens de falha. */
function rel(path: string): string {
  return relative(SRC, path);
}

/** Linha (1-based) de um índice no conteúdo. */
function lineOf(src: string, index: number): number {
  return src.slice(0, index).split("\n").length;
}

/**
 * Extrai o `className` de um elemento a partir de `from`:
 * string literal, template OU constante (`className={SELECT_CLASS}`).
 */
function classNameAt(src: string, from: number): string | null {
  // Janela generosa: o className do elemento pode vir depois de attrs
  // longos (onChange multiline, data-URLs) — o padrão SVG tem ~600 chars.
  const window = src.slice(from, from + 1600);
  const m =
    /className=(?:"([^"]*)"|\{\s*`([\s\S]*?)`\s*\}|\{\s*([A-Z][A-Z0-9_]*)\s*\})/.exec(
      window,
    );
  if (!m) return null;
  if (m[1] !== undefined) return m[1];
  if (m[2] !== undefined) return m[2];
  const def = new RegExp(`const ${m[3]}\\s*=\\s*"([^"]*)"`).exec(src);
  return def?.[1] ?? null;
}

/** Índices de todas as ocorrências de `pattern`. */
function allIndexes(src: string, pattern: RegExp): number[] {
  const out: number[] = [];
  const re = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g",
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m.index);
  return out;
}

/** Border "de container" (larga): `border`, `border-2`… — não `border-t/l/…`. */
const FULL_BORDER = /(^|\s)border(\s|-[234](\s|$))/;
/** Container com `rounded` de caixa (não pílula `rounded-full`). */
const BOX_ROUNDED = /(^|\s)rounded(\s|-(sm|md|lg|xl|2xl|3xl)(\s|$))/;

describe("REGRA 1 — todo <select> usa o dropdown SVG (sem seta nativa)", () => {
  const MARKS = ["appearance-none", "data:image/svg+xml", "pr-10"];

  it("varre src: nenhum select com a seta do navegador", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, /<select\b/g)) {
        const cls = classNameAt(src, i);
        const where = `${rel(path)}:${lineOf(src, i)}`;
        if (cls === null) {
          ofensores.push(`${where} :: className não resolvível`);
          continue;
        }
        const missing = MARKS.filter((mark) => !cls.includes(mark));
        if (missing.length > 0) {
          ofensores.push(`${where} :: sem ${missing.join(", ")}`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });
});

describe("REGRA 2 — alinhamento Button ao lado de Input (forms)", () => {
  it("não existe o typo items-starts (era items-start)", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, /items-starts/g)) {
        ofensores.push(`${rel(path)}:${lineOf(src, i)}`);
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("items-end nunca fica na vizinhança de <Input> (botão estica/desalinha)", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, /\bitems-end\b/g)) {
        const window = src.slice(i, i + 1400);
        if (window.includes("<Input")) {
          ofensores.push(`${rel(path)}:${lineOf(src, i)}`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("padrão dourado mt-6 h-10 shrink-0 aplicado nos wrappers conhecidos", () => {
    // JobForm (referência da main) e ResumeForm: botão pula a label do Input.
    for (const f of [
      "components/recruiter/JobForm.tsx",
      "components/student/ResumeForm.tsx",
      "components/manager/ManagerDashboard.tsx",
    ]) {
      const src = sources.get(join(SRC, f));
      expect(src, `${f} sem o padrão mt-6 h-10 shrink-0`).toContain(
        "mt-6 h-10 shrink-0",
      );
    }
    // Formulário do aluno: botão junto de input/select sem label visível.
    expect(
      sources.get(join(SRC, "components/student/StudentProfileForm.tsx")),
      "StudentProfileForm sem h-10 shrink-0 no botão alinhado",
    ).toContain("h-10 shrink-0");
  });
});

describe("REGRA 3 — limpeza de bordas laterais (cards)", () => {
  it('nenhum acento accent="secondary" (faixa não-bordô) no projeto', () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      if (src.includes('accent="secondary"')) ofensores.push(rel(path));
    }
    expect(ofensores).toEqual([]);
  });

  it("border-l-4 existe apenas no Card partilhado (sistema de acento)", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      if (src.includes("border-l-4") && !path.endsWith("ui/card.tsx")) {
        ofensores.push(rel(path));
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("o acento do Card é só bordô (border-l-primary)", () => {
    const card = sources.get(join(SRC, "components/ui/card.tsx"));
    expect(card).toBeDefined();
    expect(card).not.toContain("border-l-secondary");
  });

  it("ProfilePage (ajustes/privacidade) não tem faixas laterais", () => {
    const page = sources.get(join(SRC, "components/profile/ProfilePage.tsx"));
    expect(page).toBeDefined();
    expect(page).not.toContain("accent=");
  });

  it("OperationalPanel: faixa bordô só no Funil de Conversão", () => {
    const src = sources.get(
      join(SRC, "components/operational/OperationalPanel.tsx"),
    );
    expect(src).toBeDefined();
    const lines = (src as string)
      .split("\n")
      .filter((line) => line.includes("accent="));
    expect(
      lines,
      "faixas laterais no Painel Operacional devem ser só o Funil",
    ).toHaveLength(1);
    expect(lines[0]).toContain("Funil de Conversão");
  });
});

describe("REGRA 4 — ícones lucide em botões de ação e títulos de secção", () => {
  it("todo <Button> do projeto tem ícone no conteúdo", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, /<Button\b/g)) {
        const open = src.indexOf(">", i);
        const close = src.indexOf("</Button>", i);
        if (open < 0 || close < 0 || close < open) {
          ofensores.push(
            `${rel(path)}:${lineOf(src, i)} :: sem conteúdo (self-closing?)`,
          );
          continue;
        }
        const body = src.slice(open + 1, close);
        // Ícone = JSX lucide OU mapa de ícones por constante (`STATUS_BUTTON_ICON[...]`).
        const hasIcon =
          /<[A-Z][A-Za-z0-9]*\b/.test(body) || /\{[A-Z][A-Z0-9_]*\[/.test(body);
        if (!hasIcon) {
          const text = body.replace(/\s+/g, " ").trim().slice(0, 40);
          ofensores.push(`${rel(path)}:${lineOf(src, i)} :: ${text}`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("títulos de secção estáticos (h2/h3) têm ícone lucide", () => {
    const SCOPED = new Set([
      "manager",
      "operational",
      "profile",
      "recruiter",
      "talent",
      "student",
    ]);
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      const parts = relative(SRC, path).split(/[\\/]/);
      if (parts[0] !== "components") continue;
      if (!SCOPED.has(parts[1] ?? "")) continue;
      for (const i of allIndexes(src, /<h([23])\b/g)) {
        const level = src.slice(i).match(/^<h([23])\b/)?.[1] ?? "";
        const open = src.indexOf(">", i);
        const close = src.indexOf(`</h${level}`, i);
        if (open < 0 || close < 0) continue;
        const body = src.slice(open + 1, close);
        // Títulos dinâmicos ({expr}) ou com expressões condicionais ficam de fora.
        if (body.includes("{")) continue;
        if (!/<[A-Z][A-Za-z0-9]*\b/.test(body)) {
          const text = body.replace(/\s+/g, " ").trim().slice(0, 50);
          ofensores.push(`${rel(path)}:${lineOf(src, i)} :: ${text}`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });
});

describe("REGRA 5 — respiro: p-6/p-8 em containers com borda", () => {
  const TAGS =
    "div|section|form|aside|fieldset|article|ul|li|main|header|nav|footer";

  it("containers card/panel (borda + sombra ou tag semântica) com p-6/p-8", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, new RegExp(`<(${TAGS})\\b`, "g"))) {
        const tag = src.slice(i + 1).match(new RegExp(`^(${TAGS})\\b`))?.[1];
        if (!tag) continue;
        const cls = classNameAt(src, i);
        if (cls === null) continue;
        if (!FULL_BORDER.test(cls)) continue;
        if (cls.includes("rounded-full")) continue;
        // Card full-bleed (cabeçalho gradiente sangra até à borda) — o
        // respiro vive no conteúdo interno, não no wrapper.
        if (cls.includes("overflow-hidden")) continue;
        const cardish =
          /shadow-level\d/.test(cls) ||
          ["section", "form", "aside", "fieldset"].includes(tag);
        if (!cardish) continue;
        const padded =
          /(^|\s)p-6(\s|$)|(^|\s)p-8(\s|$)/.test(cls) ||
          (/(^|\s)px-6(\s|$)/.test(cls) && /(^|\s)py-6(\s|$)/.test(cls)) ||
          (/(^|\s)px-8(\s|$)/.test(cls) && /(^|\s)py-8(\s|$)/.test(cls));
        if (!padded) {
          ofensores.push(
            `${rel(path)}:${lineOf(src, i)} :: <${tag}> sem p-6/p-8 :: ${cls
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 90)}`,
          );
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("p-4/p-5 banidos em caixas arredondadas com borda (sufocam o layout)", () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, new RegExp(`<(${TAGS})\\b`, "g"))) {
        const cls = classNameAt(src, i);
        if (cls === null) continue;
        if (!FULL_BORDER.test(cls)) continue;
        if (!BOX_ROUNDED.test(cls)) continue;
        if (/(^|\s)p-[45](\s|$)/.test(cls)) {
          ofensores.push(
            `${rel(path)}:${lineOf(src, i)} :: ${cls
              .replace(/\s+/g, " ")
              .trim()
              .slice(0, 90)}`,
          );
        }
      }
    }
    expect(ofensores).toEqual([]);
  });

  it('botões "Adicionar" no fim de lista têm folga (mt-* ou gap-*)', () => {
    const ofensores: string[] = [];
    for (const [path, src] of sources) {
      for (const i of allIndexes(src, /<Button\b/g)) {
        const open = src.indexOf(">", i);
        const close = src.indexOf("</Button>", i);
        if (open < 0 || close < 0) continue;
        const body = src.slice(open + 1, close);
        if (!/\bAdicione|\bAdicionar\b/.test(body)) continue;
        const btnCls = classNameAt(src, i) ?? "";
        if (/(^|\s)mt-\d+(\s|$)/.test(btnCls)) continue;
        // Folga = o container que envolve o botão (fieldset/div/section
        // imediatamente anterior) usa gap-* — o botão nunca cola ao item.
        const before = src.slice(Math.max(0, i - 2500), i);
        const openTag = before.lastIndexOf("<fieldset");
        const container = Math.max(
          openTag,
          before.lastIndexOf("<div"),
          before.lastIndexOf("<section"),
        );
        const wrapper = container >= 0 ? before.slice(container) : before;
        if (!/\bgap-\d+/.test(wrapper)) {
          ofensores.push(`${rel(path)}:${lineOf(src, i)} :: sem folga`);
        }
      }
    }
    expect(ofensores).toEqual([]);
  });
});
