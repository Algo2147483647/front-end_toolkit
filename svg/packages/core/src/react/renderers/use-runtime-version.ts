import { useSyncExternalStore } from "react";

export function useRuntimeVersion(store: {
  getSnapshot: () => number;
  subscribe: (listener: () => void) => () => void;
}) {
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot
  );
}
