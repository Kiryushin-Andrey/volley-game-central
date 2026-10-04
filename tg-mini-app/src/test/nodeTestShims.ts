/** Install browser globals needed to import mini-app modules under node:test. */
export function installNodeTestShims() {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };

  Object.defineProperty(globalThis, 'localStorage', {
    value: localStorage,
    configurable: true,
  });

  // debug.ts registers DOMContentLoaded at import time; no Telegram on purpose.
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    (globalThis as { window: unknown }).window = {
      addEventListener: () => undefined,
      Telegram: undefined,
    };
  }

  // Vite injects import.meta.env; plain node/tsx does not.
  const meta = import.meta as ImportMeta & { env?: Record<string, string | undefined> };
  if (!meta.env) {
    Object.defineProperty(meta, 'env', {
      value: {},
      configurable: true,
    });
  }
}
