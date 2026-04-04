export function createHistoryController({ state, model, renderer }) {
  let loadDocument = null;

  function setLoadDocument(fn) {
    loadDocument = fn;
  }

  function recordHistory(reason) {
    if (!state.svgRoot || state.restoring) {
      return;
    }

    const snapshot = model.serialize();
    const previous = state.history[state.historyIndex]?.snapshot;
    if (snapshot === previous) {
      return;
    }

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ reason, snapshot });
    if (state.history.length > 80) {
      state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    renderer.refresh({ actions: true });
  }

  function restoreHistory(index) {
    const entry = state.history[index];
    if (!entry || typeof loadDocument !== "function") {
      return;
    }

    state.restoring = true;
    loadDocument(entry.snapshot, { pushHistory: false, preserveEditorState: true });
    state.historyIndex = index;
    state.restoring = false;
    renderer.refresh({ actions: true });
  }

  return {
    recordHistory,
    restoreHistory,
    setLoadDocument
  };
}
