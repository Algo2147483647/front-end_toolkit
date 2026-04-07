export function createDocumentController({
  store,
  state,
  ui,
  model,
  renderer,
  emptySvg,
  selectionController,
  historyController
}: any) {
  const runtime = store?.getState?.() || state;

  function syncDocumentSnapshot(root: Element | null = runtime.svgRoot) {
    store.document.setDocumentSnapshot(model.captureDocumentSnapshot(root));
  }

  function setCurrentFileBinding(fileHandle: any = null, fileName = "") {
    store.document.setCurrentFileBinding(fileHandle, fileName);
    renderer.syncChrome();
  }

  async function ensureWritableFilePermission(fileHandle: any) {
    if (!fileHandle) {
      return false;
    }

    if (typeof fileHandle.queryPermission === "function") {
      const permission = await fileHandle.queryPermission({ mode: "readwrite" });
      if (permission === "granted") {
        return true;
      }
    }

    if (typeof fileHandle.requestPermission === "function") {
      const permission = await fileHandle.requestPermission({ mode: "readwrite" });
      return permission === "granted";
    }

    return true;
  }

  function buildExportFileName() {
    const sourceName = (runtime.currentFileName || "edited-graphic").trim();
    const baseName = sourceName.replace(/\.svg$/i, "") || "edited-graphic";
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}`;
    return `${baseName}-${timestamp}.svg`;
  }

  function ensureDocument() {
    if (!runtime.svgRoot) {
      loadDocument(emptySvg);
    }

    return runtime.svgRoot;
  }

  function insertNode(node: any, recordReason = "insert") {
    const root = ensureDocument();
    const parent = model.getInsertParent() || root;
    model.snapNodeToGrid(node);
    model.addEditorIds(node);
    parent.append(node);
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    syncDocumentSnapshot(root);
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

  function insertElement(kind: string) {
    insertNode(model.createElementNode(kind), `insert-${kind}`);
  }

  async function insertImageFile(file: File) {
    ensureDocument();
    const imageNode = await model.createImageNodeFromFile(file);
    insertNode(imageNode, "insert-image");
  }

  function toggleNodeVisibility(editorId: string) {
    const node = runtime.nodeMap.get(editorId);
    if (!node || node === runtime.svgRoot) {
      return;
    }

    if (node.getAttribute("display") === "none") {
      node.removeAttribute("display");
    } else {
      node.setAttribute("display", "none");
    }

    model.syncEditorMetadata();
    syncDocumentSnapshot();
    renderer.refresh({
      workspace: true,
      tree: true,
      inspector: true,
      source: true,
      actions: true
    });
    historyController.recordHistory("visibility");
  }

  function updateField(editorId: string, field: any, value: string, record: boolean) {
    const node = runtime.nodeMap.get(editorId);
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
      syncDocumentSnapshot();
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
        [...runtime.nodeMap.values()].map((currentNode) => [currentNode, model.getNodeKey(currentNode)])
      );
      const changed = model.setZOrder(node, value);
      if (!changed) {
        return;
      }

      model.rebuildNodeMap();
      const keyMap = new Map<string, string>();
      previousKeys.forEach((oldKey, currentNode) => {
        const nextKey = model.getNodeKey(currentNode);
        if (oldKey && nextKey && oldKey !== nextKey) {
          keyMap.set(oldKey, nextKey);
        }
      });
      selectionController.remapMetadataKeys(keyMap);
      selectionController.selectNode(node.dataset.editorId, { render: false });
      syncDocumentSnapshot();
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

    if (["width", "height"].includes(field.key) && node.tagName.toLowerCase() === "text") {
      const changed = model.updateTextBoxDimension(node, field.key, value);
      if (!changed) {
        return;
      }

      syncDocumentSnapshot();
      renderer.refresh({
        tree: true,
        inspector: true,
        source: true,
        overlay: true,
        actions: true
      });
      if (record) {
        historyController.recordHistory(`field:${field.key}`);
      }
      return;
    }

    const nextValue = record && field.kind === "attr"
      ? model.snapFieldValue(field.key, value)
      : value;

    if (field.kind === "text") {
      if (node.tagName.toLowerCase() === "text") {
        model.updateTextContent(node, value);
      } else {
        node.textContent = value;
      }
    } else if (nextValue.trim()) {
      node.setAttribute(field.key, nextValue.trim());
    } else {
      node.removeAttribute(field.key);
    }

    if (field.kind === "attr"
      && node.tagName.toLowerCase() === "text"
      && ["x", "y", "font-size", "font-family", "font-weight", "font-style", "letter-spacing", "text-anchor"].includes(field.key)) {
      model.refreshTextLayout(node);
    }

    syncDocumentSnapshot();
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

  function rebuildAfterStructureChange(reason: string, options: { record?: boolean } = {}) {
    const previousKeys = new Map(
      [...runtime.nodeMap.values()].map((currentNode) => [currentNode, model.getNodeKey(currentNode)])
    );
    model.rebuildNodeMap();
    const keyMap = new Map<string, string>();
    previousKeys.forEach((oldKey, currentNode) => {
      const nextKey = model.getNodeKey(currentNode);
      if (oldKey && nextKey && oldKey !== nextKey) {
        keyMap.set(oldKey, nextKey);
      }
    });
    selectionController.remapMetadataKeys(keyMap);
    selectionController.resolveLiveSelection();
    syncDocumentSnapshot();
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

  function getReorderTargets(editorId: string | null = null) {
    if (editorId) {
      const node = runtime.nodeMap.get(editorId);
      if (!node || node === runtime.svgRoot || !node.parentNode || model.isNodeLocked(node)) {
        return [];
      }
      return [node];
    }

    return selectionController.getSelectionTargets().filter((node: any) => !model.isNodeLocked(node));
  }

  function bringSelectionToFront(editorId: string | null = null) {
    const nodes = getReorderTargets(editorId);
    if (!nodes.length) {
      return;
    }

    nodes.forEach((node: any) => {
      node.parentElement?.append(node);
    });
    if (editorId) {
      selectionController.selectNode(editorId, { render: false });
    }
    rebuildAfterStructureChange("z-order:front");
  }

  function sendSelectionToBack(editorId: string | null = null) {
    const nodes = getReorderTargets(editorId);
    if (!nodes.length) {
      return;
    }

    const nodesByParent = new Map<any, any[]>();
    nodes.forEach((node: any) => {
      const parent = node.parentElement;
      if (!parent) {
        return;
      }
      if (!nodesByParent.has(parent)) {
        nodesByParent.set(parent, []);
      }
      nodesByParent.get(parent)!.push(node);
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
    if (editorId) {
      selectionController.selectNode(editorId, { render: false });
    }
    rebuildAfterStructureChange("z-order:back");
  }

  function applyGeometryControl(editorId: string, reason: string, applyChange: (node: any) => boolean, options: any = {}) {
    const {
      record = true,
      renderInspector = record,
      renderWorkspace = true
    } = options;
    const node = runtime.nodeMap.get(editorId);
    if (!node || model.isNodeLocked(node)) {
      return;
    }

    const changed = applyChange(node);
    if (!changed) {
      return;
    }

    model.syncEditorMetadata();
    syncDocumentSnapshot();
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

  function updatePolygonSides(editorId: string, value: string, record = true) {
    applyGeometryControl(editorId, "polygon-sides", (node) => model.updatePolygonSideCount(node, value), {
      record,
      renderInspector: record
    });
  }

  function regularizePolygon(editorId: string, record = true) {
    applyGeometryControl(editorId, "polygon-regularize", (node) => model.regularizePolygon(node), {
      record,
      renderInspector: true
    });
  }

  function regularizePolygonEqualSides(editorId: string, record = true) {
    applyGeometryControl(editorId, "polygon-regularize-equal-sides", (node) => model.regularizePolygonEqualSides(node), {
      record,
      renderInspector: true
    });
  }

  function updatePolylinePointCount(editorId: string, value: string, record = true) {
    applyGeometryControl(editorId, "polyline-points", (node) => model.updatePolylinePointCount(node, value), {
      record,
      renderInspector: record
    });
  }

  function updatePathBezier(editorId: string, bezier: any, record = true) {
    applyGeometryControl(editorId, "path-bezier", (node) => model.updatePathBezier(node, bezier), {
      record,
      renderInspector: record
    });
  }

  function duplicateSelection() {
    const nodes = selectionController.getSelectionTargets().filter((node: any) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    const cloneIds: string[] = [];
    nodes.forEach((node: any) => {
      const clone = node.cloneNode(true) as any;
      model.remapSubtreeIds(clone);
      model.addEditorIds(clone);
      node.parentNode.insertBefore(clone, node.nextSibling);
      cloneIds.push(clone.dataset.editorId);
    });
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    syncDocumentSnapshot();
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
    const nodes = selectionController.getSelectionTargets().filter((node: any) => !model.isNodeLocked(node));
    if (!nodes.length) {
      return;
    }

    const fallback = nodes[0].previousElementSibling || nodes[0].parentElement || runtime.svgRoot;
    nodes.forEach((node: any) => node.remove());
    model.rebuildNodeMap();
    model.syncEditorMetadata();
    syncDocumentSnapshot();
    selectionController.selectNode(
      runtime.nodeMap.has(fallback?.dataset?.editorId)
        ? fallback.dataset.editorId
        : runtime.svgRoot?.dataset?.editorId || null,
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
    link.download = buildExportFileName();
    link.click();
    URL.revokeObjectURL(url);
  }

  async function saveToSourceFile() {
    const fileHandle = runtime.currentFileHandle;
    if (!fileHandle || typeof fileHandle.createWritable !== "function") {
      throw new Error("Overwrite save is unavailable for this document. Re-import the SVG with file access first.");
    }

    const targetName = runtime.currentFileName || fileHandle.name || "current SVG";
    const shouldOverwrite = globalThis.confirm?.(`Overwrite "${targetName}"?`) ?? false;
    if (!shouldOverwrite) {
      return false;
    }

    const granted = await ensureWritableFilePermission(fileHandle);
    if (!granted) {
      throw new Error("Write permission was not granted for the source SVG file.");
    }

    const writable = await fileHandle.createWritable();
    await writable.write(model.serialize());
    await writable.close();
    ui.statusPill.textContent = `Saved: ${targetName}`;
    renderer.syncChrome();
    return true;
  }

  function loadDocument(source: string, options: any = {}) {
    const {
      fitScale = null,
      pushHistory = true,
      preserveEditorState = false
    } = options;
    const hasFileBindingOverride = Object.prototype.hasOwnProperty.call(options, "fileHandle")
      || Object.prototype.hasOwnProperty.call(options, "fileName");

    const preservedEditorState = preserveEditorState ? selectionController.snapshotEditorState() : null;
    const root = model.parseSvg(source);
    model.addEditorIds(root);
    store.batch(() => {
      store.document.setSvgRoot(root);
      store.document.setDocumentSnapshot(model.captureDocumentSnapshot(root));
      store.interaction.clearDrag();
      store.interaction.clearSelectionBox();
    });
    ui.workspaceSurface.classList.remove("is-panning", "is-selecting");
    if (!preserveEditorState) {
      store.viewport.resetPan();
    }
    model.rebuildNodeMap();
    model.normalizeManagedTextNodes(root);
    model.rebuildNodeMap();
    if (preservedEditorState) {
      selectionController.restoreEditorState(preservedEditorState);
    } else {
      selectionController.resetEditorState();
    }
    if (hasFileBindingOverride) {
      setCurrentFileBinding(options.fileHandle ?? null, options.fileName ?? "");
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
        store.viewport.setTransform({
          panX: 0,
          panY: 0,
          zoom: Math.max(0.01, Math.min(2.5, renderer.getFitZoom() * fitScale))
        });
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
    saveToSourceFile,
    sendSelectionToBack,
    regularizePolygonEqualSides,
    toggleNodeVisibility,
    updateField,
    updatePathBezier,
    regularizePolygon,
    updatePolygonSides,
    updatePolylinePointCount,
    duplicateSelection
  };
}
