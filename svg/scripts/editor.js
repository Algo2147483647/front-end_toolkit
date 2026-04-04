import {
  GRID_SNAP_SIZE_OPTIONS,
  GRID_SNAP_SIZE_STORAGE_KEY,
  GRID_SNAP_STORAGE_KEY
} from "./constants.js";

export function createEditor({ state, ui, model, renderer, emptySvg }) {
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

  function ensureDocument() {
    if (!state.svgRoot) {
      loadDocument(emptySvg);
    }

    return state.svgRoot;
  }

  function snapshotEditorState() {
    return {
      selectedNodeKey: state.selectedNodeKey,
      selectedNodeKeys: [...state.selectedNodeKeys],
      collapsedNodeKeys: [...state.collapsedNodeKeys],
      lockedNodeKeys: [...state.lockedNodeKeys]
    };
  }

  function restoreEditorState(snapshot) {
    state.selectedNodeKey = snapshot?.selectedNodeKey || null;
    state.selectedNodeKeys = new Set(snapshot?.selectedNodeKeys || []);
    state.collapsedNodeKeys = new Set(snapshot?.collapsedNodeKeys || []);
    state.lockedNodeKeys = new Set(snapshot?.lockedNodeKeys || []);
  }

  function resetEditorState() {
    restoreEditorState(null);
    state.selectedId = null;
    state.selectedIds = new Set();
    state.selectionBox = null;
  }

  function remapMetadataKey(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) {
      return;
    }

    if (state.selectedNodeKey === oldKey) {
      state.selectedNodeKey = newKey;
    }

    if (state.selectedNodeKeys.delete(oldKey)) {
      state.selectedNodeKeys.add(newKey);
    }

    if (state.collapsedNodeKeys.delete(oldKey)) {
      state.collapsedNodeKeys.add(newKey);
    }

    if (state.lockedNodeKeys.delete(oldKey)) {
      state.lockedNodeKeys.add(newKey);
    }
  }

  function resolveLiveSelection(fallbackEditorId = state.svgRoot?.dataset.editorId || null) {
    const resolvedEditorIds = [...state.selectedNodeKeys]
      .map((nodeKey) => model.getEditorIdByNodeKey(nodeKey))
      .filter(Boolean);
    const resolvedEditorId = state.selectedNodeKey
      ? model.getEditorIdByNodeKey(state.selectedNodeKey)
      : null;
    const fallbackIds = resolvedEditorIds.length
      ? resolvedEditorIds
      : (fallbackEditorId ? [fallbackEditorId] : []);

    setSelection(fallbackIds, {
      primaryId: resolvedEditorId || fallbackIds[0] || null,
      render: false
    });
  }

  function recordHistory(reason) {
    if (!state.svgRoot || state.restoring) {
      return;
    }

    const snapshot = model.serialize();
    const previous = state.history[state.historyIndex]?.snapshot;
    if (snapshot === previous) {
      return;
    }

    state.history = state.history.slice(0, state.historyIndex + 1);
    state.history.push({ reason, snapshot });
    if (state.history.length > 80) {
      state.history.shift();
    }
    state.historyIndex = state.history.length - 1;
    renderer.updateActions();
  }

  function restoreHistory(index) {
    const entry = state.history[index];
    if (!entry) {
      return;
    }

    state.restoring = true;
    loadDocument(entry.snapshot, { pushHistory: false, preserveEditorState: true });
    state.historyIndex = index;
    state.restoring = false;
    renderer.updateActions();
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
      // If it's a valid number but not in presets, still allow it
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
      renderer.updateSource();
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

  function renderSelectionState() {
    renderer.renderTree();
    renderer.renderInspector();
    renderer.renderOverlay();
    renderer.updateActions();
  }

  function setSelection(editorIds, options = {}) {
    const { primaryId = null, render = true } = options;
    const validIds = [...new Set(editorIds.filter((editorId) => state.nodeMap.has(editorId)))];
    const nextPrimaryId = validIds.includes(primaryId)
      ? primaryId
      : (validIds[0] || null);

    state.selectedIds = new Set(validIds);
    state.selectedId = nextPrimaryId;
    state.selectedNodeKey = nextPrimaryId
      ? model.getNodeKeyByEditorId(nextPrimaryId)
      : null;
    state.selectedNodeKeys = new Set(
      validIds
        .map((editorId) => model.getNodeKeyByEditorId(editorId))
        .filter(Boolean)
    );

    if (render) {
      renderSelectionState();
    }
  }

  function getSelectedEditorIds() {
    return [...state.selectedIds].filter((editorId) => state.nodeMap.has(editorId));
  }

  function clearSelection() {
    setSelection([]);
  }

  function selectNode(editorId) {
    setSelection(editorId ? [editorId] : [], { primaryId: editorId || null });
  }

  function insertNode(node, recordReason = "insert") {
    const root = ensureDocument();
    const parent = model.getInsertParent() || root;
    model.snapNodeToGrid(node);
    model.addEditorIds(node);
    parent.append(node);
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    renderer.renderWorkspace();
    renderer.renderTree();
    renderer.updateSource();
    selectNode(node.dataset.editorId);
    recordHistory(recordReason);
  }

  function insertElement(kind) {
    insertNode(model.createElementNode(kind), `insert-${kind}`);
  }

  async function insertImageFile(file) {
    ensureDocument();
    const imageNode = await model.createImageNodeFromFile(file);
    insertNode(imageNode, "insert-image");
  }

  function clearDropState() {
    state.dropDepth = 0;
    ui.workspaceSurface.classList.remove("is-dropping");
    ui.dropOverlay.classList.add("hidden");
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

  function getSelectionTargets() {
    const selectedIds = new Set(getSelectedEditorIds());

    return getSelectedEditorIds()
      .map((editorId) => state.nodeMap.get(editorId))
      .filter((node) => node && node !== state.svgRoot && node.parentNode)
      .filter((node) => {
        let parent = node.parentElement;
        while (parent) {
          if (selectedIds.has(parent.dataset?.editorId)) {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      });
  }

  function setCanvasPanning(active) {
    ui.workspaceSurface.classList.toggle("is-panning", active);
  }

  function setSelectionBoxActive(active) {
    ui.workspaceSurface.classList.toggle("is-selecting", active);
  }

  function beginDrag(node, event) {
    const selectedEditorIds = state.selectedIds.has(node.dataset.editorId)
      ? getSelectedEditorIds()
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

  function beginSelectionBox(event, source = "surface") {
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
    renderer.renderOverlay();
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
      renderer.renderOverlay();
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
      setSelection(collectSelectionBoxMatches(box), { render: false });
      renderer.renderTree();
      renderer.renderInspector();
      renderer.renderOverlay();
      renderer.updateActions();
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
    renderer.renderOverlay();
  }

  function endDrag() {
    if (!state.drag) {
      return;
    }

    if (state.drag.type === "resize") {
      const moved = state.drag.moved;
      state.drag = null;
      if (!moved) {
        renderer.renderOverlay();
        return;
      }

      state.suppressNextSvgClick = true;
      renderer.updateSource();
      renderer.renderTree();
      renderer.renderInspector();
      renderer.renderOverlay();
      recordHistory("resize");
      return;
    }

    if (state.drag.type === "canvas") {
      state.suppressNextSvgClick = state.drag.moved && state.drag.source === "svg";
      state.drag = null;
      setCanvasPanning(false);
      ui.statusPill.textContent = "Canvas moved";
      return;
    }

    if (state.drag.type === "selection-box") {
      const moved = state.drag.moved;
      const source = state.drag.source;
      state.drag = null;
      state.selectionBox = null;
      setSelectionBoxActive(false);
      if (!moved) {
        clearSelection();
      } else {
        renderSelectionState();
        state.suppressNextSvgClick = source === "svg";
      }
      return;
    }

    const moved = state.drag.moved;
    state.drag = null;
    if (!moved) {
      renderer.renderOverlay();
      renderer.renderInspector();
      return;
    }

    state.suppressNextSvgClick = true;
    renderer.updateSource();
    renderer.renderInspector();
    renderer.renderOverlay();
    recordHistory("drag");
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

      await insertImageFile(file);
    }
  }

  function onSvgClick(event) {
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
      clearSelection();
      return;
    }

    selectNode(target.dataset.editorId);
  }

  function onSvgPointerDown(event) {
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
      selectNode(target.dataset.editorId);
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
      selectNode(editorId);
    }
    beginResizeDrag(editorId, handle, event);
  }

  function toggleNodeCollapse(editorId) {
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!nodeKey) {
      return;
    }

    if (state.collapsedNodeKeys.has(nodeKey)) {
      state.collapsedNodeKeys.delete(nodeKey);
    } else {
      state.collapsedNodeKeys.add(nodeKey);
    }

    renderer.renderTree();
  }

  function toggleNodeVisibility(editorId) {
    const node = state.nodeMap.get(editorId);
    if (!node || node === state.svgRoot) {
      return;
    }

    if (node.getAttribute("display") === "none") {
      node.removeAttribute("display");
    } else {
      node.setAttribute("display", "none");
    }

    model.syncEditorMetadata();
    renderer.updateSource();
    renderer.renderWorkspace();
    renderer.renderTree();
    renderer.renderInspector();
    renderer.renderOverlay();
    recordHistory("visibility");
  }

  function toggleNodeLock(editorId) {
    const node = state.nodeMap.get(editorId);
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!node || !nodeKey || node === state.svgRoot) {
      return;
    }

    if (state.lockedNodeKeys.has(nodeKey)) {
      state.lockedNodeKeys.delete(nodeKey);
    } else {
      state.lockedNodeKeys.add(nodeKey);
    }

    renderer.renderTree();
    renderer.renderInspector();
    renderer.renderOverlay();
    renderer.updateActions();
    renderer.updateSource();
  }

  function updateField(editorId, field, value, record) {
    const node = state.nodeMap.get(editorId);
    if (!node || field.kind === "readonly" || model.isNodeLocked(node)) {
      return;
    }

    if (field.key === "id") {
      if (!record) {
        return;
      }

      const previousNodeKey = model.getNodeKey(node);
      model.renameNodeId(node, value.trim());
      model.rebuildNodeMap();
      const nextNodeKey = model.getNodeKey(node);
      remapMetadataKey(previousNodeKey, nextNodeKey);
      model.syncEditorMetadata();
      renderer.updateSource();
      renderer.renderWorkspace();
      selectNode(node.dataset.editorId);
      recordHistory("field:id");
      return;
    }

    const nextValue = record && field.kind === "attr"
      ? model.snapFieldValue(field.key, value)
      : value;

    if (field.kind === "text") {
      node.textContent = value;
    } else if (nextValue.trim()) {
      node.setAttribute(field.key, nextValue.trim());
    } else {
      node.removeAttribute(field.key);
    }

    renderer.updateSource();
    renderer.renderTree();
    renderer.renderOverlay();
    if (record) {
      renderer.renderInspector();
      recordHistory(`field:${field.key}`);
    }
  }

  function applyGeometryControl(editorId, reason, applyChange, options = {}) {
    const {
      record = true,
      renderInspector = record,
      renderWorkspace = true
    } = options;
    const node = state.nodeMap.get(editorId);
    if (!node || model.isNodeLocked(node)) {
      return;
    }

    const changed = applyChange(node);
    if (!changed) {
      return;
    }

    model.syncEditorMetadata();
    renderer.updateSource();
    if (renderWorkspace) {
      renderer.renderWorkspace();
    }
    renderer.renderTree();
    if (renderInspector) {
      renderer.renderInspector();
    }
    renderer.renderOverlay();
    if (record) {
      recordHistory(reason);
    }
  }

  function updatePolygonSides(editorId, value, record = true) {
    applyGeometryControl(editorId, "polygon-sides", (node) => model.updatePolygonSideCount(node, value), {
      record,
      renderInspector: record
    });
  }

  function updatePolylinePointCount(editorId, value, record = true) {
    applyGeometryControl(editorId, "polyline-points", (node) => model.updatePolylinePointCount(node, value), {
      record,
      renderInspector: record
    });
  }

  function updatePathBezier(editorId, bezier, record = true) {
    applyGeometryControl(editorId, "path-bezier", (node) => model.updatePathBezier(node, bezier), {
      record,
      renderInspector: record
    });
  }

  function duplicateSelection() {
    const nodes = getSelectionTargets().filter((node) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    const cloneIds = [];
    nodes.forEach((node) => {
      const clone = node.cloneNode(true);
      model.remapSubtreeIds(clone);
      model.addEditorIds(clone);
      node.parentNode.insertBefore(clone, node.nextSibling);
      cloneIds.push(clone.dataset.editorId);
    });
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    renderer.renderTree();
    renderer.updateSource();
    setSelection(cloneIds, { primaryId: cloneIds[cloneIds.length - 1] || null });
    recordHistory("duplicate");
  }

  function deleteSelection() {
    const nodes = getSelectionTargets().filter((node) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    const fallback = nodes[0].previousElementSibling || nodes[0].parentElement || state.svgRoot;
    nodes.forEach((node) => node.remove());
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    renderer.updateSource();
    renderer.renderTree();
    recordHistory("delete");
    selectNode(state.nodeMap.has(fallback?.dataset?.editorId) ? fallback.dataset.editorId : state.svgRoot?.dataset?.editorId || null);
  }

  function downloadSvg() {
    const url = URL.createObjectURL(new Blob([model.serialize()], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "edited-graphic.svg";
    link.click();
    URL.revokeObjectURL(url);
  }

  function loadDocument(source, options = {}) {
    const {
      pushHistory = true,
      preserveEditorState = false
    } = options;

    const preservedEditorState = preserveEditorState ? snapshotEditorState() : null;
    const root = model.parseSvg(source);
    model.addEditorIds(root);
    state.svgRoot = root;
    state.drag = null;
    state.selectionBox = null;
    setCanvasPanning(false);
    setSelectionBoxActive(false);
    if (!preserveEditorState) {
      state.panX = 0;
      state.panY = 0;
    }
    model.rebuildNodeMap();
    if (preservedEditorState) {
      restoreEditorState(preservedEditorState);
    } else {
      resetEditorState();
    }
    model.syncEditorMetadata();
    resolveLiveSelection(root.dataset.editorId);
    renderer.renderWorkspace();
    renderer.renderTree();
    renderer.renderInspector();
    renderer.renderOverlay();
    renderer.updateSource();
    renderer.updateActions();
    if (pushHistory) {
      recordHistory("load");
    }
  }

  function bindEvents() {
    ui.importButton.addEventListener("click", () => ui.fileInput.click());
    ui.gridSnapButton.addEventListener("click", () => setGridSnapEnabled(!state.gridSnapEnabled));
    
    // Handle grid size input changes
    ui.gridSnapSizeInput.addEventListener("input", (event) => {
      const value = event.target.value;
      if (value === "" || value === "-") {
        return; // Allow temporary empty/dash state while typing
      }
      setGridSnapSize(value);
    });
    
    ui.gridSnapSizeInput.addEventListener("change", (event) => {
      const value = event.target.value;
      if (value === "" || value === "-") {
        // Revert to previous valid value if empty
        renderer.syncChrome();
        return;
      }
      setGridSnapSize(value);
    });
    
    // Handle preset selection from dropdown
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
    ui.newDocumentButton.addEventListener("click", () => loadDocument(emptySvg, { preserveEditorState: false }));
    ui.applySourceButton.addEventListener("click", () => {
      try {
        loadDocument(ui.sourceEditor.value, { preserveEditorState: true });
      } catch (error) {
        alert(error.message);
      }
    });
    ui.exportButton.addEventListener("click", downloadSvg);
    ui.fileInput.addEventListener("change", async (event) => {
      const [file] = event.target.files || [];
      if (!file) {
        return;
      }
      try {
        loadDocument(await file.text(), { preserveEditorState: false });
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
        await insertImageFile(file);
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
      insertElement(button.dataset.insert);
    });
    ui.undoButton.addEventListener("click", () => restoreHistory(state.historyIndex - 1));
    ui.redoButton.addEventListener("click", () => restoreHistory(state.historyIndex + 1));
    ui.duplicateButton.addEventListener("click", duplicateSelection);
    ui.deleteButton.addEventListener("click", deleteSelection);
    ui.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.1));
    ui.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.1));
    ui.zoomResetButton.addEventListener("click", fitToView);
    ui.workspaceSurface.addEventListener("contextmenu", (event) => {
      event.preventDefault();
    });
    ui.workspaceSurface.addEventListener("pointerdown", (event) => {
      if (event.button === 2) {
        event.preventDefault();
        beginCanvasDrag(event, "surface");
        return;
      }

      if (event.button !== 0) {
        return;
      }

      if (event.target.closest("[data-editor-id]")) {
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
      renderer.applyZoom();
      renderer.renderOverlay();
    });
    window.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && state.sourceVisible) {
        setSourcePaneVisible(false);
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        restoreHistory(event.shiftKey ? state.historyIndex + 1 : state.historyIndex - 1);
      }
      const editable = document.activeElement?.matches?.("input, textarea, select, [contenteditable='true']");
      if ((event.key === "Delete" || event.key === "Backspace") && !editable) {
        deleteSelection();
      }
    });
  }

  return {
    bindEvents,
    loadDocument,
    onResizeHandlePointerDown,
    onSvgClick,
    onSvgPointerDown,
    selectNode,
    setGridSnapEnabled,
    setGridSnapSize,
    setLeftPanelHidden,
    setLeftPanelView,
    setRightPanelHidden,
    setSourcePaneVisible,
    setTopbarCollapsed,
    fitToView,
    setZoom,
    toggleNodeCollapse,
    toggleNodeLock,
    toggleNodeVisibility,
    updateField,
    updatePathBezier,
    updatePolygonSides,
    updatePolylinePointCount
  };
}
