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

  function visibleField(node, field) {
    const tag = node.tagName.toLowerCase();
    if (field.kind === "readonly") return true;
    if (field.kind === "text") return ["text", "tspan"].includes(tag);
    if (field.kind === "typography-controls") return ["text", "tspan"].includes(tag);
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
    isNodeHidden,
    isNodeLocked,
    labelFor,
    rebuildNodeMap,
    syncEditorMetadata,
    visibleField
  };
}
