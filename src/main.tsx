import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { Toaster } from "sonner";
import "./index.css";
import App from "./App";
import { AuthProvider } from "./components/auth/AuthProvider";
import { ConsentGate } from "./components/auth/ConsentGate";
import { ErrorBoundary } from "./components/error/ErrorBoundary";
import { applyPreferences, loadPreferences } from "./lib/preferences";

const convexUrl: unknown = import.meta.env.VITE_CONVEX_URL;
if (typeof convexUrl !== "string" || convexUrl.length === 0) {
  throw new Error(
    "VITE_CONVEX_URL ausente. Execute `bun convex dev --once` para provisionar o Convex local.",
  );
}

const convex = new ConvexReactClient(convexUrl);

// [PERFIL_E_LGPD] aplica as preferências de acessibilidade salvas
// (tema escuro, alto contraste e fonte) antes do primeiro render —
// sem flash da tema errado.
applyPreferences(loadPreferences());

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Elemento #root não encontrado no index.html");
}

createRoot(rootElement).render(
  <StrictMode>
    {/* [UX_REFINEMENT] Etapa 1 — Toasts globais: erros e sucessos de toda
        a aplicação num único lugar, com auto-dismiss.
        [FIX_UX] Camada externa: fica FORA do ErrorBoundary e dos
        providers para nunca ser desmontada/remontada junto com a árvore
        (um remount no meio de um erro faz o toast "atrasar"/sumir).
        [FINAL_UPGRADE] visibleToasts limita a fila visível a 3 toasts —
        evita sobreposição/lag quando várias falhas disparam juntas. */}
    <Toaster position="top-right" closeButton richColors visibleToasts={3} />
    {/* [S8-4] CA 1 — erro de renderização não derruba o portal: limite
        externo com fallback acessível e registro para a monitoração. */}
    <ErrorBoundary
      label="Portal de Carreiras"
      onError={(error) => {
        // CA 2 — gancho de observação (console em dev; telemetry hook).
        console.error("[monitoracao] erro de render capturado", error);
      }}
    >
      <ConvexProvider client={convex}>
        <AuthProvider client={convex}>
          <ConsentGate>
            <App />
          </ConsentGate>
        </AuthProvider>
      </ConvexProvider>
    </ErrorBoundary>
  </StrictMode>,
);
