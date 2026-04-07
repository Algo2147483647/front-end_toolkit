import type { SvgStudioUiRefs } from "../react/types";
import type { SvgModel, SvgRuntimeStateLike } from "./model/types";
import type { SvgRuntimeState, SvgRuntimeStore } from "./runtime-store";

export interface SvgRenderRefreshOptions {
  workspace?: boolean;
  tree?: boolean;
  inspector?: boolean;
  source?: boolean;
  actions?: boolean;
  overlay?: boolean;
}

export interface SvgActionMap {
  [key: string]: (...args: unknown[]) => unknown;
}

export interface SvgRenderer {
  applyZoom: () => void;
  dispose?: () => void;
  getFitZoom: () => number;
  refresh: (options?: SvgRenderRefreshOptions) => void;
  renderInspector: () => void;
  renderOverlay: () => void;
  renderTree: () => void;
  renderWorkspace: () => void;
  syncChrome: () => void;
  updateActions: () => void;
  updateSource: () => void;
}

export interface EditorStateSnapshot {
  selectedNodeKey: string | null;
  selectedNodeKeys: string[];
  collapsedNodeKeys: string[];
  lockedNodeKeys: string[];
}

export interface SelectionController {
  clearSelection: (options?: { primaryId?: string | null; render?: boolean }) => void;
  getSelectedEditorIds: () => string[];
  getSelectionTargets: () => Element[];
  refreshSelectionState: () => void;
  remapMetadataKey: (oldKey: string | null, newKey: string | null) => void;
  remapMetadataKeys: (keyMap: Map<string, string>) => void;
  resetEditorState: () => void;
  resolveLiveSelection: (fallbackEditorId?: string | null) => void;
  restoreEditorState: (snapshot: EditorStateSnapshot | null) => void;
  selectNode: (editorId: string | null, options?: { render?: boolean }) => void;
  setSelection: (editorIds: string[], options?: { primaryId?: string | null; render?: boolean }) => void;
  snapshotEditorState: () => EditorStateSnapshot;
  toggleNodeCollapse: (editorId: string) => void;
  toggleNodeLock: (editorId: string) => void;
}

export interface HistoryLoadDocumentOptions {
  fileHandle?: unknown;
  fileName?: string;
  fitScale?: number | null;
  preserveEditorState?: boolean;
  pushHistory?: boolean;
}

export type HistoryLoadDocument = (source: string, options?: HistoryLoadDocumentOptions) => void;

export interface HistoryController {
  recordHistory: (reason: string) => void;
  restoreHistory: (index: number) => void;
  setLoadDocument: (fn: HistoryLoadDocument) => void;
}

export interface DocumentController {
  bringSelectionToFront: (editorId?: string | null) => void;
  deleteSelection: () => void;
  downloadSvg: () => void;
  duplicateSelection: () => void;
  insertElement: (kind: string) => void;
  insertImageFile: (file: File) => Promise<void>;
  loadDocument: HistoryLoadDocument;
  regularizePolygon: (editorId: string, record?: boolean) => void;
  regularizePolygonEqualSides: (editorId: string, record?: boolean) => void;
  saveToSourceFile: () => Promise<boolean>;
  sendSelectionToBack: (editorId?: string | null) => void;
  toggleNodeVisibility: (editorId: string) => void;
  updateField: (editorId: string, field: { key: string; kind: string }, value: string, record: boolean) => void;
  updatePathBezier: (editorId: string, bezier: unknown, record?: boolean) => void;
  updatePolygonSides: (editorId: string, value: string, record?: boolean) => void;
  updatePolylinePointCount: (editorId: string, value: string, record?: boolean) => void;
}

