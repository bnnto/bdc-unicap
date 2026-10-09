type BadgeVariant = "aprovado" | "triagem" | "reprovado" | "andamento";

type BadgeProps = {
  variant: BadgeVariant;
  children: React.ReactNode;
};

/**
 * Pares de cor dos status conforme DESIGN.md (tints claros + texto escuro),
 * todos com contraste AA auditado pelos testes de contraste (S0-4).
 */
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  aprovado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  triagem: "bg-amber-50 text-amber-800 border-amber-200",
  reprovado: "bg-red-50 text-red-800 border-red-200",
  andamento: "bg-blue-50 text-blue-800 border-blue-200",
};

/**
 * Badge de status do pipeline/matching — estética editorial estruturada
 * (raio 4px, não pill) conforme DESIGN.md.
 */
export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors duration-200 ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
