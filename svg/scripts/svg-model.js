import {
  DANGEROUS_TAGS,
  GRID_SCREEN_SIZE,
  REFERENCE_ATTRS
} from "./constants.js";

export function createSvgModel(state) {
  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function sanitizeDomId(value, fallback = "node") {
    const normalized = (value || fallback)
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^A-Za-z0-9_.:-]/g, "-")
      .replace(/^-+/, "");

    return normalized || fallback;
  }

  function getUsedDomIds(excludeNode = null) {
    const used = new Set();
    if (!state.svgRoot) {
      return used;
    }

    for (const node of state.svgRoot.querySelectorAll("[id]")) {
      if (excludeNode && node === excludeNode) {
        continue;
      }
      used.add(node.getAttribute("id"));
    }

    if (state.svgRoot.hasAttribute("id") && state.svgRoot !== excludeNode) {
      used.add(state.svgRoot.getAttribute("id"));
    }

    return used;
  }

  function makeUniqueDomId(base, usedIds) {
    const normalizedBase = sanitizeDomId(base);
    if (!usedIds.has(normalizedBase)) {
      usedIds.add(normalizedBase);
      return normalizedBase;
    }

    let index = 1;
    while (usedIds.has(`${normalizedBase}-${index}`)) {
      index += 1;
    }

    const nextId = `${normalizedBase}-${index}`;
    usedIds.add(nextId);
    return nextId;
  }

  function replaceIdReferencesInValue(value, idMap) {
    let nextValue = value;

    for (const [oldId, newId] of idMap.entries()) {
      const escaped = escapeRegExp(oldId);
      nextValue = nextValue.replace(new RegExp(`url\\((['"]?)#${escaped}\\1\\)`, "g"), `url(#${newId})`);
      nextValue = nextValue.replace(new RegExp(`^#${escaped}$`, "g"), `#${newId}`);
      nextValue = nextValue.replace(new RegExp(`([;\\s(,])#${escaped}(?=\\b|[;\\s),])`, "g"), `$1#${newId}`);
    }

    return nextValue;
  }

  function rewriteNodeReferences(node, idMap) {
    for (const attrName of node.getAttributeNames()) {
      const currentValue = node.getAttribute(attrName);
      if (!currentValue) {
        continue;
      }

      if (REFERENCE_ATTRS.has(attrName) || currentValue.includes("url(#") || currentValue.startsWith("#")) {
        const nextValue = replaceIdReferencesInValue(currentValue, idMap);
        if (nextValue !== currentValue) {
          node.setAttribute(attrName, nextValue);
        }
      }
    }
  }

  function rewriteDocumentReferences(idMap) {
    if (!state.svgRoot || !idMap.size) {
      return;
    }

    const nodes = [state.svgRoot, ...state.svgRoot.querySelectorAll("*")];
    for (const node of nodes) {
      rewriteNodeReferences(node, idMap);
    }
  }

  function remapSubtreeIds(root) {
    const usedIds = getUsedDomIds();
    const idMap = new Map();
    const nodes = [root, ...root.querySelectorAll("*")];

    for (const node of nodes) {
      const oldId = node.getAttribute("id");
      if (!oldId) {
        continue;
      }

      const nextId = makeUniqueDomId(oldId, usedIds);
      idMap.set(oldId, nextId);
      node.setAttribute("id", nextId);
    }

    for (const node of nodes) {
      rewriteNodeReferences(node, idMap);
    }
  }

  function renameNodeId(node, requestedId) {
    const fallbackBase = node.tagName.toLowerCase();
    const oldId = node.getAttribute("id");
    const usedIds = getUsedDomIds(node);
    const nextId = makeUniqueDomId(requestedId || fallbackBase, usedIds);

    node.setAttribute("id", nextId);

    if (oldId && oldId !== nextId) {
      rewriteDocumentReferences(new Map([[oldId, nextId]]));
    }

    return nextId;
  }

  function isSafeHref(value) {
    const normalized = value.trim().toLowerCase();
    return normalized.startsWith("#") || normalized.startsWith("data:");
  }

  function sanitizeCssText(value) {
    if (/@import/i.test(value) || /javascript:/i.test(value) || /expression\s*\(/i.test(value)) {
      return "";
    }

    return value.replace(/url\((.*?)\)/gi, (match, inner) => {
      const normalized = inner.trim().replace(/^['"]|['"]$/g, "");
      return normalized.startsWith("#") ? `url(#${normalized.slice(1)})` : "";
    });
  }

  function sanitizeSvgTree(root) {
    const warnings = [];

    for (const node of [root, ...root.querySelectorAll("*")]) {
      const tag = node.tagName.toLowerCase();

      if (DANGEROUS_TAGS.has(tag)) {
        warnings.push(`Removed unsafe tag <${tag}>`);
        node.remove();
        continue;
      }

      if (tag === "style") {
        const sanitizedStyle = sanitizeCssText(node.textContent || "");
        if (!sanitizedStyle.trim()) {
          warnings.push("Removed a <style> block with external or executable content");
          node.remove();
          continue;
        }
        node.textContent = sanitizedStyle;
      }

      for (const attrName of node.getAttributeNames()) {
        const value = node.getAttribute(attrName) || "";

        if (attrName.toLowerCase().startsWith("on")) {
          warnings.push(`Removed event attribute ${attrName}`);
          node.removeAttribute(attrName);
          continue;
        }

        if (["href", "xlink:href", "src"].includes(attrName) && !isSafeHref(value)) {
          warnings.push(`Removed external reference attribute ${attrName}`);
          node.removeAttribute(attrName);
          continue;
        }

        if (attrName === "style") {
          const sanitizedStyle = sanitizeCssText(value);
          if (!sanitizedStyle.trim()) {
            warnings.push("Removed unsafe style attribute");
            node.removeAttribute(attrName);
          } else if (sanitizedStyle !== value) {
            node.setAttribute(attrName, sanitizedStyle);
          }
          continue;
        }

        if (value.includes("url(") && !/^url\(\s*['"]?#/i.test(value.trim())) {
          const sanitizedValue = sanitizeCssText(value);
          if (!sanitizedValue.trim()) {
            warnings.push(`Removed unsafe reference attribute ${attrName}`);
            node.removeAttribute(attrName);
          } else {
            node.setAttribute(attrName, sanitizedValue);
          }
        }
      }
    }

    return warnings;
  }

  function parseSvg(source) {
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const error = parsed.querySelector("parsererror");
    if (error) {
      throw new Error(error.textContent.trim() || "Failed to parse SVG");
    }

    const root = parsed.documentElement;
    if (!root || root.tagName.toLowerCase() !== "svg") {
      throw new Error("Imported content is not valid SVG");
    }

    state.warnings = sanitizeSvgTree(root);
    return root;
  }

  function getRenderableChildren(node) {
    return [...node.children].filter((child) => child.tagName.toLowerCase() !== "style");
  }

  function getViewBoxRect(root = state.svgRoot) {
    const baseVal = root?.viewBox?.baseVal;
    if (baseVal && baseVal.width && baseVal.height) {
      return {
        x: baseVal.x,
        y: baseVal.y,
        width: baseVal.width,
        height: baseVal.height
      };
    }

    return { x: 0, y: 0, width: 1200, height: 800 };
  }

  function getInsertParent() {
    const root = state.svgRoot;
    const selected = state.nodeMap.get(state.selectedId);
    if (!root || !selected || selected === root) {
      return root;
    }

    if (isNodeLocked(selected)) {
      return selected.parentElement || root;
    }

    const tag = selected.tagName.toLowerCase();
    if (["g", "svg"].includes(tag)) {
      return selected;
    }

    if (["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient"].includes(tag)) {
      return root;
    }

    return selected.parentElement || root;
  }

  function nextNodeName(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  }

  function createElementNode(kind) {
    const box = getViewBoxRect();
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const node = document.createElementNS("http://www.w3.org/2000/svg", kind);

    if (kind === "rect") {
      node.setAttribute("id", nextNodeName("rect"));
      node.setAttribute("x", String(centerX - 90));
      node.setAttribute("y", String(centerY - 60));
      node.setAttribute("width", "180");
      node.setAttribute("height", "120");
      node.setAttribute("rx", "20");
      node.setAttribute("fill", "#f97316");
      node.setAttribute("opacity", "0.92");
    }

    if (kind === "circle") {
      node.setAttribute("id", nextNodeName("circle"));
      node.setAttribute("cx", String(centerX));
      node.setAttribute("cy", String(centerY));
      node.setAttribute("r", "68");
      node.setAttribute("fill", "#0f766e");
      node.setAttribute("opacity", "0.92");
    }

    if (kind === "ellipse") {
      node.setAttribute("id", nextNodeName("ellipse"));
      node.setAttribute("cx", String(centerX));
      node.setAttribute("cy", String(centerY));
      node.setAttribute("rx", "110");
      node.setAttribute("ry", "62");
      node.setAttribute("fill", "#38bdf8");
      node.setAttribute("opacity", "0.88");
    }

    if (kind === "line") {
      node.setAttribute("id", nextNodeName("line"));
      node.setAttribute("x1", String(centerX - 120));
      node.setAttribute("y1", String(centerY - 60));
      node.setAttribute("x2", String(centerX + 120));
      node.setAttribute("y2", String(centerY + 60));
      node.setAttribute("stroke", "#24180f");
      node.setAttribute("stroke-width", "10");
      node.setAttribute("stroke-linecap", "round");
    }

    if (kind === "text") {
      node.setAttribute("id", nextNodeName("text"));
      node.setAttribute("x", String(centerX - 110));
      node.setAttribute("y", String(centerY));
      node.setAttribute("fill", "#24180f");
      node.setAttribute("font-size", "42");
      node.setAttribute("font-family", "IBM Plex Sans, Segoe UI, sans-serif");
      node.textContent = "New text";
    }

    return node;
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  function measureImage(dataUrl) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve({
        width: image.naturalWidth || 320,
        height: image.naturalHeight || 200
      });
      image.onerror = () => resolve({ width: 320, height: 200 });
      image.src = dataUrl;
    });
  }

  async function createImageNodeFromFile(file) {
    const box = getViewBoxRect();
    const dataUrl = await readFileAsDataUrl(file);
    const size = await measureImage(dataUrl);
    const maxWidth = Math.max(180, box.width * 0.38);
    const scale = Math.min(1, maxWidth / size.width);
    const width = Math.round(size.width * scale);
    const height = Math.round(size.height * scale);
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const imageNode = document.createElementNS("http://www.w3.org/2000/svg", "image");

    imageNode.setAttribute("id", nextNodeName("image"));
    imageNode.setAttribute("x", String(centerX - width / 2));
    imageNode.setAttribute("y", String(centerY - height / 2));
    imageNode.setAttribute("width", String(width));
    imageNode.setAttribute("height", String(height));
    imageNode.setAttribute("preserveAspectRatio", "xMidYMid meet");
    imageNode.setAttribute("href", dataUrl);

    return imageNode;
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
    if (!state.svgRoot) {
      return;
    }

    const nodes = [state.svgRoot, ...state.svgRoot.querySelectorAll("*")];
    nodes.forEach((node) => state.nodeMap.set(node.dataset.editorId, node));
  }

  function cleanForExport(root) {
    const nodes = [root, ...root.querySelectorAll("*")];
    for (const node of nodes) {
      for (const attrName of node.getAttributeNames()) {
        if (attrName.startsWith("data-editor-")) {
          node.removeAttribute(attrName);
        }
      }
    }
  }

  function serialize() {
    if (!state.svgRoot) {
      return "";
    }

    const clone = state.svgRoot.cloneNode(true);
    cleanForExport(clone);
    return new XMLSerializer().serializeToString(clone);
  }

  function labelFor(node) {
    const id = node.getAttribute("id");
    if (id) return `#${id}`;
    if (node.tagName.toLowerCase() === "text") return node.textContent.trim().slice(0, 24) || "<text>";
    return "<unnamed>";
  }

  function isNodeLocked(node) {
    return node?.dataset.editorLocked === "true";
  }

  function isNodeHidden(node) {
    return node?.getAttribute("display") === "none";
  }

  function visibleField(node, field) {
    const tag = node.tagName.toLowerCase();
    if (field.kind === "readonly") return true;
    if (field.kind === "text") return ["text", "tspan"].includes(tag);
    if (field.key === "d") return tag === "path";
    if (field.key === "points") return ["polygon", "polyline"].includes(tag);
    if (["font-size", "font-family"].includes(field.key)) return ["text", "tspan"].includes(tag);
    if (["cx", "cy", "r"].includes(field.key)) return tag === "circle";
    if (["rx", "ry"].includes(field.key)) return ["rect", "ellipse"].includes(tag);
    if (["x1", "y1", "x2", "y2"].includes(field.key)) return tag === "line";
    if (["x", "y", "width", "height"].includes(field.key)) return ["rect", "text", "use", "image", "foreignObject"].includes(tag);
    return true;
  }

  function viewBoxFor(root) {
    if (root.getAttribute("viewBox")) {
      return root.getAttribute("viewBox");
    }

    try {
      const box = root.getBBox();
      if (box.width > 0 && box.height > 0) {
        return `${box.x} ${box.y} ${box.width} ${box.height}`;
      }
    } catch (error) {
      return "0 0 100 100";
    }

    return "0 0 100 100";
  }

  function canDragNode(node) {
    if (!node || node === state.svgRoot) {
      return false;
    }

    const tag = node.tagName.toLowerCase();
    return !isNodeLocked(node) && !["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient", "stop"].includes(tag);
  }

  function getNumericAttr(node, attrName, fallback = 0) {
    const value = Number.parseFloat(node.getAttribute(attrName));
    return Number.isFinite(value) ? value : fallback;
  }

  function roundCoordinate(value) {
    return Math.round(value * 100) / 100;
  }

  function getGridMetrics() {
    const viewBox = getViewBoxRect();
    const rect = state.svgRoot?.getBoundingClientRect();
    const width = rect?.width || viewBox.width || GRID_SCREEN_SIZE;
    const height = rect?.height || viewBox.height || GRID_SCREEN_SIZE;

    return {
      originX: viewBox.x,
      originY: viewBox.y,
      stepX: (viewBox.width / width) * GRID_SCREEN_SIZE,
      stepY: (viewBox.height / height) * GRID_SCREEN_SIZE
    };
  }

  function snapCoordinate(value, step, origin) {
    if (!state.gridSnapEnabled || !Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
      return value;
    }

    return origin + (Math.round((value - origin) / step) * step);
  }

  function snapNodeToGrid(node) {
    if (!state.gridSnapEnabled || !node) {
      return;
    }

    const grid = getGridMetrics();
    const tag = node.tagName.toLowerCase();

    if (["rect", "image", "foreignObject", "use", "text"].includes(tag)) {
      node.setAttribute("x", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "x"), grid.stepX, grid.originX))));
      node.setAttribute("y", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "y"), grid.stepY, grid.originY))));
      return;
    }

    if (["circle", "ellipse"].includes(tag)) {
      node.setAttribute("cx", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "cx"), grid.stepX, grid.originX))));
      node.setAttribute("cy", String(roundCoordinate(snapCoordinate(getNumericAttr(node, "cy"), grid.stepY, grid.originY))));
      return;
    }

    if (tag === "line") {
      const nextX1 = snapCoordinate(getNumericAttr(node, "x1"), grid.stepX, grid.originX);
      const nextY1 = snapCoordinate(getNumericAttr(node, "y1"), grid.stepY, grid.originY);
      const dx = nextX1 - getNumericAttr(node, "x1");
      const dy = nextY1 - getNumericAttr(node, "y1");
      node.setAttribute("x1", String(roundCoordinate(nextX1)));
      node.setAttribute("y1", String(roundCoordinate(nextY1)));
      node.setAttribute("x2", String(roundCoordinate(getNumericAttr(node, "x2") + dx)));
      node.setAttribute("y2", String(roundCoordinate(getNumericAttr(node, "y2") + dy)));
    }
  }

  function toLocalPoint(referenceNode, clientX, clientY) {
    const point = state.svgRoot?.createSVGPoint?.();
    if (!point) {
      return { x: clientX, y: clientY };
    }

    point.x = clientX;
    point.y = clientY;
    const matrix = referenceNode.getScreenCTM();
    if (!matrix) {
      return { x: clientX, y: clientY };
    }

    return point.matrixTransform(matrix.inverse());
  }

  function getDragDescriptor(node) {
    const tag = node.tagName.toLowerCase();

    if (["rect", "image", "foreignObject", "use", "text"].includes(tag)) {
      return {
        mode: "xy",
        x: getNumericAttr(node, "x"),
        y: getNumericAttr(node, "y")
      };
    }

    if (["circle", "ellipse"].includes(tag)) {
      return {
        mode: "center",
        cx: getNumericAttr(node, "cx"),
        cy: getNumericAttr(node, "cy")
      };
    }

    if (tag === "line") {
      return {
        mode: "line",
        x1: getNumericAttr(node, "x1"),
        y1: getNumericAttr(node, "y1"),
        x2: getNumericAttr(node, "x2"),
        y2: getNumericAttr(node, "y2")
      };
    }

    return {
      mode: "transform",
      baseMatrix: node.transform?.baseVal?.consolidate()?.matrix || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    };
  }

  function applyDrag(node, descriptor, dx, dy) {
    const grid = getGridMetrics();

    if (descriptor.mode === "xy") {
      const nextX = snapCoordinate(descriptor.x + dx, grid.stepX, grid.originX);
      const nextY = snapCoordinate(descriptor.y + dy, grid.stepY, grid.originY);
      node.setAttribute("x", String(roundCoordinate(nextX)));
      node.setAttribute("y", String(roundCoordinate(nextY)));
      return;
    }

    if (descriptor.mode === "center") {
      const nextCx = snapCoordinate(descriptor.cx + dx, grid.stepX, grid.originX);
      const nextCy = snapCoordinate(descriptor.cy + dy, grid.stepY, grid.originY);
      node.setAttribute("cx", String(roundCoordinate(nextCx)));
      node.setAttribute("cy", String(roundCoordinate(nextCy)));
      return;
    }

    if (descriptor.mode === "line") {
      const nextX1 = snapCoordinate(descriptor.x1 + dx, grid.stepX, grid.originX);
      const nextY1 = snapCoordinate(descriptor.y1 + dy, grid.stepY, grid.originY);
      const snappedDx = nextX1 - descriptor.x1;
      const snappedDy = nextY1 - descriptor.y1;
      node.setAttribute("x1", String(roundCoordinate(nextX1)));
      node.setAttribute("y1", String(roundCoordinate(nextY1)));
      node.setAttribute("x2", String(roundCoordinate(descriptor.x2 + snappedDx)));
      node.setAttribute("y2", String(roundCoordinate(descriptor.y2 + snappedDy)));
      return;
    }

    const { a, b, c, d, e, f } = descriptor.baseMatrix;
    const nextE = roundCoordinate(snapCoordinate(e + dx, grid.stepX, 0));
    const nextF = roundCoordinate(snapCoordinate(f + dy, grid.stepY, 0));
    node.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${nextE} ${nextF})`);
  }

  return {
    addEditorIds,
    applyDrag,
    canDragNode,
    createElementNode,
    createImageNodeFromFile,
    getDragDescriptor,
    getInsertParent,
    getNumericAttr,
    getRenderableChildren,
    getViewBoxRect,
    isNodeHidden,
    isNodeLocked,
    labelFor,
    parseSvg,
    rebuildNodeMap,
    remapSubtreeIds,
    renameNodeId,
    roundCoordinate,
    serialize,
    snapCoordinate,
    snapNodeToGrid,
    toLocalPoint,
    viewBoxFor,
    visibleField
  };
}