export interface InteractionController {
  bindEvents: (options?: { bindWindowEvents?: boolean; bindWorkspaceEvents?: boolean }) => (() => void) | void;
  fitToView: () => void;
  onPointHandlePointerDown: (event: PointerEvent, editorId: string, handle: string) => void;
  onPathBezierHandlePointerDown: (event: PointerEvent, editorId: string, handle: string) => void;
  onResizeHandlePointerDown: (event: PointerEvent, editorId: string, handle: string) => void;
  onSvgClick: (event: MouseEvent) => void;
  onSvgPointerDown: (event: PointerEvent) => void;
  onWindowDragEnd: () => void;
  onWindowDrop: () => void;
  onWindowKeyDown: (event: KeyboardEvent) => void;
  onWindowPointerCancel: () => void;
  onWindowPointerDown: (event: PointerEvent) => void;
  onWindowPointerMove: (event: PointerEvent) => void;
  onWindowPointerUp: () => void;
  onWindowResize: () => void;
  onWorkspaceContextMenu: (event: MouseEvent) => void;
  onWorkspaceDragEnter: (event: DragEvent) => void;
  onWorkspaceDragLeave: (event: DragEvent) => void;
  onWorkspaceDragOver: (event: DragEvent) => void;
  onWorkspaceDrop: (event: DragEvent) => Promise<void>;
  onWorkspacePointerDown: (event: PointerEvent) => void;
  setGridSnapEnabled: (enabled: boolean) => void;
  setGridSnapSize: (size: string) => void;
  setLeftPanelHidden: (hidden: boolean) => void;
  setLeftPanelView: (view: string) => void;
  setRightPanelHidden: (hidden: boolean) => void;
  setSourcePaneVisible: (visible: boolean) => void;
  setTopbarCollapsed: (collapsed: boolean) => void;
  setZoom: (value: number) => void;
}

export interface SvgEditor {
  bindEvents: InteractionController["bindEvents"];
  fitToView: () => void;
  loadDocument: HistoryLoadDocument;
  onPointHandlePointerDown: InteractionController["onPointHandlePointerDown"];
  onPathBezierHandlePointerDown: InteractionController["onPathBezierHandlePointerDown"];
  onResizeHandlePointerDown: InteractionController["onResizeHandlePointerDown"];
  onSvgClick: InteractionController["onSvgClick"];
  onSvgPointerDown: InteractionController["onSvgPointerDown"];
  onWindowDragEnd: InteractionController["onWindowDragEnd"];
  onWindowDrop: InteractionController["onWindowDrop"];
  onWindowKeyDown: InteractionController["onWindowKeyDown"];
  onWindowPointerCancel: InteractionController["onWindowPointerCancel"];
  onWindowPointerDown: InteractionController["onWindowPointerDown"];
  onWindowPointerMove: InteractionController["onWindowPointerMove"];
  onWindowPointerUp: InteractionController["onWindowPointerUp"];
  onWindowResize: InteractionController["onWindowResize"];
  onWorkspaceContextMenu: InteractionController["onWorkspaceContextMenu"];
  onWorkspaceDragEnter: InteractionController["onWorkspaceDragEnter"];
  onWorkspaceDragLeave: InteractionController["onWorkspaceDragLeave"];
  onWorkspaceDragOver: InteractionController["onWorkspaceDragOver"];
  onWorkspaceDrop: InteractionController["onWorkspaceDrop"];
  onWorkspacePointerDown: InteractionController["onWorkspacePointerDown"];
  regularizePolygon: DocumentController["regularizePolygon"];
  regularizePolygonEqualSides: DocumentController["regularizePolygonEqualSides"];
  selectNode: SelectionController["selectNode"];
  setGridSnapEnabled: InteractionController["setGridSnapEnabled"];
  setGridSnapSize: InteractionController["setGridSnapSize"];
  setLeftPanelHidden: InteractionController["setLeftPanelHidden"];
  setLeftPanelView: InteractionController["setLeftPanelView"];
  setRightPanelHidden: InteractionController["setRightPanelHidden"];
  setSourcePaneVisible: InteractionController["setSourcePaneVisible"];
  setTopbarCollapsed: InteractionController["setTopbarCollapsed"];
  setZoom: InteractionController["setZoom"];
  toggleNodeCollapse: SelectionController["toggleNodeCollapse"];
  toggleNodeLock: SelectionController["toggleNodeLock"];
  toggleNodeVisibility: DocumentController["toggleNodeVisibility"];
  updateField: DocumentController["updateField"];
  updatePathBezier: DocumentController["updatePathBezier"];
  updatePolygonSides: DocumentController["updatePolygonSides"];
  updatePolylinePointCount: DocumentController["updatePolylinePointCount"];
}

export interface RuntimeControllerDeps {
  emptySvg: string;
  model: SvgModel;
  renderer: SvgRenderer;
  state: SvgRuntimeState;
  store: SvgRuntimeStore;
  ui: SvgStudioUiRefs;
}

export type RuntimeState = SvgRuntimeStateLike & SvgRuntimeState;
