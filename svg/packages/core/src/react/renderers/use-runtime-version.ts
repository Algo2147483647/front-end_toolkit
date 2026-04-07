import { useSyncExternalStore } from "react";
import type { SvgRenderChannel } from "../../runtime/runtime-store";

export function useRuntimeVersion(store: {
  getSnapshot: (channel?: SvgRenderChannel) => number;
  subscribe: (listener: () => void, channel?: SvgRenderChannel) => () => void;
}, channel: SvgRenderChannel = "global") {
  return useSyncExternalStore(
    (listener) => store.subscribe(listener, channel),
    () => store.getSnapshot(channel),
    () => store.getSnapshot(channel)
  );
}
