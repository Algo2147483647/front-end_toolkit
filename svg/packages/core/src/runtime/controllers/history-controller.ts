import type { HistoryController, HistoryLoadDocument, HistoryLoadDocumentOptions, SvgRenderer } from "../controller-types";
import type { SvgModel } from "../model/types";
import type { SvgRuntimeState, SvgRuntimeStore } from "../runtime-store";

interface HistoryControllerDeps {
  store: SvgRuntimeStore;
  state: SvgRuntimeState;
  model: Pick<SvgModel, "serialize">;
  renderer: Pick<SvgRenderer, "refresh">;
}

export function createHistoryController({ store, state, model, renderer }: HistoryControllerDeps): HistoryController {
  const runtime = store?.getState?.() || state;
  let loadDocument: HistoryLoadDocument | null = null;

  function setLoadDocument(fn: HistoryLoadDocument) {
    loadDocument = fn;
  }

  function recordHistory(reason: string) {
    if (!runtime.svgRoot || runtime.restoring) {
      return;
    }

    const snapshot = model.serialize();
    const previous = runtime.history[runtime.historyIndex]?.snapshot;
    if (snapshot === previous) {
      return;
    }

    const nextHistory = runtime.history.slice(0, runtime.historyIndex + 1);
    nextHistory.push({ reason, snapshot });
    if (nextHistory.length > 80) {
      nextHistory.shift();
    }

    store.history.replace(nextHistory, nextHistory.length - 1);
    renderer.refresh({ actions: true });
  }

  function restoreHistory(index: number) {
    const entry = runtime.history[index];
    if (!entry || typeof loadDocument !== "function") {
      return;
    }

    store.history.setRestoring(true);
    const restoreOptions: HistoryLoadDocumentOptions = {
      preserveEditorState: true,
      pushHistory: false
    };
    loadDocument(entry.snapshot, restoreOptions);
    store.history.replace(runtime.history, index);
    store.history.setRestoring(false);
    renderer.refresh({ actions: true });
  }

  return {
    recordHistory,
    restoreHistory,
    setLoadDocument
  };
}
