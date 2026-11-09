import "@testing-library/jest-dom/vitest";

/**
 * [TEST_ENV] `localStorage` no ambiente de testes.
 *
 * O Node 22+ declara `globalThis.localStorage` como um acessor que devolve
 * `undefined` enquanto a flag `--localstorage-file` não for usada. Como esse
 * acessor já existe em `globalThis`, o Vitest não o substitui ao instalar os
 * globais do jsdom — resultado: com `environment: "jsdom"`, `localStorage`
 * aparecia indefinido e `localStorage.clear()` estourava em `beforeEach`.
 *
 * A correção reaproveita o `Storage` real do jsdom (que tem origem http e
 * funciona normalmente) e, se ele não estiver disponível/exposto (por
 * exemplo, documento com origem opaca), cai num mock em memória com a mesma
 * API `Storage`, para que a suíte nunca dependa do estado do processo Node.
 */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key: string) {
      return data.get(key) ?? null;
    },
    key(index: number) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key: string) {
      data.delete(key);
    },
    setItem(key: string, value: string) {
      data.set(key, String(value));
    },
  };
}

function resolveStorage(): Storage {
  try {
    const jsdomStorage = window.localStorage;
    if (jsdomStorage) {
      // Sonda rápida: em origem opaca o jsdom lança `SecurityError`.
      jsdomStorage.setItem("__storage_probe__", "1");
      jsdomStorage.removeItem("__storage_probe__");
      return jsdomStorage;
    }
  } catch {
    // Sem Storage utilizável no jsdom — usa o mock em memória abaixo.
  }
  return createMemoryStorage();
}

const storageHost = globalThis as unknown as { localStorage?: Storage };

if (!storageHost.localStorage) {
  const storage = resolveStorage();
  Object.defineProperty(storageHost, "localStorage", {
    configurable: true,
    enumerable: true,
    get: () => storage,
  });
}

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??=
  ResizeObserverMock as unknown as typeof ResizeObserver;

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

if (!Element.prototype.animate) {
  Element.prototype.animate = (() => ({
    finished: Promise.resolve(),
    cancel: () => {},
    finish: () => {},
    play: () => {},
    pause: () => {},
    onfinish: null,
  })) as unknown as Element["animate"];
}