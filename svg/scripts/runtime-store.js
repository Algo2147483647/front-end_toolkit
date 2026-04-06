import {
  GRID_SNAP_DEFAULT_SIZE,
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "./constants.js";

function readStoredBoolean(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch {
    return fallback;
  }

  return fallback;
}

function readStoredNumber(key, fallback) {
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

function normalizeGridSnapSize(value) {
  const parsed = Number.parseFloat(String(value));
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed;
  }

  return GRID_SNAP_SIZE_OPTIONS.includes(parsed) ? parsed : GRID_SNAP_DEFAULT_SIZE;
}

function cloneSet(values) {
  return new Set(values ? [...values] : []);
}

function createContextMenuState(overrides = {}) {
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
  const state = initialState;

  return {
    state,
    getState() {
      return state;
    },
    chrome: {
      setGridSnapEnabled(enabled) {
        state.gridSnapEnabled = Boolean(enabled);
      },
      setGridSnapSize(size) {
        state.gridSnapSize = normalizeGridSnapSize(size);
        return state.gridSnapSize;
      },
      setLeftPanelHidden(hidden) {
        state.leftPanelHidden = Boolean(hidden);
      },
      setLeftPanelView(view) {
        state.leftPanelView = view === "layers" ? "layers" : "insert";
        return state.leftPanelView;
      },
      setRightPanelHidden(hidden) {
        state.rightPanelHidden = Boolean(hidden);
      },
      setSourceVisible(visible) {
        state.sourceVisible = Boolean(visible);
      },
      setTopbarCollapsed(collapsed) {
        state.topbarCollapsed = Boolean(collapsed);
      }
    },
    contextMenu: {
      hide() {
        state.contextMenu = createContextMenuState();
      },
      show({ editorId = null, x = 0, y = 0 } = {}) {
        state.contextMenu = createContextMenuState({
          editorId,
          visible: true,
          x,
          y
        });
      }
    },
    document: {
      setCurrentFileBinding(fileHandle = null, fileName = "") {
        state.currentFileHandle = fileHandle || null;
        state.currentFileName = fileName || fileHandle?.name || "";
      },
      setSvgRoot(svgRoot) {
        state.svgRoot = svgRoot;
      }
    },
    history: {
      replace(entries, historyIndex) {
        state.history = Array.isArray(entries) ? entries : [];
        state.historyIndex = Number.isInteger(historyIndex) ? historyIndex : -1;
      },
      setRestoring(restoring) {
        state.restoring = Boolean(restoring);
      }
    },
    inspector: {
      setSectionState(key, open) {
        if (!key) {
          return;
        }

        state.inspectorSectionStates.set(key, Boolean(open));
      }
    },
    interaction: {
      clearDrag() {
        const previousDrag = state.drag;
        state.drag = null;
        return previousDrag;
      },
      clearDropDepth() {
        state.dropDepth = 0;
      },
      clearSelectionBox() {
        state.selectionBox = null;
      },
      setDrag(drag) {
        state.drag = drag;
      },
      setDropDepth(depth) {
        state.dropDepth = Math.max(0, depth);
      },
      setSelectionBox(box) {
        state.selectionBox = box;
      },
      setSuppressNextContextMenu(value) {
        state.suppressNextContextMenu = Boolean(value);
      },
      setSuppressNextSvgClick(value) {
        state.suppressNextSvgClick = Boolean(value);
      }
    },
    selection: {
      resetEditorState() {
        this.restoreEditorState(null);
        state.selectedId = null;
        state.selectedIds = new Set();
        state.selectionBox = null;
      },
      restoreEditorState(snapshot) {
        state.selectedNodeKey = snapshot?.selectedNodeKey || null;
        state.selectedNodeKeys = cloneSet(snapshot?.selectedNodeKeys);
        state.collapsedNodeKeys = cloneSet(snapshot?.collapsedNodeKeys);
        state.lockedNodeKeys = cloneSet(snapshot?.lockedNodeKeys);
      },
      setSelection(editorIds, primaryId, selectedNodeKey, selectedNodeKeys) {
        state.selectedIds = cloneSet(editorIds);
        state.selectedId = primaryId || null;
        state.selectedNodeKey = selectedNodeKey || null;
        state.selectedNodeKeys = cloneSet(selectedNodeKeys);
      }
    },
    viewport: {
      resetPan() {
        state.panX = 0;
        state.panY = 0;
      },
      setPan(panX, panY) {
        state.panX = panX;
        state.panY = panY;
      },
      setTransform({ panX = state.panX, panY = state.panY, zoom = state.zoom } = {}) {
        state.panX = panX;
        state.panY = panY;
        state.zoom = zoom;
      },
      setZoom(zoom) {
        state.zoom = zoom;
      }
    }
  };
}
