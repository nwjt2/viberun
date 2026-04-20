// Minimal localStorage-backed progress persistence. IndexedDB would be more
// robust for large blobs, but our progress payload is small (a spec, a plan, a
// few strings), so localStorage is sufficient and far simpler. Swap to
// IndexedDB later without changing the callsites.

const KEY = 'viberun.progress.v1';

export function saveProgress<T>(data: T): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private-mode browsers and full storage — silently no-op.
  }
}

export function loadProgress<T>(): T | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // no-op
  }
}
