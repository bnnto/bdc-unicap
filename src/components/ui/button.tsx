type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "accent" | "danger";
};

/*
 * Todos os `hover:` ficam atrás de `(hover:hover) and (pointer:fine)` para
 * não "grudar" no toque (mesmo padrão do AuthPage). Fundos claros fixos
 * ganham variante `dark:` para não estourar no modo escuro.
 */
const VARIANT_CLASSES: Record<NonNullable<ButtonProps["variant"]>, string> = {
  // Bordô institucional — hover #520F1D; foco com anel bordô AA ([S8-2],
  // WCAG 1.4.11: o dourado puro sobre claro não atinge 3:1)
  primary:
    "bg-primary text-white [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#520F1D] focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  // Contorno bordô sobre branco — hover #FDF2F4 (DESIGN.md)
  secondary:
    "border border-primary bg-white text-primary [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#FDF2F4] [@media(hover:hover)_and_(pointer:fine)]:dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  // Dourado premium com texto escuro — contraste AA auditado em S0-4
  accent:
    "bg-secondary text-slate-900 [@media(hover:hover)_and_(pointer:fine)]:hover:brightness-95 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
  // [UX-P3] H8-2 — ações destrutivas se destacam (contorno vermelho)
  danger:
    "border border-danger bg-white text-danger [@media(hover:hover)_and_(pointer:fine)]:hover:bg-[#FEF2F2] [@media(hover:hover)_and_(pointer:fine)]:dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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
      className={`inline-flex items-center justify-center gap-2 rounded-md border-transparent px-4 py-2 font-sans text-sm font-semibold transition-[background-color,color,border-color,box-shadow,transform,filter] duration-[250ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:duration-150 [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-sm active:translate-y-0 active:scale-[0.98] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:shadow-none ${VARIANT_CLASSES[variant]} ${className}`}
      {...rest}
    />
  );
}