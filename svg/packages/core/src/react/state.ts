import {
  GRID_SNAP_DEFAULT_SIZE,
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "../../../../scripts/constants.js";

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

function normalizeGridSnapSize(value: number) {
  const parsed = Number.parseFloat(String(value));
  if (Number.isFinite(parsed) && parsed >= 1) {
    return parsed;
  }

  return GRID_SNAP_SIZE_OPTIONS.includes(parsed) ? parsed : GRID_SNAP_DEFAULT_SIZE;
}

export function createSvgStudioState() {
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
    contextMenu: {
      editorId: null,
      visible: false,
      x: 0,
      y: 0
    },
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
