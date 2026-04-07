import {
  GRID_SNAP_DEFAULT_SIZE,
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "./constants";

function readStoredBoolean(key: string, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    return fallback;
  }

  return fallback;
}

function readStoredNumber(key: string, fallback: number) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) {
      return fallback;
    }

    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function normalizeGridSnapSize(value: unknown) {
  const parsed = Number.parseFloat(String(value));
  if (GRID_SNAP_SIZE_OPTIONS.includes(parsed)) {
    return parsed;
  }

  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed;
  }

  return GRID_SNAP_DEFAULT_SIZE;
}

function cloneSet<T>(values?: Iterable<T> | null) {
  return new Set(values ? [...values] : []);
}

function createContextMenuState(overrides: Partial<{
  editorId: string | null;
  visible: boolean;
  x: number;
  y: number;
}> = {}) {
  return {
    editorId: null,
    visible: false,
    x: 0,
    y: 0,
    ...overrides
  };
}

export function createSvgRuntimeState() {
  return {
    svgRoot: null,
    nodeMap: new Map(),
    selectedId: null,
    selectedIds: new Set(),
    selectedNodeKey: null,
    selectedNodeKeys: new Set(),
    nextId: 0,
    zoom: 1,
    panX: 0,
    panY: 0,
    gridSnapEnabled: readStoredBoolean(GRID_SNAP_STORAGE_KEY, true),
    gridSnapSize: normalizeGridSnapSize(
      readStoredNumber(GRID_SNAP_SIZE_STORAGE_KEY, GRID_SNAP_DEFAULT_SIZE)
    ),
    topbarCollapsed: false,
    leftPanelHidden: false,
    leftPanelView: "insert",
    rightPanelHidden: false,
    sourceVisible: false,
    history: [],
    historyIndex: -1,
    restoring: false,
    drag: null,
    selectionBox: null,
    contextMenu: createContextMenuState(),
    suppressNextContextMenu: false,
    suppressNextSvgClick: false,
    dropDepth: 0,
    warnings: [],
    currentFileHandle: null,
    currentFileName: "",
    collapsedNodeKeys: new Set(),
    inspectorSectionStates: new Map(),
    lockedNodeKeys: new Set(),
    nodeKeyByEditorId: new Map(),
    editorIdByNodeKey: new Map(),
    nodeKeyByNode: new WeakMap()
  };
}

