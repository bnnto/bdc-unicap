import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

type ModalProps = {
  /** id do título (aria-labelledby). */
  titleId: string;
  /** id da descrição (aria-describedby). */
  descriptionId?: string;
  /** Chamado ao pressionar Esc ou clicar no backdrop. */
  onClose: () => void;
  children: ReactNode;
};

/**
 * Modal acessível compartilhado:
 * - foco vai para o primeiro elemento focável ao abrir;
 * - Tab/Shift+Tab ficam presos dentro do diálogo (focus trap);
 * - Esc e clique no backdrop chamam `onClose`;
 * - o foco volta ao elemento que o abriu ao fechar.
 *
 * Renderize condicionalmente (`{open ? <Modal …/> : null}`): o ciclo de
 * vida do foco é atrelado à montagem/desmontagem do componente.
 */
export function Modal({
  titleId,
  descriptionId,
  onClose,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    if (panel === null) return;

    const first = panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (panel === null) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;

      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const active = document.activeElement;
      const outside = !panel.contains(active);

      if (e.shiftKey && (active === firstItem || outside)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && (active === lastItem || outside)) {
        e.preventDefault();
        firstItem.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 p-4"
      onMouseDown={(e) => {
        // Clique no backdrop fecha (não no conteúdo do diálogo).
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-level1 focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}