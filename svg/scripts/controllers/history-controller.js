export function createHistoryController({ store, state, model, renderer }) {
  const runtime = store?.getState?.() || state;
  let loadDocument = null;

  function setLoadDocument(fn) {
    loadDocument = fn;
  }

  function recordHistory(reason) {
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

  function restoreHistory(index) {
    const entry = runtime.history[index];
    if (!entry || typeof loadDocument !== "function") {
      return;
    }

    store.history.setRestoring(true);
    loadDocument(entry.snapshot, { pushHistory: false, preserveEditorState: true });
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