export function createSvgRuntimeStore(initialState = createSvgRuntimeState()) {
  const state: any = initialState;
  const listeners = new Set<() => void>();
  let version = 0;
  let batchDepth = 0;
  let pendingNotify = false;

  function emit() {
    version += 1;
    listeners.forEach((listener) => listener());
  }

  function notify() {
    if (batchDepth > 0) {
      pendingNotify = true;
      return;
    }

    emit();
  }

  function commit<T>(fn: () => T) {
    const result = fn();
    notify();
    return result;
  }

  function batch<T>(fn: () => T) {
    batchDepth += 1;
    try {
      return fn();
    } finally {
      batchDepth -= 1;
      if (batchDepth === 0 && pendingNotify) {
        pendingNotify = false;
        emit();
      }
    }
  }

  return {
    state,
    getState() {
      return state;
    },
    getSnapshot() {
      return version;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    invalidate() {
      notify();
    },
    batch,
    chrome: {
      setGridSnapEnabled(enabled: unknown) {
        commit(() => {
          state.gridSnapEnabled = Boolean(enabled);
        });
      },
      setGridSnapSize(size: unknown) {
        return commit(() => {
          state.gridSnapSize = normalizeGridSnapSize(size);
          return state.gridSnapSize;
        });
      },
      setLeftPanelHidden(hidden: unknown) {
        commit(() => {
          state.leftPanelHidden = Boolean(hidden);
        });
      },
      setLeftPanelView(view: string) {
        return commit(() => {
          state.leftPanelView = view === "layers" ? "layers" : "insert";
          return state.leftPanelView;
        });
      },
      setRightPanelHidden(hidden: unknown) {
        commit(() => {
          state.rightPanelHidden = Boolean(hidden);
        });
      },
      setSourceVisible(visible: unknown) {
        commit(() => {
          state.sourceVisible = Boolean(visible);
        });
      },
      setTopbarCollapsed(collapsed: unknown) {
        commit(() => {
          state.topbarCollapsed = Boolean(collapsed);
        });
      }
    },
    contextMenu: {
      hide() {
        commit(() => {
          state.contextMenu = createContextMenuState();
        });
      },
      show({ editorId = null, x = 0, y = 0 }: Partial<{ editorId: string | null; x: number; y: number }> = {}) {
        commit(() => {
          state.contextMenu = createContextMenuState({
            editorId,
            visible: true,
            x,
            y
          });
        });
      }
    },
    document: {
      setCurrentFileBinding(fileHandle: any = null, fileName = "") {
        commit(() => {
          state.currentFileHandle = fileHandle || null;
          state.currentFileName = fileName || fileHandle?.name || "";
        });
      },
      setSvgRoot(svgRoot: SVGSVGElement | null) {
        commit(() => {
          state.svgRoot = svgRoot;
        });
      }
    },
    history: {
      replace(entries: unknown, historyIndex: number) {
        commit(() => {
          state.history = Array.isArray(entries) ? entries : [];
          state.historyIndex = Number.isInteger(historyIndex) ? historyIndex : -1;
        });
      },
      setRestoring(restoring: unknown) {
        commit(() => {
          state.restoring = Boolean(restoring);
        });
      }
    },
    inspector: {
      setSectionState(key: string | null, open: unknown) {
        if (!key) {
          return;
        }

        commit(() => {
          state.inspectorSectionStates.set(key, Boolean(open));
        });
      }
    },
    interaction: {
      clearDrag() {
        return commit(() => {
          const previousDrag = state.drag;
          state.drag = null;
          return previousDrag;
        });
      },
      clearDropDepth() {
        commit(() => {
          state.dropDepth = 0;
        });
      },
      clearSelectionBox() {
        commit(() => {
          state.selectionBox = null;
        });
      },
      setDrag(drag: unknown) {
        commit(() => {
          state.drag = drag;
        });
      },
      setDropDepth(depth: number) {
        commit(() => {
          state.dropDepth = Math.max(0, depth);
        });
      },
      setSelectionBox(box: unknown) {
        commit(() => {
          state.selectionBox = box;
        });
      },
      setSuppressNextContextMenu(value: unknown) {
        commit(() => {
          state.suppressNextContextMenu = Boolean(value);
        });
      },
      setSuppressNextSvgClick(value: unknown) {
        commit(() => {
          state.suppressNextSvgClick = Boolean(value);
        });
      }
    },
    selection: {
      resetEditorState() {
        commit(() => {
          state.selectedNodeKey = null;
          state.selectedNodeKeys = new Set();
          state.collapsedNodeKeys = new Set();
          state.lockedNodeKeys = new Set();
          state.selectedId = null;
          state.selectedIds = new Set();
          state.selectionBox = null;
        });
      },
      restoreEditorState(snapshot: any) {
        commit(() => {
          state.selectedNodeKey = snapshot?.selectedNodeKey || null;
          state.selectedNodeKeys = cloneSet(snapshot?.selectedNodeKeys);
          state.collapsedNodeKeys = cloneSet(snapshot?.collapsedNodeKeys);
          state.lockedNodeKeys = cloneSet(snapshot?.lockedNodeKeys);
        });
      },
      setSelection(editorIds: Iterable<string> | null | undefined, primaryId: string | null, selectedNodeKey: string | null, selectedNodeKeys: Iterable<string> | null | undefined) {
        commit(() => {
          state.selectedIds = cloneSet(editorIds);
          state.selectedId = primaryId || null;
          state.selectedNodeKey = selectedNodeKey || null;
          state.selectedNodeKeys = cloneSet(selectedNodeKeys);
        });
      }
    },
    viewport: {
      resetPan() {
        commit(() => {
          state.panX = 0;
          state.panY = 0;
        });
      },
      setPan(panX: number, panY: number) {
        commit(() => {
          state.panX = panX;
          state.panY = panY;
        });
      },
      setTransform({ panX = state.panX, panY = state.panY, zoom = state.zoom }: Partial<{ panX: number; panY: number; zoom: number }> = {}) {
        commit(() => {
          state.panX = panX;
          state.panY = panY;
          state.zoom = zoom;
        });
      },
      setZoom(zoom: number) {
        commit(() => {
          state.zoom = zoom;
        });
      }
    }
  };
}
