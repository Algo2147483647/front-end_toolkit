import {
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "../../../../../scripts/constants.js";

export function createInteractionController({
  store,
  state,
  ui,
  model,
  renderer,
  emptySvg,
  selectionController,
  historyController,
  documentController
}: any) {
  const runtime = store?.getState?.() || state;
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

  async function openSvgDocumentPicker() {
    const showOpenFilePicker = (window as any).showOpenFilePicker;
    if (typeof showOpenFilePicker !== "function") {
      return null;
    }

    const [handle] = await showOpenFilePicker({
      excludeAcceptAllOption: false,
      multiple: false,
      types: [{
        accept: {
          "image/svg+xml": [".svg"]
        },
        description: "SVG documents"
      }]
    });

    if (!handle) {
      return null;
    }

    const file = await handle.getFile();
    return {
      file,
      handle
    };
  }

  function clampZoom(value: number) {
    return Math.max(0.01, Math.min(2.5, value));
  }

  function setTopbarCollapsed(collapsed: boolean) {
    store.chrome.setTopbarCollapsed(collapsed);
    renderer.syncChrome();
  }

  function setLeftPanelHidden(hidden: boolean) {
    store.chrome.setLeftPanelHidden(hidden);
    renderer.syncChrome();
  }

  function setLeftPanelView(view: string) {
    store.chrome.setLeftPanelView(view);
    renderer.syncChrome();
  }

  function setRightPanelHidden(hidden: boolean) {
    store.chrome.setRightPanelHidden(hidden);
    renderer.syncChrome();
  }

  function setGridSnapEnabled(enabled: boolean) {
    store.chrome.setGridSnapEnabled(enabled);
    try {
      localStorage.setItem(GRID_SNAP_STORAGE_KEY, String(enabled));
    } catch {
      // Ignore storage errors and keep the toggle working for this session.
    }
    renderer.syncChrome();
  }

  function setGridSnapSize(size: string) {
    const parsed = Number.parseInt(size, 10);
    if (!GRID_SNAP_SIZE_OPTIONS.includes(parsed)) {
      if (Number.isFinite(parsed) && parsed >= 1) {
        store.chrome.setGridSnapSize(parsed);
      } else {
        renderer.syncChrome();
        return;
      }
    } else {
      store.chrome.setGridSnapSize(parsed);
    }

    try {
      localStorage.setItem(GRID_SNAP_SIZE_STORAGE_KEY, String(parsed));
    } catch {
      // Ignore storage errors and keep the selector working for this session.
    }
    renderer.syncChrome();
  }

  function setSourcePaneVisible(visible: boolean) {
    store.chrome.setSourceVisible(visible);
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

  function setZoom(value: number) {
    store.viewport.setZoom(clampZoom(value));
    renderer.applyZoom();
  }

  function fitToView() {
    store.viewport.resetPan();
    setZoom(renderer.getFitZoom());
  }

  function clearDropState() {
    store.interaction.clearDropDepth();
    ui.workspaceSurface.classList.remove("is-dropping");
    ui.dropOverlay.classList.add("hidden");
  }

  function isFileDragEvent(event: any) {
    const types = event?.dataTransfer?.types;
    if (!types) {
      return false;
    }

    return [...types].some((type) => type === "Files" || type === "application/x-moz-file");
  }

  function hideContextMenu() {
    store.contextMenu.hide();
    ui.contextMenu.classList.add("hidden");
  }

  function showContextMenu(editorId: string | null, clientX: number, clientY: number) {
    const menuHost = ui.contextMenu.offsetParent || ui.contextMenu.parentElement || document.body;
    const hostRect = menuHost.getBoundingClientRect();
    const menuWidth = ui.contextMenu.offsetWidth || 180;
    const menuHeight = ui.contextMenu.offsetHeight || 100;
    const padding = 12;
    const maxLeft = Math.max(padding, hostRect.width - menuWidth - padding);
    const maxTop = Math.max(padding, hostRect.height - menuHeight - padding);
    const left = Math.max(padding, Math.min(clientX - hostRect.left, maxLeft));
    const top = Math.max(padding, Math.min(clientY - hostRect.top, maxTop));

    store.contextMenu.show({ editorId, x: left, y: top });

    ui.contextMenu.style.left = `${left}px`;
    ui.contextMenu.style.top = `${top}px`;
    ui.contextMenu.classList.remove("hidden");

    const menuTarget = editorId ? runtime.nodeMap.get(editorId) : null;
    const canReorder = !!(menuTarget
      && menuTarget !== runtime.svgRoot
      && menuTarget.parentNode
      && !model.isNodeLocked(menuTarget));
    ui.bringToFrontButton.disabled = !canReorder;
    ui.sendToBackButton.disabled = !canReorder;
  }

  function resolveSelectionTarget(startNode: any) {
    const rawTarget = startNode?.closest?.("[data-editor-id]") || null;
    if (!rawTarget || rawTarget === runtime.svgRoot) {
      return rawTarget;
    }

    return model.resolveEditableNode?.(rawTarget, { preferredNode: startNode }) || rawTarget;
  }

  function normalizeBox(startPoint: { x: number; y: number }, endPoint: { x: number; y: number }) {
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    return {
      x,
      y,
      width: Math.abs(endPoint.x - startPoint.x),
      height: Math.abs(endPoint.y - startPoint.y)
    };
  }

  function rectContainsRect(container: any, target: any) {
    return target.x >= container.x
      && target.y >= container.y
      && target.x + target.width <= container.x + container.width
      && target.y + target.height <= container.y + container.height;
  }

  function isSelectableGeometryNode(node: any) {
    if (!node || node === runtime.svgRoot || model.isNodeLocked(node) || model.isNodeHidden(node)) {
      return false;
    }

    if (node.hasAttribute?.("data-cell-id")) {
      return true;
    }

    return !NON_GEOMETRY_TAGS.has(node.tagName.toLowerCase());
  }

  function getNodeBounds(node: any) {
    return model.getNodeVisualBounds(node);
  }

  function collectSelectionBoxMatches(box: any) {
    const matches = new Set<string>();
    for (const [editorId, node] of runtime.nodeMap.entries()) {
      if (!isSelectableGeometryNode(node)) {
        continue;
      }

      const bounds = getNodeBounds(node);
      if (!bounds) {
        continue;
      }

      if (rectContainsRect(box, bounds)) {
        const resolvedTarget = resolveSelectionTarget(node) || node;
        if (resolvedTarget?.dataset?.editorId) {
          matches.add(resolvedTarget.dataset.editorId);
        } else {
          matches.add(editorId);
        }
      }
    }

    return [...matches];
  }

  function setCanvasPanning(active: boolean) {
    ui.workspaceSurface.classList.toggle("is-panning", active);
  }

  function setSelectionBoxActive(active: boolean) {
    ui.workspaceSurface.classList.toggle("is-selecting", active);
  }

  function beginDrag(node: any, event: PointerEvent) {
    const selectedEditorIds = runtime.selectedIds.has(node.dataset.editorId)
      ? selectionController.getSelectedEditorIds()
      : [node.dataset.editorId];
    const dragItems = selectedEditorIds
      .map((editorId: string) => runtime.nodeMap.get(editorId))
      .filter((selectedNode: any) => selectedNode && model.canDragNode(selectedNode))
      .map((selectedNode: any) => {
        const referenceNode = selectedNode.parentElement || runtime.svgRoot;
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

    store.interaction.setDrag({
      items: dragItems,
      moved: false,
      type: "selection"
    });
    ui.statusPill.textContent = dragItems.length > 1
      ? `Dragging ${dragItems.length} objects`
      : `Dragging: ${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
  }

  function beginCanvasDrag(event: PointerEvent, source = "surface") {
    store.interaction.setDrag({
      type: "canvas",
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPanX: runtime.panX,
      startPanY: runtime.panY,
      moved: false,
      source
    });
    setCanvasPanning(true);
    ui.statusPill.textContent = "Panning canvas";
  }

  function beginResizeDrag(editorId: string, handle: string) {
    const node = runtime.nodeMap.get(editorId);
    if (!node || !model.canResizeNode(node)) {
      return;
    }

    const descriptor = model.getResizeDescriptor(node, handle);
    if (!descriptor) {
      return;
    }

    store.interaction.setDrag({
      descriptor,
      editorId,
      moved: false,
      referenceNode: descriptor.referenceNode || runtime.svgRoot,
      type: "resize"
    });
    ui.statusPill.textContent = `Resizing: ${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
  }

  function beginPathBezierDrag(editorId: string, handle: string) {
    const node = runtime.nodeMap.get(editorId);
    if (!node || node.tagName.toLowerCase() !== "path" || model.isNodeLocked(node)) {
      return;
    }

    const descriptor = model.getPathBezierHandleDescriptor(node, handle);
    if (!descriptor) {
      return;
    }

    store.interaction.setDrag({
      descriptor,
      editorId,
      moved: false,
      type: "path-bezier"
    });
    ui.statusPill.textContent = `Editing curve: ${model.labelFor(node)}`;
  }

  function beginPointHandleDrag(editorId: string, handle: string) {
    const node = runtime.nodeMap.get(editorId);
    if (!node || !["polyline", "polygon"].includes(node.tagName.toLowerCase()) || model.isNodeLocked(node)) {
      return;
    }

    const descriptor = model.getPointHandleDescriptor(node, handle);
    if (!descriptor) {
      return;
    }

    store.interaction.setDrag({
      descriptor,
      editorId,
      moved: false,
      type: "point-handle"
    });
    ui.statusPill.textContent = `Editing points: ${model.labelFor(node)}`;
  }

  function beginSelectionBox(event: PointerEvent, source = "surface") {
    hideContextMenu();
    const point = model.toLocalPoint(runtime.svgRoot, event.clientX, event.clientY);
    store.interaction.setDrag({
      currentPoint: point,
      moved: false,
      source,
      startPoint: point,
      type: "selection-box"
    });
    store.interaction.setSelectionBox({
      x: point.x,
      y: point.y,
      width: 0,
      height: 0
    });
    setSelectionBoxActive(true);
    ui.statusPill.textContent = "Selecting objects";
    renderer.refresh({ overlay: true });
  }

  function moveDrag(event: PointerEvent) {
    if (!runtime.drag) {
      return;
    }

    if (runtime.drag.type === "resize") {
      const node = runtime.nodeMap.get(runtime.drag.editorId);
      if (!node) {
        return;
      }

      const currentPoint = model.toLocalPoint(runtime.drag.referenceNode || runtime.svgRoot, event.clientX, event.clientY);
      const dx = currentPoint.x - runtime.drag.descriptor.startHandle.x;
      const dy = currentPoint.y - runtime.drag.descriptor.startHandle.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        runtime.drag.moved = true;
      }
      model.applyResize(node, runtime.drag.descriptor, currentPoint);
      renderer.refresh({ overlay: true });
      return;
    }

    if (runtime.drag.type === "path-bezier") {
      const node = runtime.nodeMap.get(runtime.drag.editorId);
      if (!node) {
        return;
      }

      const currentPoint = model.toLocalPoint(node, event.clientX, event.clientY);
      const dx = currentPoint.x - runtime.drag.descriptor.startHandle.x;
      const dy = currentPoint.y - runtime.drag.descriptor.startHandle.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        runtime.drag.moved = true;
      }
      model.applyPathBezierHandle(node, runtime.drag.descriptor, currentPoint);
      renderer.refresh({
        inspector: true,
        source: true,
        overlay: true
      });
      return;
    }

    if (runtime.drag.type === "point-handle") {
      const node = runtime.nodeMap.get(runtime.drag.editorId);
      if (!node) {
        return;
      }

      const currentPoint = model.toLocalPoint(node, event.clientX, event.clientY);
      const dx = currentPoint.x - runtime.drag.descriptor.startHandle.x;
      const dy = currentPoint.y - runtime.drag.descriptor.startHandle.y;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        runtime.drag.moved = true;
      }
      model.applyPointHandle(node, runtime.drag.descriptor, currentPoint);
      renderer.refresh({
        inspector: true,
        source: true,
        overlay: true
      });
      return;
    }

    if (runtime.drag.type === "canvas") {
      const dx = event.clientX - runtime.drag.startClientX;
      const dy = event.clientY - runtime.drag.startClientY;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        runtime.drag.moved = true;
      }
      store.viewport.setPan(runtime.drag.startPanX + dx, runtime.drag.startPanY + dy);
      renderer.applyZoom();
      return;
    }

    if (runtime.drag.type === "selection-box") {
      const currentPoint = model.toLocalPoint(runtime.svgRoot, event.clientX, event.clientY);
      const box = normalizeBox(runtime.drag.startPoint, currentPoint);
      runtime.drag.currentPoint = currentPoint;
      runtime.drag.moved = box.width > 1 || box.height > 1;
      store.interaction.setSelectionBox(box);
      selectionController.setSelection(collectSelectionBoxMatches(box), { render: false });
      renderer.refresh({
        tree: true,
        inspector: true,
        overlay: true,
        actions: true
      });
      return;
    }

    for (const item of runtime.drag.items) {
      const node = runtime.nodeMap.get(item.editorId);
      if (!node) {
        continue;
      }

      const currentPoint = model.toLocalPoint(item.referenceNode, event.clientX, event.clientY);
      const dx = Math.round((currentPoint.x - item.startPoint.x) * 100) / 100;
      const dy = Math.round((currentPoint.y - item.startPoint.y) * 100) / 100;
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        runtime.drag.moved = true;
      }
      model.applyDrag(node, item.descriptor, dx, dy);
    }
    renderer.refresh({ overlay: true });
  }

  function endDrag() {
    if (!runtime.drag) {
      return;
    }

    if (runtime.drag.type === "resize") {
      const moved = runtime.drag.moved;
      store.interaction.clearDrag();
      if (!moved) {
        renderer.refresh({ overlay: true });
        return;
      }

      store.interaction.setSuppressNextSvgClick(true);
      renderer.refresh({
        tree: true,
        inspector: true,
        source: true,
        overlay: true
      });
      historyController.recordHistory("resize");
      return;
    }

    if (runtime.drag.type === "canvas") {
      store.interaction.setSuppressNextContextMenu(runtime.drag.moved);
      store.interaction.setSuppressNextSvgClick(runtime.drag.moved && runtime.drag.source === "svg");
      store.interaction.clearDrag();
      setCanvasPanning(false);
      ui.statusPill.textContent = "Canvas moved";
      return;
    }

    if (runtime.drag.type === "path-bezier") {
      const moved = runtime.drag.moved;
      store.interaction.clearDrag();
      if (!moved) {
        renderer.refresh({ overlay: true });
        return;
      }

      store.interaction.setSuppressNextSvgClick(true);
      renderer.refresh({
        tree: true,
        inspector: true,
        source: true,
        overlay: true
      });
      historyController.recordHistory("path-bezier");
      return;
    }

    if (runtime.drag.type === "point-handle") {
      const moved = runtime.drag.moved;
      store.interaction.clearDrag();
      if (!moved) {
        renderer.refresh({ overlay: true });
        return;
      }

      store.interaction.setSuppressNextSvgClick(true);
      renderer.refresh({
        tree: true,
        inspector: true,
        source: true,
        overlay: true
      });
      historyController.recordHistory("point-handle");
      return;
    }

    if (runtime.drag.type === "selection-box") {
      const moved = runtime.drag.moved;
      const source = runtime.drag.source;
      store.interaction.clearDrag();
      store.interaction.clearSelectionBox();
      setSelectionBoxActive(false);
      if (!moved) {
        selectionController.clearSelection();
      } else {
        selectionController.refreshSelectionState();
        store.interaction.setSuppressNextSvgClick(source === "svg");
      }
      return;
    }

    const moved = runtime.drag.moved;
    store.interaction.clearDrag();
    if (!moved) {
      renderer.refresh({
        inspector: true,
        overlay: true
      });
      return;
    }

    store.interaction.setSuppressNextSvgClick(true);
    renderer.refresh({
      inspector: true,
      source: true,
      overlay: true
    });
    historyController.recordHistory("drag");
  }

  async function handleWorkspaceFiles(fileList: FileList | File[]) {
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

  function onSvgClick(event: MouseEvent) {
    hideContextMenu();
    if (runtime.suppressNextSvgClick) {
      store.interaction.setSuppressNextSvgClick(false);
      return;
    }

    const target = resolveSelectionTarget(event.target);
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (target === runtime.svgRoot) {
      selectionController.clearSelection();
      return;
    }

    selectionController.selectNode(target.dataset.editorId);
  }

  function onSvgPointerDown(event: PointerEvent) {
    hideContextMenu();
    const target = resolveSelectionTarget(event.target);
    if (!target) {
      return;
    }

    if (event.button === 2) {
      event.preventDefault();
      beginCanvasDrag(event, "svg");
      return;
    }

    if (event.button !== 0) {
      return;
    }

    if (target === runtime.svgRoot) {
      event.preventDefault();
      beginSelectionBox(event, "svg");
      return;
    }

    if (!runtime.selectedIds.has(target.dataset.editorId)) {
      selectionController.selectNode(target.dataset.editorId);
    }
    beginDrag(target, event);
  }

  function onResizeHandlePointerDown(event: PointerEvent, editorId: string, handle: string) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!runtime.selectedIds.has(editorId)) {
      selectionController.selectNode(editorId);
    }
    beginResizeDrag(editorId, handle);
  }

  function onPathBezierHandlePointerDown(event: PointerEvent, editorId: string, handle: string) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!runtime.selectedIds.has(editorId)) {
      selectionController.selectNode(editorId);
    }
    beginPathBezierDrag(editorId, handle);
  }

  function onPointHandlePointerDown(event: PointerEvent, editorId: string, handle: string) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    if (!runtime.selectedIds.has(editorId)) {
      selectionController.selectNode(editorId);
    }
    beginPointHandleDrag(editorId, handle);
  }

  function onWorkspaceContextMenu(event: MouseEvent) {
    if (runtime.suppressNextContextMenu) {
      store.interaction.setSuppressNextContextMenu(false);
      hideContextMenu();
      event.preventDefault();
      return;
    }

    const target = resolveSelectionTarget(event.target);
    if (!target || target === runtime.svgRoot) {
      hideContextMenu();
      event.preventDefault();
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectionController.selectNode(target.dataset.editorId);
    showContextMenu(target.dataset.editorId, event.clientX, event.clientY);
  }

  function onWorkspacePointerDown(event: PointerEvent) {
    if (event.button !== 2) {
      hideContextMenu();
    }
    if (event.button === 2) {
      event.preventDefault();
      beginCanvasDrag(event, "surface");
      return;
    }

    if (event.button !== 0) {
      return;
    }

    const editorTarget = (event.target as HTMLElement | null)?.closest?.("[data-editor-id]");
    if (editorTarget) {
      return;
    }

    event.preventDefault();
    beginSelectionBox(event, "surface");
  }

  function onWorkspaceDragEnter(event: DragEvent) {
    if (!isFileDragEvent(event)) {
      return;
    }
    event.preventDefault();
    store.interaction.setDropDepth(runtime.dropDepth + 1);
    ui.workspaceSurface.classList.add("is-dropping");
    ui.dropOverlay.classList.remove("hidden");
  }

  function onWorkspaceDragOver(event: DragEvent) {
    if (!isFileDragEvent(event)) {
      return;
    }
    event.preventDefault();
  }

  function onWorkspaceDragLeave(event: DragEvent) {
    if (!runtime.dropDepth) {
      return;
    }
    event.preventDefault();
    store.interaction.setDropDepth(Math.max(0, runtime.dropDepth - 1));
    if (runtime.dropDepth === 0) {
      clearDropState();
    }
  }

  async function onWorkspaceDrop(event: DragEvent) {
    if (!isFileDragEvent(event)) {
      clearDropState();
      return;
    }
    event.preventDefault();
    clearDropState();
    try {
      await handleWorkspaceFiles(event.dataTransfer?.files || []);
    } catch (error: any) {
      alert(error.message);
    }
  }

  function onWindowPointerMove(event: PointerEvent) {
    moveDrag(event);
  }

  function onWindowPointerUp() {
    endDrag();
  }

  function onWindowPointerCancel() {
    endDrag();
  }

  function onWindowResize() {
    hideContextMenu();
    renderer.applyZoom();
    renderer.refresh({ overlay: true });
  }

  function onWindowDragEnd() {
    clearDropState();
  }

  function onWindowDrop() {
    clearDropState();
  }

  function onWindowPointerDown(event: PointerEvent) {
    if (event.button === 0 && !(event.target as HTMLElement | null)?.closest?.("#contextMenu")) {
      hideContextMenu();
    }
  }

  function onWindowKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && runtime.contextMenu.visible) {
      hideContextMenu();
      return;
    }
    if (event.key === "Escape" && runtime.sourceVisible) {
      setSourcePaneVisible(false);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      historyController.restoreHistory(event.shiftKey ? runtime.historyIndex + 1 : runtime.historyIndex - 1);
      return;
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      documentController.saveToSourceFile().catch((error: any) => {
        alert(error.message);
      });
      return;
    }
    const editable = document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']");
    if ((event.key === "Delete" || event.key === "Backspace") && !editable) {
      documentController.deleteSelection();
    }
  }

  function bindEvents(options: { bindWindowEvents?: boolean; bindWorkspaceEvents?: boolean } = {}) {
    const {
      bindWindowEvents = true,
      bindWorkspaceEvents = true
    } = options;

    ui.importButton.addEventListener("click", async () => {
      if (typeof (window as any).showOpenFilePicker !== "function") {
        ui.fileInput.click();
        return;
      }

      try {
        const pickedFile = await openSvgDocumentPicker();
        if (!pickedFile?.file) {
          return;
        }

        documentController.loadDocument(await pickedFile.file.text(), {
          fileHandle: pickedFile.handle,
          fileName: pickedFile.file.name,
          fitScale: 0.7,
          preserveEditorState: false
        });
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return;
        }
        alert(error.message);
      }
    });
    ui.gridSnapButton.addEventListener("click", () => setGridSnapEnabled(!runtime.gridSnapEnabled));

    ui.gridSnapSizeInput.addEventListener("input", (event: Event) => {
      const value = (event.target as HTMLInputElement).value;
      if (value === "" || value === "-") {
        return;
      }
      setGridSnapSize(value);
    });

    ui.gridSnapSizeInput.addEventListener("change", (event: Event) => {
      const value = (event.target as HTMLInputElement).value;
      if (value === "" || value === "-") {
        renderer.syncChrome();
        return;
      }
      setGridSnapSize(value);
    });

    ui.gridSnapSizeSelect.addEventListener("change", (event: Event) => {
      const value = (event.target as HTMLSelectElement).value;
      if (value) {
        setGridSnapSize(value);
      }
    });

    ui.sourceToggleButton.addEventListener("click", () => setSourcePaneVisible(!runtime.sourceVisible));
    ui.collapseTopbarButton.addEventListener("click", () => setTopbarCollapsed(!runtime.topbarCollapsed));
    ui.showTopbarButton.addEventListener("click", () => setTopbarCollapsed(false));
    ui.leftPanelInsertTab.addEventListener("click", () => setLeftPanelView("insert"));
    ui.leftPanelLayersTab.addEventListener("click", () => setLeftPanelView("layers"));
    ui.hideLeftPanelButton.addEventListener("click", () => setLeftPanelHidden(true));
    ui.hideRightPanelButton.addEventListener("click", () => setRightPanelHidden(true));
    ui.floatingLeftButton.addEventListener("click", () => setLeftPanelHidden(!runtime.leftPanelHidden));
    ui.floatingRightButton.addEventListener("click", () => setRightPanelHidden(!runtime.rightPanelHidden));
    ui.insertImageButton.addEventListener("click", () => ui.imageInput.click());
    ui.newDocumentButton.addEventListener("click", () => documentController.loadDocument(emptySvg, {
      fileHandle: null,
      fileName: "",
      preserveEditorState: false
    }));
    ui.applySourceButton.addEventListener("click", () => {
      try {
        documentController.loadDocument(ui.sourceEditor.value, { preserveEditorState: true });
      } catch (error: any) {
        alert(error.message);
      }
    });
    ui.saveButton.addEventListener("click", async () => {
      try {
        await documentController.saveToSourceFile();
      } catch (error: any) {
        alert(error.message);
      }
    });
    ui.exportButton.addEventListener("click", documentController.downloadSvg);
    ui.fileInput.addEventListener("change", async (event: Event) => {
      const [file] = (event.target as HTMLInputElement).files || [];
      if (!file) {
        return;
      }
      try {
        documentController.loadDocument(await file.text(), {
          fileHandle: null,
          fileName: file.name,
          fitScale: 0.7,
          preserveEditorState: false
        });
        (event.target as HTMLInputElement).value = "";
      } catch (error: any) {
        alert(error.message);
      }
    });
    ui.imageInput.addEventListener("change", async (event: Event) => {
      const [file] = (event.target as HTMLInputElement).files || [];
      if (!file) {
        return;
      }
      try {
        await documentController.insertImageFile(file);
        (event.target as HTMLInputElement).value = "";
      } catch (error: any) {
        alert(error.message);
      }
    });
    ui.insertGrid.addEventListener("click", (event: Event) => {
      const button = (event.target as HTMLElement | null)?.closest?.("[data-insert]") as HTMLElement | null;
      if (!button) {
        return;
      }
      documentController.insertElement(button.dataset.insert);
    });
    ui.undoButton.addEventListener("click", () => historyController.restoreHistory(runtime.historyIndex - 1));
    ui.redoButton.addEventListener("click", () => historyController.restoreHistory(runtime.historyIndex + 1));
    ui.duplicateButton.addEventListener("click", documentController.duplicateSelection);
    ui.deleteButton.addEventListener("click", documentController.deleteSelection);
    ui.zoomInButton.addEventListener("click", () => setZoom(runtime.zoom + 0.1));
    ui.zoomOutButton.addEventListener("click", () => setZoom(runtime.zoom - 0.1));
    ui.zoomResetButton.addEventListener("click", fitToView);
    if (bindWorkspaceEvents) {
      ui.workspaceSurface.addEventListener("contextmenu", onWorkspaceContextMenu as EventListener);
      ui.workspaceSurface.addEventListener("pointerdown", onWorkspacePointerDown as EventListener);
      ui.workspaceSurface.addEventListener("dragenter", onWorkspaceDragEnter as EventListener);
      ui.workspaceSurface.addEventListener("dragover", onWorkspaceDragOver as EventListener);
      ui.workspaceSurface.addEventListener("dragleave", onWorkspaceDragLeave as EventListener);
      ui.workspaceSurface.addEventListener("drop", onWorkspaceDrop as unknown as EventListener);
    }
    ui.contextMenu.addEventListener("pointerdown", (event: Event) => {
      event.stopPropagation();
    });
    ui.bringToFrontButton.addEventListener("click", () => {
      documentController.bringSelectionToFront(runtime.contextMenu.editorId);
      hideContextMenu();
    });
    ui.sendToBackButton.addEventListener("click", () => {
      documentController.sendSelectionToBack(runtime.contextMenu.editorId);
      hideContextMenu();
    });
    if (bindWindowEvents) {
      window.addEventListener("pointermove", onWindowPointerMove);
      window.addEventListener("pointerup", onWindowPointerUp);
      window.addEventListener("pointercancel", onWindowPointerCancel);
      window.addEventListener("resize", onWindowResize);
      window.addEventListener("dragend", onWindowDragEnd);
      window.addEventListener("drop", onWindowDrop);
      window.addEventListener("pointerdown", onWindowPointerDown);
      window.addEventListener("keydown", onWindowKeyDown);
    }
  }

  return {
    bindEvents,
    fitToView,
    onPointHandlePointerDown,
    onPathBezierHandlePointerDown,
    onResizeHandlePointerDown,
    onSvgClick,
    onSvgPointerDown,
    onWindowDragEnd,
    onWindowDrop,
    onWindowKeyDown,
    onWindowPointerCancel,
    onWindowPointerDown,
    onWindowPointerMove,
    onWindowPointerUp,
    onWindowResize,
    onWorkspaceContextMenu,
    onWorkspaceDragEnter,
    onWorkspaceDragLeave,
    onWorkspaceDragOver,
    onWorkspaceDrop,
    onWorkspacePointerDown,
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
