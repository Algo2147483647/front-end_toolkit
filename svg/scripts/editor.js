import { GRID_SNAP_STORAGE_KEY } from "./constants.js";

export function createEditor({ state, ui, model, renderer, emptySvg }) {
  function ensureDocument() {
    if (!state.svgRoot) {
      loadDocument(emptySvg);
    }

    return state.svgRoot;
  }

  function snapshotEditorState() {
    return {
      selectedNodeKey: state.selectedNodeKey,
      collapsedNodeKeys: [...state.collapsedNodeKeys],
      lockedNodeKeys: [...state.lockedNodeKeys],
      hiddenNodeKeys: [...state.hiddenNodeKeys]
    };
  }

  function restoreEditorState(snapshot) {
    state.selectedNodeKey = snapshot?.selectedNodeKey || null;
    state.collapsedNodeKeys = new Set(snapshot?.collapsedNodeKeys || []);
    state.lockedNodeKeys = new Set(snapshot?.lockedNodeKeys || []);
    state.hiddenNodeKeys = new Set(snapshot?.hiddenNodeKeys || []);
  }

  function resetEditorState() {
    restoreEditorState(null);
    state.selectedId = null;
  }

  function remapMetadataKey(oldKey, newKey) {
    if (!oldKey || !newKey || oldKey === newKey) {
      return;
    }

    if (state.selectedNodeKey === oldKey) {
      state.selectedNodeKey = newKey;
    }

    if (state.collapsedNodeKeys.delete(oldKey)) {
      state.collapsedNodeKeys.add(newKey);
    }

    if (state.lockedNodeKeys.delete(oldKey)) {
      state.lockedNodeKeys.add(newKey);
    }

    if (state.hiddenNodeKeys.delete(oldKey)) {
      state.hiddenNodeKeys.add(newKey);
    }
  }

  function resolveLiveSelection(fallbackEditorId = state.svgRoot?.dataset.editorId || null) {
    const resolvedEditorId = state.selectedNodeKey
      ? model.getEditorIdByNodeKey(state.selectedNodeKey)
      : null;

    state.selectedId = resolvedEditorId || fallbackEditorId;

    if (resolvedEditorId) {
      state.selectedNodeKey = model.getNodeKeyByEditorId(resolvedEditorId);
    } else if (!state.selectedNodeKey && fallbackEditorId) {
      state.selectedNodeKey = model.getNodeKeyByEditorId(fallbackEditorId);
    }
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
    state.zoom = Math.max(0.3, Math.min(2.5, value));
    renderer.applyZoom();
  }

  function selectNode(editorId) {
    state.selectedId = editorId;
    state.selectedNodeKey = model.getNodeKeyByEditorId(editorId);
    renderer.renderTree();
    renderer.renderInspector();
    renderer.renderOverlay();
    renderer.updateActions();
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

  function beginDrag(node, event) {
    if (!model.canDragNode(node)) {
      return;
    }

    const referenceNode = node.parentElement || state.svgRoot;
    const startPoint = model.toLocalPoint(referenceNode, event.clientX, event.clientY);
    state.drag = {
      editorId: node.dataset.editorId,
      descriptor: model.getDragDescriptor(node),
      startPoint,
      referenceNode
    };
    ui.statusPill.textContent = `Dragging: ${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
  }

  function moveDrag(event) {
    if (!state.drag) {
      return;
    }

    const node = state.nodeMap.get(state.drag.editorId);
    if (!node) {
      return;
    }

    const currentPoint = model.toLocalPoint(state.drag.referenceNode, event.clientX, event.clientY);
    const dx = Math.round((currentPoint.x - state.drag.startPoint.x) * 100) / 100;
    const dy = Math.round((currentPoint.y - state.drag.startPoint.y) * 100) / 100;
    model.applyDrag(node, state.drag.descriptor, dx, dy);
    renderer.renderOverlay();
  }

  function endDrag() {
    if (!state.drag) {
      return;
    }

    renderer.updateSource();
    renderer.renderInspector();
    renderer.renderOverlay();
    recordHistory("drag");
    state.drag = null;
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
    const target = event.target.closest("[data-editor-id]");
    if (!target) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectNode(target.dataset.editorId);
  }

  function onSvgPointerDown(event) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target.closest("[data-editor-id]");
    if (!target) {
      return;
    }

    selectNode(target.dataset.editorId);
    beginDrag(target, event);
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
    const nodeKey = model.getNodeKeyByEditorId(editorId);
    if (!node || !nodeKey || node === state.svgRoot) {
      return;
    }

    let shouldRecordHistory = false;

    if (state.hiddenNodeKeys.has(nodeKey)) {
      state.hiddenNodeKeys.delete(nodeKey);
    } else if (node.getAttribute("display") === "none") {
      node.removeAttribute("display");
      shouldRecordHistory = true;
    } else {
      state.hiddenNodeKeys.add(nodeKey);
    }

    model.syncEditorMetadata();
    renderer.updateSource();
    renderer.renderWorkspace();
    renderer.renderTree();
    renderer.renderInspector();
    renderer.renderOverlay();
    if (shouldRecordHistory) {
      recordHistory("visibility");
    }
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

    if (field.kind === "text") {
      node.textContent = value;
    } else if (value.trim()) {
      node.setAttribute(field.key, value.trim());
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

  function duplicateSelection() {
    const node = state.nodeMap.get(state.selectedId);
    if (!node || node === state.svgRoot || !node.parentNode || model.isNodeLocked(node)) {
      return;
    }

    const clone = node.cloneNode(true);
    model.remapSubtreeIds(clone);
    model.addEditorIds(clone);
    node.parentNode.insertBefore(clone, node.nextSibling);
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    renderer.renderTree();
    renderer.updateSource();
    selectNode(clone.dataset.editorId);
    recordHistory("duplicate");
  }

  function deleteSelection() {
    const node = state.nodeMap.get(state.selectedId);
    if (!node || node === state.svgRoot || !node.parentNode || model.isNodeLocked(node)) {
      return;
    }

    const fallback = node.previousElementSibling || node.parentElement || state.svgRoot;
    node.remove();
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    renderer.updateSource();
    renderer.renderTree();
    recordHistory("delete");
    selectNode(fallback.dataset.editorId);
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
    ui.sourceToggleButton.addEventListener("click", () => setSourcePaneVisible(!state.sourceVisible));
    ui.collapseTopbarButton.addEventListener("click", () => setTopbarCollapsed(!state.topbarCollapsed));
    ui.showTopbarButton.addEventListener("click", () => setTopbarCollapsed(false));
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
    ui.zoomResetButton.addEventListener("click", () => setZoom(1));
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
    onSvgClick,
    onSvgPointerDown,
    selectNode,
    setGridSnapEnabled,
    setLeftPanelHidden,
    setRightPanelHidden,
    setSourcePaneVisible,
    setTopbarCollapsed,
    setZoom,
    toggleNodeCollapse,
    toggleNodeLock,
    toggleNodeVisibility,
    updateField
  };
}
