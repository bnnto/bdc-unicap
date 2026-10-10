type CardProps = {
  title: string;
  accent?: "primary" | "secondary";
  /** Nível do título (h2 por padrão; ajuste para não saltar níveis — [S8-2]). */
  headingLevel?: 2 | 3 | 4;
  children: React.ReactNode;
};

/**
 * Card de superfície nível 1 (DESIGN.md): borda sutil, sombra level1 e
 * acento institucional bordô/dourado na borda esquerda. [S8-2]: o nível
 * do título é configurável para preservar a hierarquia sem saltos (1.3.1).
 */
export function Card({ title, accent, headingLevel = 2, children }: CardProps) {
  const accentClass =
    accent === "primary"
      ? "border-l-primary"
      : accent === "secondary"
        ? "border-l-secondary"
        : "";
  const Heading = `h${headingLevel}` as "h2";

  return (
    <section
      data-testid="card"
      className={`rounded-xl border border-slate-200 bg-white shadow-level1 transition-all duration-300 ease-in-out hover:-translate-y-0.5 hover:shadow-level2 ${accentClass ? `border-l-4 ${accentClass}` : ""}`}
    >
      <Heading className="font-serif text-lg font-bold text-primary">
        {title}
      </Heading>
      <div className="mt-2">{children}</div>
    </section>
  );
}
