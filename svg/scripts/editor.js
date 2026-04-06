import { createDocumentController } from "./controllers/document-controller.js";
import { createHistoryController } from "./controllers/history-controller.js";
import { createInteractionController } from "./controllers/interaction-controller.js";
import { createSelectionController } from "./controllers/selection-controller.js";

export function createEditor({ state, ui, model, renderer, emptySvg }) {
  const selectionController = createSelectionController({ state, model, renderer });
  const historyController = createHistoryController({ state, model, renderer });
  const documentController = createDocumentController({
    state,
    ui,
    model,
    renderer,
    emptySvg,
    selectionController,
    historyController
  });
  const interactionController = createInteractionController({
    state,
    ui,
    model,
    renderer,
    emptySvg,
    selectionController,
    historyController,
    documentController
  });

  historyController.setLoadDocument(documentController.loadDocument);

  return {
    bindEvents: interactionController.bindEvents,
    fitToView: interactionController.fitToView,
    loadDocument: documentController.loadDocument,
    onPointHandlePointerDown: interactionController.onPointHandlePointerDown,
    onPathBezierHandlePointerDown: interactionController.onPathBezierHandlePointerDown,
    onResizeHandlePointerDown: interactionController.onResizeHandlePointerDown,
    onSvgClick: interactionController.onSvgClick,
    onSvgPointerDown: interactionController.onSvgPointerDown,
    onWindowDragEnd: interactionController.onWindowDragEnd,
    onWindowDrop: interactionController.onWindowDrop,
    onWindowKeyDown: interactionController.onWindowKeyDown,
    onWindowPointerCancel: interactionController.onWindowPointerCancel,
    onWindowPointerDown: interactionController.onWindowPointerDown,
    onWindowPointerMove: interactionController.onWindowPointerMove,
    onWindowPointerUp: interactionController.onWindowPointerUp,
    onWindowResize: interactionController.onWindowResize,
    onWorkspaceContextMenu: interactionController.onWorkspaceContextMenu,
    onWorkspaceDragEnter: interactionController.onWorkspaceDragEnter,
    onWorkspaceDragLeave: interactionController.onWorkspaceDragLeave,
    onWorkspaceDragOver: interactionController.onWorkspaceDragOver,
    onWorkspaceDrop: interactionController.onWorkspaceDrop,
    onWorkspacePointerDown: interactionController.onWorkspacePointerDown,
    selectNode: selectionController.selectNode,
    setGridSnapEnabled: interactionController.setGridSnapEnabled,
    setGridSnapSize: interactionController.setGridSnapSize,
    setLeftPanelHidden: interactionController.setLeftPanelHidden,
    setLeftPanelView: interactionController.setLeftPanelView,
    setRightPanelHidden: interactionController.setRightPanelHidden,
    setSourcePaneVisible: interactionController.setSourcePaneVisible,
    setTopbarCollapsed: interactionController.setTopbarCollapsed,
    setZoom: interactionController.setZoom,
    regularizePolygon: documentController.regularizePolygon,
    regularizePolygonEqualSides: documentController.regularizePolygonEqualSides,
    toggleNodeCollapse: selectionController.toggleNodeCollapse,
    toggleNodeLock: selectionController.toggleNodeLock,
    toggleNodeVisibility: documentController.toggleNodeVisibility,
    updateField: documentController.updateField,
    updatePathBezier: documentController.updatePathBezier,
    updatePolygonSides: documentController.updatePolygonSides,
    updatePolylinePointCount: documentController.updatePolylinePointCount
  };
}
