import { areSelectionsEqual, isSelectionValid, remapSelectionKeys, removeSelectionKeys } from "../graph/selectors";
import { initialGraphAppState, type GraphAppState } from "./initialState";
import type { GraphAction } from "./graphActions";

export function graphReducer(state: GraphAppState, action: GraphAction): GraphAppState {
  switch (action.type) {
    case "graphLoaded":
      return {
        ...initialGraphAppState,
        dag: action.dag,
        source: {
          fileName: action.fileName,
          fileHandle: action.fileHandle || null,
          dirty: false,
        },
        selection: action.selection,
        ui: {
          ...initialGraphAppState.ui,
          status: action.status,
        },
      };
    case "graphLoadFailed":
      return { ...state, dag: null, ui: { ...state.ui, status: action.status } };
    case "selectionChanged": {
      const shouldPush = action.pushHistory && state.selection && !areSelectionsEqual(state.selection, action.selection);
      return {
        ...state,
        selection: action.selection,
        history: shouldPush ? [...state.history, state.selection!] : state.history,
        ui: { ...state.ui, contextMenu: null },
      };
    }
    case "navigateBack": {
      const previousSelection = state.history[state.history.length - 1];
      if (!previousSelection) {
        return state;
      }
      return {
        ...state,
        selection: previousSelection,
        history: state.history.slice(0, -1),
        ui: { ...state.ui, contextMenu: null },
      };
    }
    case "graphCommandCommitted": {
      const { result } = action;
      const renamed = result.renamedKey;
      const deleted = new Set(result.deletedKeys || []);
      let nodeDetail = state.ui.nodeDetail;
      let relationEditor = state.ui.relationEditor;

      if (renamed) {
        nodeDetail = nodeDetail?.nodeKey === renamed.from ? { nodeKey: renamed.to } : nodeDetail;
        relationEditor = relationEditor?.nodeKey === renamed.from ? { ...relationEditor, nodeKey: renamed.to } : relationEditor;
      }
      if (nodeDetail && deleted.has(nodeDetail.nodeKey)) {
        nodeDetail = null;
      }
      if (relationEditor && deleted.has(relationEditor.nodeKey)) {
        relationEditor = null;
      }

      return {
        ...state,
        dag: result.dag,
        source: { ...state.source, dirty: true },
        selection: action.selection,
        history: action.history,
        ui: {
          ...state.ui,
          contextMenu: null,
          relationEditor,
          nodeDetail,
          status: action.status || result.message || state.ui.status,
        },
      };
    }
    case "modeChanged":
      return {
        ...state,
        mode: action.mode,
        ui: {
          ...state.ui,
          contextMenu: null,
          status: state.dag ? `Mode: ${action.mode === "edit" ? "Edit" : "Preview"}.` : state.ui.status,
        },
      };
    case "zoomChanged":
      if (
        Math.abs(state.zoom.scale - action.scale) < 0.0001
        && Math.abs(state.zoom.minScale - (action.minScale ?? state.zoom.minScale)) < 0.0001
      ) {
        return state;
      }
      return {
        ...state,
        zoom: {
          ...state.zoom,
          minScale: action.minScale ?? state.zoom.minScale,
          scale: action.scale,
        },
      };
    case "settingsToggled":
      return { ...state, ui: { ...state.ui, settingsOpen: action.open ?? !state.ui.settingsOpen } };
    case "contextMenuOpened":
      return { ...state, ui: { ...state.ui, contextMenu: { x: action.x, y: action.y, nodeKey: action.nodeKey } } };
    case "contextMenuClosed":
      return { ...state, ui: { ...state.ui, contextMenu: null } };
    case "relationEditorOpened":
      return { ...state, ui: { ...state.ui, contextMenu: null, relationEditor: { nodeKey: action.nodeKey, field: action.field } } };
    case "nodeDetailOpened":
      return { ...state, ui: { ...state.ui, contextMenu: null, nodeDetail: { nodeKey: action.nodeKey } } };
    case "modalClosed":
      return { ...state, ui: { ...state.ui, relationEditor: null, nodeDetail: null, saveDialogOpen: false } };
    case "saveDialogOpened":
      return { ...state, ui: { ...state.ui, saveDialogOpen: true } };
    case "saveDialogClosed":
      return { ...state, ui: { ...state.ui, saveDialogOpen: false } };
    case "saved":
      return { ...state, source: { ...state.source, dirty: false }, ui: { ...state.ui, saveDialogOpen: false, status: action.status } };
    case "statusChanged":
      return { ...state, ui: { ...state.ui, status: action.status } };
  }
}

export function repairHistoryAfterCommand(state: GraphAppState, result: { dag: NonNullable<GraphAppState["dag"]>; renamedKey?: { from: string; to: string }; deletedKeys?: string[] }): GraphAppState["history"] {
  let history = state.history;
  if (result.renamedKey) {
    history = history.map((item) => remapSelectionKeys(item, (key) => (key === result.renamedKey!.from ? result.renamedKey!.to : key))).filter(Boolean) as GraphAppState["history"];
  }
  if (result.deletedKeys?.length) {
    const deleteSet = new Set(result.deletedKeys);
    history = history.map((item) => removeSelectionKeys(item, deleteSet)).filter(Boolean) as GraphAppState["history"];
  }
  return history.filter((item) => isSelectionValid(item, result.dag));
}
