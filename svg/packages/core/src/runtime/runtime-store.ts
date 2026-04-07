import {
  GRID_SNAP_DEFAULT_SIZE,
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "./constants";
import type { EditorSvgElement, NodeKey, SerializedSvgElementNode } from "./model/types";

export interface SvgHistoryEntry {
  reason: string;
  snapshot: string;
}

export interface SvgEditorStateSnapshot {
  selectedNodeKey: string | null;
  selectedNodeKeys: Iterable<string> | null | undefined;
  collapsedNodeKeys: Iterable<string> | null | undefined;
  lockedNodeKeys: Iterable<string> | null | undefined;
}

export interface FileSystemWritableLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}

export interface FileSystemHandleLike {
  name?: string;
  createWritable?: () => Promise<FileSystemWritableLike>;
  queryPermission?: (options: { mode: "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
  requestPermission?: (options: { mode: "readwrite" }) => Promise<"granted" | "denied" | "prompt">;
}

export interface SvgRuntimeState {
  svgRoot: SVGSVGElement | null;
  documentSnapshot: SerializedSvgElementNode | null;
  documentRevision: number;
  nodeMap: Map<string, EditorSvgElement>;
  selectedId: string | null;
  selectedIds: Set<string>;
  selectedNodeKey: string | null;
  selectedNodeKeys: Set<string>;
  nextId: number;
  zoom: number;
  panX: number;
  panY: number;
  gridSnapEnabled: boolean;
  gridSnapSize: number;
  topbarCollapsed: boolean;
  leftPanelHidden: boolean;
  leftPanelView: "insert" | "layers";
  rightPanelHidden: boolean;
  sourceVisible: boolean;
  history: SvgHistoryEntry[];
  historyIndex: number;
  restoring: boolean;
  drag: unknown;
  selectionBox: unknown;
  contextMenu: {
    editorId: string | null;
    visible: boolean;
    x: number;
    y: number;
  };
  suppressNextContextMenu: boolean;
  suppressNextSvgClick: boolean;
  dropDepth: number;
  warnings: string[];
  currentFileHandle: FileSystemHandleLike | null;
  currentFileName: string;
  collapsedNodeKeys: Set<NodeKey>;
  inspectorSectionStates: Map<string, boolean>;
  lockedNodeKeys: Set<NodeKey>;
  nodeKeyByEditorId: Map<string, NodeKey>;
  editorIdByNodeKey: Map<NodeKey, string>;
  nodeKeyByNode: WeakMap<Element, NodeKey>;
}

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

export function createSvgRuntimeState(): SvgRuntimeState {
  return {
    svgRoot: null,
    documentSnapshot: null,
    documentRevision: 0,
    nodeMap: new Map<string, EditorSvgElement>(),
    selectedId: null,
    selectedIds: new Set<string>(),
    selectedNodeKey: null,
    selectedNodeKeys: new Set<string>(),
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
    collapsedNodeKeys: new Set<NodeKey>(),
    inspectorSectionStates: new Map<string, boolean>(),
    lockedNodeKeys: new Set<NodeKey>(),
    nodeKeyByEditorId: new Map<string, NodeKey>(),
    editorIdByNodeKey: new Map<NodeKey, string>(),
    nodeKeyByNode: new WeakMap<Element, NodeKey>()
  };
}

export function createSvgRuntimeStore(initialState = createSvgRuntimeState()) {
  const state = initialState;
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
      bindMountedSvgRoot(svgRoot: SVGSVGElement | null) {
        state.svgRoot = svgRoot;
      },
      setCurrentFileBinding(fileHandle: FileSystemHandleLike | null = null, fileName = "") {
        commit(() => {
          state.currentFileHandle = fileHandle || null;
          state.currentFileName = fileName || fileHandle?.name || "";
        });
      },
      setDocumentSnapshot(snapshot: SerializedSvgElementNode | null) {
        commit(() => {
          state.documentSnapshot = snapshot || null;
          state.documentRevision += 1;
        });
      },
      setSvgRoot(svgRoot: SVGSVGElement | null) {
        commit(() => {
          state.svgRoot = svgRoot;
        });
      }
    },
    history: {
      replace(entries: SvgHistoryEntry[] | unknown, historyIndex: number) {
        commit(() => {
          state.history = Array.isArray(entries) ? [...entries] : [];
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
          state.selectedNodeKeys = new Set<string>();
          state.collapsedNodeKeys = new Set<NodeKey>();
          state.lockedNodeKeys = new Set<NodeKey>();
          state.selectedId = null;
          state.selectedIds = new Set<string>();
          state.selectionBox = null;
        });
      },
      restoreEditorState(snapshot: SvgEditorStateSnapshot | null) {
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
export type SvgRuntimeStore = ReturnType<typeof createSvgRuntimeStore>;
