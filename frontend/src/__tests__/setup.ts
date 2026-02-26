import "@testing-library/jest-dom/vitest";

// Node v25+ ships a broken localStorage global (no getItem/setItem/removeItem/clear)
// when --localstorage-file isn't configured. Replace it with a working in-memory mock
// so tests (and jsdom) can use standard Web Storage API.
if (typeof globalThis.localStorage === "undefined" || typeof globalThis.localStorage.getItem !== "function") {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, writable: true, configurable: true });
}
