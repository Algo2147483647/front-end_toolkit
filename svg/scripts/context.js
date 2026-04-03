import {
  GRID_SCREEN_SIZE,
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "./constants.js";

function readStoredBoolean(key, fallback = false) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === "true") return true;
    if (raw === "false") return false;
  } catch (error) {
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
  } catch (error) {
    return fallback;
  }
}

function normalizeGridSnapSize(value) {
  const parsed = Number.parseFloat(value);
  if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
    return parsed;
  }
  return GRID_SNAP_SIZE_OPTIONS.includes(parsed) ? parsed : GRID_SCREEN_SIZE;
}

const $ = (selector) => document.querySelector(selector);

export const ui = {
  appShell: $("#appShell"),
  topbar: $("#topbar"),
  leftPanel: $("#leftPanel"),
  rightPanel: $("#rightPanel"),
  fileInput: $("#fileInput"),
  imageInput: $("#imageInput"),
  importButton: $("#importButton"),
  gridSnapButton: $("#gridSnapButton"),
  gridSnapSizeGroup: $("#gridSnapSizeGroup"),
  gridSnapSizeInput: $("#gridSnapSizeInput"),
  gridSnapSizeSelect: $("#gridSnapSizeSelect"),
  sourceToggleButton: $("#sourceToggleButton"),
  collapseTopbarButton: $("#collapseTopbarButton"),
  showTopbarButton: $("#showTopbarButton"),
  hideLeftPanelButton: $("#hideLeftPanelButton"),
  hideRightPanelButton: $("#hideRightPanelButton"),
  floatingLeftButton: $("#floatingLeftButton"),
  floatingRightButton: $("#floatingRightButton"),
  insertImageButton: $("#insertImageButton"),
  newDocumentButton: $("#newDocumentButton"),
  applySourceButton: $("#applySourceButton"),
  exportButton: $("#exportButton"),
  undoButton: $("#undoButton"),
  redoButton: $("#redoButton"),
  duplicateButton: $("#duplicateButton"),
  deleteButton: $("#deleteButton"),
  zoomOutButton: $("#zoomOutButton"),
  zoomInButton: $("#zoomInButton"),
  zoomResetButton: $("#zoomResetButton"),
  zoomLabel: $("#zoomLabel"),
  statusPill: $("#statusPill"),
  nodeCountBadge: $("#nodeCountBadge"),
  treePanel: $("#treePanel"),
  svgHost: $("#svgHost"),
  overlay: $("#selectionOverlay"),
  insertGrid: $("#insertGrid"),
  workspaceSurface: $("#workspaceSurface"),
  workspaceContent: $("#workspaceContent"),
  dropOverlay: $("#dropOverlay"),
  sourcePane: $("#sourcePane"),
  sourceEditor: $("#sourceEditor"),
  propertyForm: $("#propertyForm"),
  inspectorEmpty: $("#inspectorEmpty"),
  fieldTemplate: $("#propertyFieldTemplate")
};

export const state = {
  svgRoot: null,
  nodeMap: new Map(),
  selectedId: null,
  selectedNodeKey: null,
  nextId: 0,
  zoom: 1,
  gridSnapEnabled: readStoredBoolean(GRID_SNAP_STORAGE_KEY, false),
  gridSnapSize: normalizeGridSnapSize(readStoredNumber(GRID_SNAP_SIZE_STORAGE_KEY, GRID_SCREEN_SIZE)),
  topbarCollapsed: false,
  leftPanelHidden: false,
  rightPanelHidden: false,
  sourceVisible: false,
  history: [],
  historyIndex: -1,
  restoring: false,
  drag: null,
  dropDepth: 0,
  warnings: [],
  collapsedNodeKeys: new Set(),
  lockedNodeKeys: new Set(),
  nodeKeyByEditorId: new Map(),
  editorIdByNodeKey: new Map(),
  nodeKeyByNode: new WeakMap()
};
