/**
 * [CERT_PDF] Visualizador de certificado em PDF, dentro do próprio site
 * (modal com <iframe>) — o recrutador confere o documento sem baixar nada.
 *
 * Usado pelo ResumeBlockContent (portal do aluno e página do candidato).
 * Acessibilidade: dialog modal, foco preso, Esc fecha, foco volta ao botão
 * que abriu (o chamador devolve) e o scroll da página fica travado.
 * Alguns navegadores móveis não renderizam PDF em iframe; por isso o link
 * "Abrir em nova aba" fica sempre visível como alternativa.
 */
import { useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, FileText, X } from "lucide-react";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function CertificateViewer({
  title,
  url,
  onClose,
}: {
  title: string;
  url: string;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Entrada: fundo escurece e o painel sobe de scale(0.97).
  useLayoutEffect(() => {
    const reduce = prefersReducedMotion();
    const options = (duration: number): KeyframeAnimationOptions => ({
      duration,
      easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      fill: "backwards",
    });
    const a = backdropRef.current?.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      options(reduce ? 120 : 280),
    );
    const b = panelRef.current?.animate(
      reduce
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "scale(0.97) translateY(8px)" },
            { opacity: 1, transform: "none" },
          ],
      options(reduce ? 120 : 400),
    );
    return () => {
      a?.cancel();
      b?.cancel();
    };
  }, []);

  // Trava o scroll da página enquanto o modal está aberto.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Esc fecha; Tab fica preso entre os controles do cabeçalho.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 print:hidden">
      <div
        ref={backdropRef}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px]"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="certificate-viewer-title"
        className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_24px_64px_-16px_rgba(15,23,42,0.45)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.07)]"
      >
        <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 sm:px-6">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FDF2F4] text-primary"
          >
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2
              id="certificate-viewer-title"
              className="truncate font-serif text-lg font-bold tracking-tight text-slate-900"
            >
              {title}
            </h2>
            <p className="text-xs text-slate-500">
              Certificado anexado pelo candidato
            </p>
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold text-primary [@media(hover:hover)]:hover:bg-primary/10 dark:text-[#e9b8c3] dark:[@media(hover:hover)]:hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Abrir em nova aba</span>
            <span className="sr-only sm:hidden">Abrir em nova aba</span>
          </a>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar visualização do certificado"
            title="Fechar"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-600 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-slate-300 [@media(hover:hover)]:hover:bg-slate-100 dark:[@media(hover:hover)]:hover:bg-white/10 dark:[@media(hover:hover)]:hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <iframe
          src={url}
          title={`Certificado: ${title}`}
          className="min-h-0 w-full flex-1 bg-slate-100"
        />
      </div>
    </div>,
    document.body,
  );
}