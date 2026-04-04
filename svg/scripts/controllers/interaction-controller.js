import {
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "../constants.js";

export function createInteractionController({
  state,
  ui,
  model,
  renderer,
  emptySvg,
  selectionController,
  historyController,
  documentController
}) {
  const NON_GEOMETRY_TAGS = new Set([
    "svg",
    "g",
    "defs",
    "style",
    "clipPath",
    "mask",
    "symbol",
    "linearGradient",
    "radialGradient",
    "stop",
    "pattern",
    "marker"
  ]);

  function clampZoom(value) {
    return Math.max(0.01, Math.min(2.5, value));
  }

  function setTopbarCollapsed(collapsed) {
    state.topbarCollapsed = collapsed;
    renderer.syncChrome();
  }

  function setLeftPanelHidden(hidden) {
    state.leftPanelHidden = hidden;
    renderer.syncChrome();
  }

  function setLeftPanelView(view) {
    state.leftPanelView = view === "layers" ? "layers" : "insert";
    renderer.syncChrome();
  }

  function setRightPanelHidden(hidden) {
    state.rightPanelHidden = hidden;
    renderer.syncChrome();
  }

  function setGridSnapEnabled(enabled) {
    state.gridSnapEnabled = enabled;
    try {
      localStorage.setItem(GRID_SNAP_STORAGE_KEY, String(enabled));
    } catch (error) {
      // Ignore storage errors and keep the toggle working for this session.
    }
    renderer.syncChrome();
  }

  function setGridSnapSize(size) {
    const parsed = Number.parseInt(size, 10);
    if (!GRID_SNAP_SIZE_OPTIONS.includes(parsed)) {
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 100) {
        state.gridSnapSize = parsed;
      } else {
        renderer.syncChrome();
        return;
      }
    } else {
      state.gridSnapSize = parsed;
    }

    try {
      localStorage.setItem(GRID_SNAP_SIZE_STORAGE_KEY, String(parsed));
    } catch (error) {
      // Ignore storage errors and keep the selector working for this session.
    }
    renderer.syncChrome();
  }

  function setSourcePaneVisible(visible) {
    state.sourceVisible = visible;
    ui.sourcePane.classList.toggle("hidden", !visible);
    ui.workspaceContent.classList.toggle("is-source-visible", visible);
    ui.sourceToggleButton.classList.toggle("is-active", visible);
    if (visible) {
      renderer.refresh({ source: true });
      requestAnimationFrame(() => ui.sourceEditor.focus());
    }
    ui.sourceToggleButton.setAttribute("aria-expanded", String(visible));
    ui.sourceToggleButton.title = visible ? "Hide source" : "Show source";
  }

  function setZoom(value) {
    state.zoom = clampZoom(value);
    renderer.applyZoom();
  }

  function fitToView() {
    state.panX = 0;
    state.panY = 0;
    setZoom(renderer.getFitZoom());
  }

  function clearDropState() {
    state.dropDepth = 0;
    ui.workspaceSurface.classList.remove("is-dropping");
    ui.dropOverlay.classList.add("hidden");
  }

  function hideContextMenu() {
    state.contextMenu.visible = false;
    state.contextMenu.editorId = null;
    ui.contextMenu.classList.add("hidden");
  }

  function showContextMenu(editorId, clientX, clientY) {
    const menuHost = ui.contextMenu.offsetParent || ui.contextMenu.parentElement || document.body;
    const hostRect = menuHost.getBoundingClientRect();
    const menuWidth = ui.contextMenu.offsetWidth || 180;
    const menuHeight = ui.contextMenu.offsetHeight || 100;
    const padding = 12;
    const maxLeft = Math.max(padding, hostRect.width - menuWidth - padding);
    const maxTop = Math.max(padding, hostRect.height - menuHeight - padding);
    const left = Math.max(padding, Math.min(clientX - hostRect.left, maxLeft));
    const top = Math.max(padding, Math.min(clientY - hostRect.top, maxTop));

    state.contextMenu = {
      editorId,
      visible: true,
      x: left,
      y: top
    };

    ui.contextMenu.style.left = `${left}px`;
    ui.contextMenu.style.top = `${top}px`;
    ui.contextMenu.classList.remove("hidden");

    const hasTargets = selectionController.getSelectionTargets().some((node) => !model.isNodeLocked(node));
    ui.bringToFrontButton.disabled = !hasTargets;
    ui.sendToBackButton.disabled = !hasTargets;
  }

  function normalizeBox(startPoint, endPoint) {
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    return {
      x,
      y,
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y)
    };
  }

  function rectsIntersect(a, b) {
    return a.x <= b.x + b.width
      && a.x + a.width >= b.x
      && a.y <= b.y + b.height
      && a.y + a.height >= b.y;
  }

  function isSelectableGeometryNode(node) {
    if (!node || node === state.svgRoot || model.isNodeLocked(node) || model.isNodeHidden(node)) {
      return false;
    }

    return !NON_GEOMETRY_TAGS.has(node.tagName.toLowerCase());
  }

  function getNodeBounds(node) {
    try {
      const box = node.getBBox();
      if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || !Number.isFinite(box.width) || !Number.isFinite(box.height)) {
        return null;
      }
      return box;
    } catch (error) {
      return null;
    }
  }

  function collectSelectionBoxMatches(box) {
    const matches = [];
    for (const [editorId, node] of state.nodeMap.entries()) {
      if (!isSelectableGeometryNode(node)) {
        continue;
      }

      const bounds = getNodeBounds(node);
      if (!bounds) {
        continue;
      }

      if (rectsIntersect(box, bounds)) {
        matches.push(editorId);
      }
    }

    return matches;
  }

  function setCanvasPanning(active) {
    ui.workspaceSurface.classList.toggle("is-panning", active);
  }

  function setSelectionBoxActive(active) {
    ui.workspaceSurface.classList.toggle("is-selecting", active);
  }

  function beginDrag(node, event) {
    const selectedEditorIds = state.selectedIds.has(node.dataset.editorId)
      ? selectionController.getSelectedEditorIds()
      : [node.dataset.editorId];
    const dragItems = selectedEditorIds
      .map((editorId) => state.nodeMap.get(editorId))
      .filter((selectedNode) => selectedNode && model.canDragNode(selectedNode))
      .map((selectedNode) => {
        const referenceNode = selectedNode.parentElement || state.svgRoot;
        return {
          editorId: selectedNode.dataset.editorId,
          descriptor: model.getDragDescriptor(selectedNode),
          startPoint: model.toLocalPoint(referenceNode, event.clientX, event.clientY),
          referenceNode
        };
      });

    if (!dragItems.length) {
      return;
    }

    state.drag = {
      items: dragItems,
      moved: false,
      type: "selection"
    };
    ui.statusPill.textContent = dragItems.length > 1
      ? `Dragging ${dragItems.length} objects`
      : `Dragging: ${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
  }

  function beginCanvasDrag(event, source = "surface") {
    state.drag = {
      type: "canvas",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: state.panX,
      startPanY: state.panY,
      moved: false,
      source
    };
    setCanvasPanning(true);
    ui.statusPill.textContent = "Panning canvas";
  }

  function beginResizeDrag(editorId, handle, event) {
    const node = state.nodeMap.get(editorId);
    if (!node || !model.canResizeNode(node)) {
      return;
    }

    const descriptor = model.getResizeDescriptor(node, handle);
    if (!descriptor) {
      return;
    }

    state.drag = {
      descriptor,
      editorId,
      moved: false,
      type: "resize"
    };
    ui.statusPill.textContent = `Resizing: ${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
  }

  function beginPathBezierDrag(editorId, handle, event) {
    const node = state.nodeMap.get(editorId);
    if (!node || node.tagName.toLowerCase() !== "path" || model.isNodeLocked(node)) {
      return;
    }

    const descriptor = model.getPathBezierHandleDescriptor(node, handle);
    if (!descriptor) {
      return;
    }

    state.drag = {
      descriptor,
      editorId,
      moved: false,
      type: "path-bezier"
    };
    ui.statusPill.textContent = `Editing curve: ${model.labelFor(node)}`;
  }

  function beginSelectionBox(event, source = "surface") {
    hideContextMenu();
    const point = model.toLocalPoint(state.svgRoot, event.clientX, event.clientY);
    state.drag = {
      currentPoint: point,
      moved: false,
      source,
      startPoint: point,
      type: "selection-box"
    };
    state.selectionBox = {
      x: point.x,
      y: point.y,
      width: 0,
      height: 0
    };
    setSelectionBoxActive(true);
    ui.statusPill.textContent = "Selecting objects";
    renderer.refresh({ overlay: true });
  }

  function moveDrag(event) {
    if (!state.drag) {
      return;
    }

    if (state.drag.type === "resize") {
      const node = state.nodeMap.get(state.drag.editorId);
      if (!node) {
        return;
      }

      const currentPoint = model.toLocalPoint(state.svgRoot, event.clientX, event.clientY);
      const dx = currentPoint.x - state.drag.descriptor.startHandle.x;
      const dy = currentPoint.y - state.drag.descriptor.startHandle.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        state.drag.moved = true;
      }
      model.applyResize(node, state.drag.descriptor, currentPoint);
      renderer.refresh({ overlay: true });
      return;
    }

    if (state.drag.type === "path-bezier") {
      const node = state.nodeMap.get(state.drag.editorId);
      if (!node) {
        return;
      }

      const currentPoint = model.toLocalPoint(node, event.clientX, event.clientY);
      const dx = currentPoint.x - state.drag.descriptor.startHandle.x;
      const dy = currentPoint.y - state.drag.descriptor.startHandle.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        state.drag.moved = true;
      }
      model.applyPathBezierHandle(node, state.drag.descriptor, currentPoint);
      renderer.refresh({
        inspector: true,
        source: true,
        overlay: true
      });
      return;
    }

    if (state.drag.type === "canvas") {
      const dx = event.clientX - state.drag.startClientX;
      const dy = event.clientY - state.drag.startClientY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        state.drag.moved = true;
      }
      state.panX = state.drag.startPanX + dx;
      state.panY = state.drag.startPanY + dy;
      renderer.applyZoom();
      return;
    }

    if (state.drag.type === "selection-box") {
      const currentPoint = model.toLocalPoint(state.svgRoot, event.clientX, event.clientY);
      const box = normalizeBox(state.drag.startPoint, currentPoint);
      state.drag.currentPoint = currentPoint;
      state.drag.moved = box.width > 1 || box.height > 1;
      state.selectionBox = box;
      selectionController.setSelection(collectSelectionBoxMatches(box), { render: false });
      renderer.refresh({
        tree: true,
        inspector: true,
        overlay: true,
        actions: true
      });
      return;
    }

    for (const item of state.drag.items) {
      const node = state.nodeMap.get(item.editorId);
      if (!node) {
        continue;
      }

      const currentPoint = model.toLocalPoint(item.referenceNode, event.clientX, event.clientY);
      const dx = Math.round((currentPoint.x - item.startPoint.x) * 100) / 100;
      const dy = Math.round((currentPoint.y - item.startPoint.y) * 100) / 100;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        state.drag.moved = true;
      }
      model.applyDrag(node, item.descriptor, dx, dy);
    }
    renderer.refresh({ overlay: true });
  }

  function endDrag() {
    if (!state.drag) {
      return;
    }

    if (state.drag.type === "resize") {
      const moved = state.drag.moved;
      state.drag = null;
      if (!moved) {
        renderer.refresh({ overlay: true });
        return;
      }

      state.suppressNextSvgClick = true;
      renderer.refresh({
        tree: true,
        inspector: true,
        source: true,
        overlay: true
      });
      historyController.recordHistory("resize");
      return;
    }

    if (state.drag.type === "canvas") {
      state.suppressNextSvgClick = state.drag.moved && state.drag.source === "svg";
      state.drag = null;
      setCanvasPanning(false);
      ui.statusPill.textContent = "Canvas moved";
      return;
    }

    if (state.drag.type === "path-bezier") {
      const moved = state.drag.moved;
      state.drag = null;
      if (!moved) {
        renderer.refresh({ overlay: true });
        return;
      }

      state.suppressNextSvgClick = true;
      renderer.refresh({
        tree: true,
        inspector: true,
        source: true,
        overlay: true
      });
      historyController.recordHistory("path-bezier");
      return;
    }

    if (state.drag.type === "selection-box") {
      const moved = state.drag.moved;
      const source = state.drag.source;
      state.drag = null;
      state.selectionBox = null;
      setSelectionBoxActive(false);
      if (!moved) {
        selectionController.clearSelection();
      } else {
        selectionController.refreshSelectionState();
        state.suppressNextSvgClick = source === "svg";
      }
      return;
    }

    const moved = state.drag.moved;
    state.drag = null;
    if (!moved) {
      renderer.refresh({
        inspector: true,
        overlay: true
      });
      return;
    }

    state.suppressNextSvgClick = true;
    renderer.refresh({
      inspector: true,
      source: true,
      overlay: true
    });
    historyController.recordHistory("drag");
  }

  async function handleWorkspaceFiles(fileList) {
    const files = [...fileList];
    if (!files.length) {
      return;
    }

    for (const file of files) {
      const isSvg = file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
      const isImage = file.type.startsWith("image/") || isSvg;
      if (!isImage) {
        continue;
      }

      await documentController.insertImageFile(file);
    }
  }

  function onSvgClick(event) {
    hideContextMenu();
    if (state.suppressNextSvgClick) {
      state.suppressNextSvgClick = false;
      return;
    }

    const target = event.target.closest("[data-editor-id]");
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (target === state.svgRoot) {
      selectionController.clearSelection();
      return;
    }

    selectionController.selectNode(target.dataset.editorId);
  }

  function onSvgPointerDown(event) {
    hideContextMenu();
    const target = event.target.closest("[data-editor-id]");
    if (!target) {
      return;
    }

    if (event.button === 2 && target === state.svgRoot) {
      event.preventDefault();
      beginCanvasDrag(event, "svg");
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (target === state.svgRoot) {
      event.preventDefault();
      beginSelectionBox(event, "svg");
      return;
    }

    if (!state.selectedIds.has(target.dataset.editorId)) {
      selectionController.selectNode(target.dataset.editorId);
    }
    beginDrag(target, event);
  }

  function onResizeHandlePointerDown(event, editorId, handle) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!state.selectedIds.has(editorId)) {
      selectionController.selectNode(editorId);
    }
    beginResizeDrag(editorId, handle, event);
  }

  function onPathBezierHandlePointerDown(event, editorId, handle) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!state.selectedIds.has(editorId)) {
      selectionController.selectNode(editorId);
    }
    beginPathBezierDrag(editorId, handle, event);
  }

  function onWorkspaceContextMenu(event) {
    const target = event.target.closest("[data-editor-id]");
    if (!target || target === state.svgRoot) {
      hideContextMenu();
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!state.selectedIds.has(target.dataset.editorId)) {
      selectionController.selectNode(target.dataset.editorId);
    }
    showContextMenu(target.dataset.editorId, event.clientX, event.clientY);
  }

  function bindEvents() {
    ui.importButton.addEventListener("click", () => ui.fileInput.click());
    ui.gridSnapButton.addEventListener("click", () => setGridSnapEnabled(!state.gridSnapEnabled));

    ui.gridSnapSizeInput.addEventListener("input", (event) => {
      const value = event.target.value;
      if (value === "" || value === "-") {
        return;
      }
      setGridSnapSize(value);
    });

    ui.gridSnapSizeInput.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value === "" || value === "-") {
        renderer.syncChrome();
        return;
      }
      setGridSnapSize(value);
    });

    ui.gridSnapSizeSelect.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value) {
        setGridSnapSize(value);
      }
    });

    ui.sourceToggleButton.addEventListener("click", () => setSourcePaneVisible(!state.sourceVisible));
    ui.collapseTopbarButton.addEventListener("click", () => setTopbarCollapsed(!state.topbarCollapsed));
    ui.showTopbarButton.addEventListener("click", () => setTopbarCollapsed(false));
    ui.leftPanelInsertTab.addEventListener("click", () => setLeftPanelView("insert"));
    ui.leftPanelLayersTab.addEventListener("click", () => setLeftPanelView("layers"));
    ui.hideLeftPanelButton.addEventListener("click", () => setLeftPanelHidden(true));
    ui.hideRightPanelButton.addEventListener("click", () => setRightPanelHidden(true));
    ui.floatingLeftButton.addEventListener("click", () => setLeftPanelHidden(!state.leftPanelHidden));
    ui.floatingRightButton.addEventListener("click", () => setRightPanelHidden(!state.rightPanelHidden));
    ui.insertImageButton.addEventListener("click", () => ui.imageInput.click());
    ui.newDocumentButton.addEventListener("click", () => documentController.loadDocument(emptySvg, { preserveEditorState: false }));
    ui.applySourceButton.addEventListener("click", () => {
      try {
        documentController.loadDocument(ui.sourceEditor.value, { preserveEditorState: true });
      } catch (error) {
        alert(error.message);
      }
    });
    ui.exportButton.addEventListener("click", documentController.downloadSvg);
    ui.fileInput.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }
      try {
        documentController.loadDocument(await file.text(), {
          fitScale: 0.7,
          preserveEditorState: false
        });
        event.target.value = "";
      } catch (error) {
        alert(error.message);
      }
    });
    ui.imageInput.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }
      try {
        await documentController.insertImageFile(file);
        event.target.value = "";
      } catch (error) {
        alert(error.message);
      }
    });
    ui.insertGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-insert]");
      if (!button) {
        return;
      }
      documentController.insertElement(button.dataset.insert);
    });
    ui.undoButton.addEventListener("click", () => historyController.restoreHistory(state.historyIndex - 1));
    ui.redoButton.addEventListener("click", () => historyController.restoreHistory(state.historyIndex + 1));
    ui.duplicateButton.addEventListener("click", documentController.duplicateSelection);
    ui.deleteButton.addEventListener("click", documentController.deleteSelection);
    ui.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.1));
    ui.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.1));
    ui.zoomResetButton.addEventListener("click", fitToView);
    ui.workspaceSurface.addEventListener("contextmenu", onWorkspaceContextMenu);
    ui.workspaceSurface.addEventListener("pointerdown", (event) => {
      const editorTarget = event.target.closest("[data-editor-id]");
      if (event.button !== 2) {
        hideContextMenu();
      }
      if (event.button === 2) {
        if (editorTarget && editorTarget !== state.svgRoot) {
          return;
        }
        event.preventDefault();
        beginCanvasDrag(event, "surface");
        return;
      }

      if (event.button !== 0) {
        return;
      }

      if (editorTarget) {
        return;
      }

      event.preventDefault();
      beginSelectionBox(event, "surface");
    });
    ui.workspaceSurface.addEventListener("dragenter", (event) => {
      event.preventDefault();
      state.dropDepth += 1;
      ui.workspaceSurface.classList.add("is-dropping");
      ui.dropOverlay.classList.remove("hidden");
    });
    ui.workspaceSurface.addEventListener("dragover", (event) => {
      event.preventDefault();
    });
    ui.workspaceSurface.addEventListener("dragleave", (event) => {
      event.preventDefault();
      state.dropDepth = Math.max(0, state.dropDepth - 1);
      if (state.dropDepth === 0) {
        clearDropState();
      }
    });
    ui.workspaceSurface.addEventListener("drop", async (event) => {
      event.preventDefault();
      clearDropState();
      try {
        await handleWorkspaceFiles(event.dataTransfer?.files || []);
      } catch (error) {
        alert(error.message);
      }
    });
    ui.contextMenu.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    ui.bringToFrontButton.addEventListener("click", () => {
      documentController.bringSelectionToFront();
      hideContextMenu();
    });
    ui.sendToBackButton.addEventListener("click", () => {
      documentController.sendSelectionToBack();
      hideContextMenu();
    });
    window.addEventListener("pointermove", (event) => {
      moveDrag(event);
    });
    window.addEventListener("pointerup", () => {
      endDrag();
    });
    window.addEventListener("pointercancel", () => {
      endDrag();
    });
    window.addEventListener("resize", () => {
      hideContextMenu();
      renderer.applyZoom();
      renderer.refresh({ overlay: true });
    });
    window.addEventListener("pointerdown", (event) => {
      if (event.button === 0 && !event.target.closest("#contextMenu")) {
        hideContextMenu();
      }
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.contextMenu.visible) {
        hideContextMenu();
        return;
      }
      if (event.key === "Escape" && state.sourceVisible) {
        setSourcePaneVisible(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        historyController.restoreHistory(event.shiftKey ? state.historyIndex + 1 : state.historyIndex - 1);
      }
      const editable = document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']");
      if ((event.key === "Delete" || event.key === "Backspace") && !editable) {
        documentController.deleteSelection();
      }
    });
  }

  return {
    bindEvents,
    fitToView,
    onPathBezierHandlePointerDown,
    onResizeHandlePointerDown,
    onSvgClick,
    onSvgPointerDown,
    setGridSnapEnabled,
    setGridSnapSize,
    setLeftPanelHidden,
    setLeftPanelView,
    setRightPanelHidden,
    setSourcePaneVisible,
    setTopbarCollapsed,
    setZoom
  };
}
