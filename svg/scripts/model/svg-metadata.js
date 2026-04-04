export function createSvgMetadataTools(state) {
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
    setZOrder,
    syncEditorMetadata,
    visibleField
  };
}
