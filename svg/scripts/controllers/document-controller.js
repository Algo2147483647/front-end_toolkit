export function createDocumentController({
  state,
  ui,
  model,
  renderer,
  emptySvg,
  selectionController,
  historyController
}) {
  function ensureDocument() {
    if (!state.svgRoot) {
      loadDocument(emptySvg);
    }

    return state.svgRoot;
  }

  function insertNode(node, recordReason = "insert") {
    const root = ensureDocument();
    const parent = model.getInsertParent() || root;
    model.snapNodeToGrid(node);
    model.addEditorIds(node);
    parent.append(node);
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    selectionController.selectNode(node.dataset.editorId, { render: false });
    renderer.refresh({
      workspace: true,
      tree: true,
      inspector: true,
      source: true,
      actions: true
    });
    historyController.recordHistory(recordReason);
  }

  function insertElement(kind) {
    insertNode(model.createElementNode(kind), `insert-${kind}`);
  }

  async function insertImageFile(file) {
    ensureDocument();
    const imageNode = await model.createImageNodeFromFile(file);
    insertNode(imageNode, "insert-image");
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
    renderer.refresh({
      workspace: true,
      tree: true,
      inspector: true,
      source: true,
      actions: true
    });
    historyController.recordHistory("visibility");
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
      selectionController.remapMetadataKey(previousNodeKey, nextNodeKey);
      model.syncEditorMetadata();
      selectionController.selectNode(node.dataset.editorId, { render: false });
      renderer.refresh({
        workspace: true,
        tree: true,
        inspector: true,
        source: true,
        actions: true
      });
      historyController.recordHistory("field:id");
      return;
    }

    if (field.kind === "z-order") {
      const previousKeys = new Map(
        [...state.nodeMap.values()].map((currentNode) => [currentNode, model.getNodeKey(currentNode)])
      );
      const changed = model.setZOrder(node, value);
      if (!changed) {
        return;
      }

      model.rebuildNodeMap();
      const keyMap = new Map();
      previousKeys.forEach((oldKey, currentNode) => {
        const nextKey = model.getNodeKey(currentNode);
        if (oldKey && nextKey && oldKey !== nextKey) {
          keyMap.set(oldKey, nextKey);
        }
      });
      selectionController.remapMetadataKeys(keyMap);
      selectionController.selectNode(node.dataset.editorId, { render: false });
      renderer.refresh({
        workspace: true,
        tree: true,
        inspector: true,
        source: true,
        actions: true
      });
      if (record) {
        historyController.recordHistory("field:z-order");
      }
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

    renderer.refresh({
      tree: true,
      inspector: record,
      source: true,
      overlay: true,
      actions: record
    });
    if (record) {
      historyController.recordHistory(`field:${field.key}`);
    }
  }

  function rebuildAfterStructureChange(reason, options = {}) {
    const previousKeys = new Map(
      [...state.nodeMap.values()].map((currentNode) => [currentNode, model.getNodeKey(currentNode)])
    );
    model.rebuildNodeMap();
    const keyMap = new Map();
    previousKeys.forEach((oldKey, currentNode) => {
      const nextKey = model.getNodeKey(currentNode);
      if (oldKey && nextKey && oldKey !== nextKey) {
        keyMap.set(oldKey, nextKey);
      }
    });
    selectionController.remapMetadataKeys(keyMap);
    selectionController.resolveLiveSelection();
    renderer.refresh({
      workspace: true,
      tree: true,
      inspector: true,
      source: true,
      actions: true
    });
    if (options.record !== false) {
      historyController.recordHistory(reason);
    }
  }

  function bringSelectionToFront() {
    const nodes = selectionController.getSelectionTargets().filter((node) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    nodes.forEach((node) => {
      node.parentElement?.append(node);
    });
    rebuildAfterStructureChange("z-order:front");
  }

  function sendSelectionToBack() {
    const nodes = selectionController.getSelectionTargets().filter((node) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    const nodesByParent = new Map();
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent) {
        return;
      }
      if (!nodesByParent.has(parent)) {
        nodesByParent.set(parent, []);
      }
      nodesByParent.get(parent).push(node);
    });

    nodesByParent.forEach((siblings) => {
      [...siblings].reverse().forEach((node) => {
        const parent = node.parentElement;
        if (!parent) {
          return;
        }
        const anchor = [...parent.children].find((child) => child !== node && !siblings.includes(child)) || parent.firstElementChild;
        parent.insertBefore(node, anchor);
      });
    });
    rebuildAfterStructureChange("z-order:back");
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
    renderer.refresh({
      workspace: renderWorkspace,
      tree: true,
      inspector: renderInspector,
      source: true,
      actions: true,
      overlay: !renderWorkspace
    });
    if (record) {
      historyController.recordHistory(reason);
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
    const nodes = selectionController.getSelectionTargets().filter((node) => !model.isNodeLocked(node));
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
    selectionController.setSelection(cloneIds, {
      primaryId: cloneIds[cloneIds.length - 1] || null,
      render: false
    });
    renderer.refresh({
      tree: true,
      inspector: true,
      source: true,
      overlay: true,
      actions: true
    });
    historyController.recordHistory("duplicate");
  }

  function deleteSelection() {
    const nodes = selectionController.getSelectionTargets().filter((node) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    const fallback = nodes[0].previousElementSibling || nodes[0].parentElement || state.svgRoot;
    nodes.forEach((node) => node.remove());
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    selectionController.selectNode(
      state.nodeMap.has(fallback?.dataset?.editorId)
        ? fallback.dataset.editorId
        : state.svgRoot?.dataset?.editorId || null,
      { render: false }
    );
    renderer.refresh({
      tree: true,
      inspector: true,
      source: true,
      overlay: true,
      actions: true
    });
    historyController.recordHistory("delete");
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
      fitScale = null,
      pushHistory = true,
      preserveEditorState = false
    } = options;

    const preservedEditorState = preserveEditorState ? selectionController.snapshotEditorState() : null;
    const root = model.parseSvg(source);
    model.addEditorIds(root);
    state.svgRoot = root;
    state.drag = null;
    state.selectionBox = null;
    ui.workspaceSurface.classList.remove("is-panning", "is-selecting");
    if (!preserveEditorState) {
      state.panX = 0;
      state.panY = 0;
    }
    model.rebuildNodeMap();
    if (preservedEditorState) {
      selectionController.restoreEditorState(preservedEditorState);
    } else {
      selectionController.resetEditorState();
    }
    model.syncEditorMetadata();
    selectionController.resolveLiveSelection(root.dataset.editorId);
    renderer.refresh({
      workspace: true,
      tree: true,
      inspector: true,
      source: true,
      actions: true
    });
    if (Number.isFinite(fitScale) && fitScale > 0) {
      const applyFittedZoom = () => {
        state.panX = 0;
        state.panY = 0;
        state.zoom = Math.max(0.01, Math.min(2.5, renderer.getFitZoom() * fitScale));
        renderer.applyZoom();
      };
      applyFittedZoom();
      requestAnimationFrame(applyFittedZoom);
    }
    if (pushHistory) {
      historyController.recordHistory("load");
    }
  }

  return {
    deleteSelection,
    downloadSvg,
    bringSelectionToFront,
    insertElement,
    insertImageFile,
    loadDocument,
    sendSelectionToBack,
    toggleNodeVisibility,
    updateField,
    updatePathBezier,
    updatePolygonSides,
    updatePolylinePointCount,
    duplicateSelection
  };
}
