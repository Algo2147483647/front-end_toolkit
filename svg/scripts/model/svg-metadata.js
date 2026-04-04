const EDITABLE_TAGS = new Set([
  "circle",
  "ellipse",
  "foreignObject",
  "image",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
  "text",
  "use"
]);

const WRAPPER_TAGS = new Set([
  "a",
  "g",
  "switch"
]);

export function createSvgMetadataTools(state) {
  function getNodeArea(node) {
    try {
      const rect = node?.getBoundingClientRect?.();
      if (rect && (rect.width > 0 || rect.height > 0)) {
        return Math.max(rect.width * rect.height, rect.width, rect.height);
      }
    } catch (error) {
      // Ignore transient layout failures and fall back to SVG bounds.
    }

    try {
      const box = node?.getBBox?.();
      if (box && (box.width > 0 || box.height > 0)) {
        return Math.max(box.width * box.height, box.width, box.height);
      }
    } catch (error) {
      return 0;
    }

    return 0;
  }

  function getEditableNodeScore(node) {
    if (!node?.tagName) {
      return -1;
    }

    const tag = node.tagName.toLowerCase();
    const baseScoreByTag = {
      circle: 500,
      ellipse: 500,
      line: 500,
      path: 500,
      polygon: 500,
      polyline: 500,
      rect: 500,
      text: 420,
      foreignObject: 380,
      image: 340,
      use: 320
    };

    return (baseScoreByTag[tag] || 0) + getNodeArea(node);
  }

  function findEditableAncestor(startNode, stopNode = null) {
    let current = startNode;
    while (current) {
      if (current.nodeType !== 1) {
        current = current.parentElement;
        continue;
      }

      if (current.tagName?.toLowerCase?.() === "tspan") {
        const parentText = current.closest?.("text[data-editor-id]");
        if (parentText?.dataset?.editorId) {
          return parentText;
        }
      }

      if (current.dataset?.editorId && EDITABLE_TAGS.has(current.tagName.toLowerCase()) && !isNodeHidden(current)) {
        return current;
      }

      if (current === stopNode) {
        break;
      }

      current = current.parentElement;
    }

    return null;
  }

  function getPrimaryEditableDescendant(node, preferredNode = null) {
    const preferredMatch = findEditableAncestor(preferredNode, node);
    if (preferredMatch) {
      return preferredMatch;
    }

    if (!node?.querySelectorAll) {
      return null;
    }

    const candidates = [...node.querySelectorAll("*")]
      .filter((child) => child.dataset?.editorId)
      .filter((child) => EDITABLE_TAGS.has(child.tagName.toLowerCase()))
      .filter((child) => !isNodeHidden(child));

    if (!candidates.length) {
      return null;
    }

    return candidates
      .slice()
      .sort((left, right) => getEditableNodeScore(right) - getEditableNodeScore(left))[0];
  }

  function getRenderableChildren(node) {
    return [...node.children].filter((child) => child.tagName.toLowerCase() !== "style");
  }

  function buildNodeKey(node) {
    if (!node) {
      return null;
    }

    if (node === state.svgRoot) {
      return "svg:root";
    }

    const domId = node.getAttribute("id");
    if (domId) {
      return `id:${domId}`;
    }

    const segments = [];
    let current = node;
    while (current && current !== state.svgRoot) {
      const parent = current.parentElement;
      if (!parent) {
        break;
      }

      const siblings = getRenderableChildren(parent);
      const index = siblings.indexOf(current);
      segments.unshift(`${current.tagName.toLowerCase()}:${Math.max(index, 0)}`);
      current = parent;
    }

    return `path:${segments.join("/")}`;
  }

  function addEditorIds(root) {
    const nodes = [root, ...root.querySelectorAll("*")];
    for (const node of nodes) {
      state.nextId += 1;
      node.dataset.editorId = `node-${state.nextId}`;
    }
  }

  function rebuildNodeMap() {
    state.nodeMap = new Map();
    state.nodeKeyByEditorId = new Map();
    state.editorIdByNodeKey = new Map();
    state.nodeKeyByNode = new WeakMap();
    if (!state.svgRoot) {
      return;
    }

    const nodes = [state.svgRoot, ...state.svgRoot.querySelectorAll("*")];
    nodes.forEach((node) => {
      const editorId = node.dataset.editorId;
      const nodeKey = buildNodeKey(node);
      state.nodeMap.set(editorId, node);
      state.nodeKeyByEditorId.set(editorId, nodeKey);
      state.editorIdByNodeKey.set(nodeKey, editorId);
      state.nodeKeyByNode.set(node, nodeKey);
    });
  }

  function getNodeKey(node) {
    return state.nodeKeyByNode.get(node) || buildNodeKey(node);
  }

  function getNodeKeyByEditorId(editorId) {
    return state.nodeKeyByEditorId.get(editorId) || null;
  }

  function getEditorIdByNodeKey(nodeKey) {
    return state.editorIdByNodeKey.get(nodeKey) || null;
  }

  function syncEditorMetadata() {
    if (!state.svgRoot) {
      return;
    }
  }

  function labelFor(node) {
    const id = node.getAttribute("id");
    if (id) return `#${id}`;
    if (node.tagName.toLowerCase() === "text") return node.textContent.trim().slice(0, 24) || "<text>";
    return "<unnamed>";
  }

  function resolveEditableNode(node, options = {}) {
    if (!node) {
      return null;
    }

    if (node === state.svgRoot) {
      return node;
    }

    const preferredNode = options.preferredNode || node;
    const directMatch = findEditableAncestor(preferredNode, node);
    if (directMatch) {
      return directMatch;
    }

    if (EDITABLE_TAGS.has(node.tagName.toLowerCase())) {
      return node;
    }

    if (node.hasAttribute?.("data-cell-id") || WRAPPER_TAGS.has(node.tagName.toLowerCase())) {
      return getPrimaryEditableDescendant(node, preferredNode) || node;
    }

    return node;
  }

  function resolveSelectionEditorId(editorId, options = {}) {
    const node = state.nodeMap.get(editorId);
    const resolvedNode = resolveEditableNode(node, options);
    return resolvedNode?.dataset?.editorId || editorId;
  }

  function isNodeLocked(node) {
    const nodeKey = getNodeKey(node);
    return Boolean(nodeKey && state.lockedNodeKeys.has(nodeKey));
  }

  function isNodeHidden(node) {
    return node?.getAttribute("display") === "none";
  }

  function getZOrder(node) {
    if (!node || node === state.svgRoot || !node.parentElement) {
      return "";
    }

    const siblings = getRenderableChildren(node.parentElement);
    const index = siblings.indexOf(node);
    return index >= 0 ? String(index) : "";
  }

  function setZOrder(node, requestedOrder) {
    if (!node || node === state.svgRoot || !node.parentElement) {
      return false;
    }

    const parent = node.parentElement;
    const siblings = getRenderableChildren(parent);
    const currentIndex = siblings.indexOf(node);
    if (currentIndex < 0) {
      return false;
    }

    const parsed = Number.parseInt(String(requestedOrder).trim(), 10);
    if (!Number.isFinite(parsed)) {
      return false;
    }

    const targetIndex = Math.max(0, Math.min(siblings.length - 1, parsed));
    if (targetIndex === currentIndex) {
      return false;
    }

    const reordered = siblings.filter((sibling) => sibling !== node);
    reordered.splice(targetIndex, 0, node);
    const anchor = reordered[targetIndex + 1] || null;
    parent.insertBefore(node, anchor);
    return true;
  }

  function visibleField(node, field) {
    const tag = node.tagName.toLowerCase();
    if (field.kind === "readonly") return true;
    if (field.kind === "text") return ["text", "tspan"].includes(tag);
    if (field.kind === "z-order") return node !== state.svgRoot && Boolean(node.parentElement);
    if (field.kind === "typography-controls") return ["text", "tspan"].includes(tag);
    if (field.kind === "polygon-sides") return tag === "polygon";
    if (field.kind === "polygon-regularize") return tag === "polygon";
    if (field.kind === "polyline-points") return tag === "polyline";
    if (field.kind === "path-bezier") return tag === "path";
    if (field.key === "d") return tag === "path";
    if (field.key === "points") return ["polygon", "polyline"].includes(tag);
    if (["font-size", "font-family", "font-weight", "font-style", "text-decoration", "letter-spacing", "text-anchor"].includes(field.key)) {
      return ["text", "tspan"].includes(tag);
    }
    if (["cx", "cy", "r"].includes(field.key)) return tag === "circle";
    if (["rx", "ry"].includes(field.key)) return ["rect", "ellipse"].includes(tag);
    if (["x1", "y1", "x2", "y2"].includes(field.key)) return tag === "line";
    if (["x", "y", "width", "height"].includes(field.key)) return ["rect", "text", "use", "image", "foreignObject"].includes(tag);
    return true;
  }

  return {
    addEditorIds,
    getEditorIdByNodeKey,
    getNodeKey,
    getNodeKeyByEditorId,
    getRenderableChildren,
    getZOrder,
    isNodeHidden,
    isNodeLocked,
    labelFor,
    rebuildNodeMap,
    resolveEditableNode,
    resolveSelectionEditorId,
    setZOrder,
    syncEditorMetadata,
    visibleField
  };
}
