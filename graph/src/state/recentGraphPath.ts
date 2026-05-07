const RECENT_GRAPH_PATH_KEY = "dag-studio:recent-graph-path";

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function loadRecentGraphPath(storage: StorageLike | null = getBrowserStorage()): string {
  if (!storage) {
    return "";
  }
  return sanitizeGraphPath(storage.getItem(RECENT_GRAPH_PATH_KEY));
}

export function saveRecentGraphPath(path: string, storage: StorageLike | null = getBrowserStorage()): string {
  const normalized = sanitizeGraphPath(path);
  if (!storage || !normalized) {
    return normalized;
  }
  try {
    storage.setItem(RECENT_GRAPH_PATH_KEY, normalized);
  } catch {
    // Ignore storage failures and continue without persistence.
  }
  return normalized;
}

export function clearRecentGraphPath(storage: StorageLike | null = getBrowserStorage()): void {
  if (!storage) {
    return;
  }
  try {
    storage.removeItem(RECENT_GRAPH_PATH_KEY);
  } catch {
    // Ignore storage failures and continue without persistence.
  }
}

export function sanitizeGraphPath(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }
  return window.localStorage;
}
