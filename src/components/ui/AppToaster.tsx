import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import "../../appToaster.css";

/**
 * Único <Toaster /> do app (monte uma vez, na raiz).
 *
 * O Sonner usa `theme="light"` por padrão e NÃO acompanha a classe `.dark`
 * que o /perfil aplica no <html>; por isso observamos a classe e repassamos
 * o tema. O visual (superfície, tipografia, ícones, alto contraste) fica em
 * `appToaster.css`, sem `!important`: as classes `app-toaster`/`app-toast`
 * têm mais especificidade que os estilos injetados pelo Sonner.
 */

type Theme = "light" | "dark";

function readTheme(): Theme {
  return typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark")
    ? "dark"
    : "light";
}

export function AppToaster() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
      position="top-right"
      offset={{ top: 88, right: 24 }}
      mobileOffset={{ top: 80, right: 16 }}
      gap={10}
      className="app-toaster"
      toastOptions={{ classNames: { toast: "app-toast" } }}
    />
  );
}