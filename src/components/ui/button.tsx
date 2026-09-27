type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "accent" | "danger";
};

const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  // Bordô institucional — hover #520F1D, foco com halo dourado (DESIGN.md)
  primary:
    "bg-primary text-white hover:bg-[#520F1D] focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
  // Contorno bordô sobre branco — hover #FDF2F4 (DESIGN.md)
  secondary:
    "border border-primary bg-white text-primary hover:bg-[#FDF2F4] focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
  // Dourado premium com texto escuro — contraste AA auditado em S0-4
  accent:
    "bg-secondary text-slate-900 hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  // [UX-P3] H8-2 — ações destrutivas se destacam (contorno vermelho)
  danger:
    "border border-danger bg-white text-danger hover:bg-[#FEF2F2] focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-2",
};

/**
 * Botão do Design System UNICAP — raio 4px e variantes institucionais.
 * Foco visível garantido (WCAG, CEREBRO.md §6.3).
 */
export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`rounded border-transparent px-4 py-2 font-sans text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}
