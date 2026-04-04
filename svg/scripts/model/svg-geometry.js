import { GRID_SCREEN_SIZE } from "../constants.js";

export function createSvgGeometryTools({ state, isNodeLocked }) {
  const RESIZABLE_TAGS = new Set(["rect", "circle", "ellipse", "line", "polyline", "polygon", "path"]);

  function normalizeRect(rect) {
    if (!rect) {
      return null;
    }

    const x = Number(rect.x);
    const y = Number(rect.y);
    const width = Number(rect.width);
    const height = Number(rect.height);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  }

  function parseSvgLength(value) {
    if (!value) {
      return null;
    }

    const normalized = String(value).trim();
    if (!normalized || normalized.endsWith("%")) {
      return null;
    }

    const match = normalized.match(/^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)\s*([a-z]*)$/i);
    if (!match) {
      return null;
    }

    const amount = Number.parseFloat(match[1]);
    if (!Number.isFinite(amount)) {
      return null;
    }

    const unit = match[2].toLowerCase();
    const unitScale = {
      "": 1,
      px: 1,
      in: 96,
      cm: 96 / 2.54,
      mm: 96 / 25.4,
      pt: 96 / 72,
      pc: 16
    };

    if (!(unit in unitScale)) {
      return null;
    }

    return amount * unitScale[unit];
  }

  function parseViewBox(root) {
    const attr = root?.getAttribute?.("viewBox");
    if (attr) {
      const parts = attr.trim().split(/[\s,]+/).map((part) => Number.parseFloat(part));
      if (parts.length === 4 && parts.every((part) => Number.isFinite(part)) && parts[2] > 0 && parts[3] > 0) {
        return {
          x: parts[0],
          y: parts[1],
          width: parts[2],
          height: parts[3]
        };
      }
    }

    const baseVal = root?.viewBox?.baseVal;
    return normalizeRect(baseVal);
  }

  function parseRootDimensions(root) {
    const width = parseSvgLength(root?.getAttribute?.("width"));
    const height = parseSvgLength(root?.getAttribute?.("height"));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: 0,
      y: 0,
      width,
      height
    };
  }

  function measureRootBounds(root) {
    try {
      return normalizeRect(root?.getBBox?.());
    } catch (error) {
      return null;
    }
  }

  function resolveRootViewportRect(root = state.svgRoot) {
    return parseViewBox(root)
      || parseRootDimensions(root)
      || measureRootBounds(root)
      || { x: 0, y: 0, width: 1200, height: 800 };
  }

  function getViewBoxRect(root = state.svgRoot) {
    return resolveRootViewportRect(root);
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

  function normalizeMatrix(matrix) {
    return {
      a: Number.isFinite(matrix?.a) ? matrix.a : 1,
      b: Number.isFinite(matrix?.b) ? matrix.b : 0,
      c: Number.isFinite(matrix?.c) ? matrix.c : 0,
      d: Number.isFinite(matrix?.d) ? matrix.d : 1,
      e: Number.isFinite(matrix?.e) ? matrix.e : 0,
      f: Number.isFinite(matrix?.f) ? matrix.f : 0
    };
  }

  function multiplyMatrix(left, right) {
    return {
      a: (left.a * right.a) + (left.c * right.b),
      b: (left.b * right.a) + (left.d * right.b),
      c: (left.a * right.c) + (left.c * right.d),
      d: (left.b * right.c) + (left.d * right.d),
      e: (left.a * right.e) + (left.c * right.f) + left.e,
      f: (left.b * right.e) + (left.d * right.f) + left.f
    };
  }

  function translateMatrix(x, y) {
    return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
  }

  function scaleMatrix(x, y) {
    return { a: x, b: 0, c: 0, d: y, e: 0, f: 0 };
  }

  function matrixToTransform(matrix) {
    const { a, b, c, d, e, f } = normalizeMatrix(matrix);
    return `matrix(${roundCoordinate(a)} ${roundCoordinate(b)} ${roundCoordinate(c)} ${roundCoordinate(d)} ${roundCoordinate(e)} ${roundCoordinate(f)})`;
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

    if (kind === "polyline") {
      node.setAttribute("id", nextNodeName("polyline"));
      node.setAttribute(
        "points",
        [
          `${centerX - 140},${centerY + 36}`,
          `${centerX - 52},${centerY - 42}`,
          `${centerX + 10},${centerY + 8}`,
          `${centerX + 132},${centerY - 78}`
        ].join(" ")
      );
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "#0f766e");
      node.setAttribute("stroke-width", "12");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
    }

    if (kind === "polygon") {
      node.setAttribute("id", nextNodeName("polygon"));
      node.setAttribute(
        "points",
        [
          `${centerX},${centerY - 96}`,
          `${centerX + 112},${centerY - 18}`,
          `${centerX + 70},${centerY + 98}`,
          `${centerX - 70},${centerY + 98}`,
          `${centerX - 112},${centerY - 18}`
        ].join(" ")
      );
      node.setAttribute("fill", "#2563eb");
      node.setAttribute("stroke", "#173f94");
      node.setAttribute("stroke-width", "8");
      node.setAttribute("stroke-linejoin", "round");
      node.setAttribute("opacity", "0.9");
    }

    if (kind === "path") {
      node.setAttribute("id", nextNodeName("path"));
      node.setAttribute(
        "d",
        `M ${centerX - 148} ${centerY + 44} C ${centerX - 112} ${centerY - 88}, ${centerX - 20} ${centerY - 96}, ${centerX + 12} ${centerY - 12} S ${centerX + 122} ${centerY + 78}, ${centerX + 150} ${centerY - 44}`
      );
      node.setAttribute("fill", "none");
      node.setAttribute("stroke", "#b5461d");
      node.setAttribute("stroke-width", "12");
      node.setAttribute("stroke-linecap", "round");
      node.setAttribute("stroke-linejoin", "round");
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

  function viewBoxFor(root) {
    const box = resolveRootViewportRect(root);
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  }

  function canDragNode(node) {
    if (!node || node === state.svgRoot) {
      return false;
    }

    const tag = node.tagName.toLowerCase();
    return !isNodeLocked(node) && !["defs", "clipPath", "mask", "symbol", "linearGradient", "radialGradient", "stop"].includes(tag);
  }

  function canResizeNode(node) {
    if (!node || node === state.svgRoot || isNodeLocked(node)) {
      return false;
    }

    return RESIZABLE_TAGS.has(node.tagName.toLowerCase());
  }

  function getResizeHandles(node) {
    if (!canResizeNode(node)) {
      return [];
    }

    const tag = node.tagName.toLowerCase();
    if (tag === "line") {
      return [
        {
          key: "start",
          x: getNumericAttr(node, "x1"),
          y: getNumericAttr(node, "y1")
        },
        {
          key: "end",
          x: getNumericAttr(node, "x2"),
          y: getNumericAttr(node, "y2")
        }
      ];
    }

    const box = normalizeRect(node.getBBox());
    if (!box || (!box.width && !box.height)) {
      return [];
    }

    return [
      { key: "nw", x: box.x, y: box.y },
      { key: "ne", x: box.x + box.width, y: box.y },
      { key: "se", x: box.x + box.width, y: box.y + box.height },
      { key: "sw", x: box.x, y: box.y + box.height }
    ];
  }

  function getNumericAttr(node, attrName, fallback = 0) {
    const value = Number.parseFloat(node.getAttribute(attrName));
    return Number.isFinite(value) ? value : fallback;
  }

  function roundCoordinate(value) {
    return Math.round(value * 100) / 100;
  }

  function getGridMetrics() {
    const gridScreenSize = state.gridSnapSize || GRID_SCREEN_SIZE;

    return {
      originX: 0,
      originY: 0,
      stepX: gridScreenSize,
      stepY: gridScreenSize
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

  function snapFieldValue(fieldKey, value) {
    if (!state.gridSnapEnabled) {
      return value;
    }

    const trimmed = value.trim();
    const parsed = Number.parseFloat(trimmed);
    if (!trimmed || !Number.isFinite(parsed)) {
      return value;
    }

    const grid = getGridMetrics();
    if (["x", "x1", "x2", "cx"].includes(fieldKey)) {
      return String(roundCoordinate(snapCoordinate(parsed, grid.stepX, grid.originX)));
    }

    if (["y", "y1", "y2", "cy"].includes(fieldKey)) {
      return String(roundCoordinate(snapCoordinate(parsed, grid.stepY, grid.originY)));
    }

    return value;
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

  function getResizeDescriptor(node, handle) {
    if (!canResizeNode(node)) {
      return null;
    }

    if (node.tagName.toLowerCase() === "line") {
      return {
        handle,
        mode: "line-endpoint",
        x1: getNumericAttr(node, "x1"),
        y1: getNumericAttr(node, "y1"),
        x2: getNumericAttr(node, "x2"),
        y2: getNumericAttr(node, "y2")
      };
    }

    const box = normalizeRect(node.getBBox());
    if (!box || box.width < 1 || box.height < 1) {
      return null;
    }

    const corners = {
      nw: { x: box.x, y: box.y },
      ne: { x: box.x + box.width, y: box.y },
      se: { x: box.x + box.width, y: box.y + box.height },
      sw: { x: box.x, y: box.y + box.height }
    };
    const oppositeHandleByHandle = {
      nw: "se",
      ne: "sw",
      se: "nw",
      sw: "ne"
    };
    const anchorHandle = oppositeHandleByHandle[handle];
    if (!anchorHandle) {
      return null;
    }

    return {
      anchor: corners[anchorHandle],
      baseMatrix: normalizeMatrix(node.transform?.baseVal?.consolidate()?.matrix),
      box,
      handle,
      startHandle: corners[handle]
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

  function applyResize(node, descriptor, point) {
    if (!descriptor || !canResizeNode(node)) {
      return;
    }

    const grid = getGridMetrics();
    const snappedPoint = {
      x: snapCoordinate(point.x, grid.stepX, grid.originX),
      y: snapCoordinate(point.y, grid.stepY, grid.originY)
    };

    if (descriptor.mode === "line-endpoint") {
      if (descriptor.handle === "start") {
        node.setAttribute("x1", String(roundCoordinate(snappedPoint.x)));
        node.setAttribute("y1", String(roundCoordinate(snappedPoint.y)));
        return;
      }

      node.setAttribute("x2", String(roundCoordinate(snappedPoint.x)));
      node.setAttribute("y2", String(roundCoordinate(snappedPoint.y)));
      return;
    }

    const startVectorX = descriptor.startHandle.x - descriptor.anchor.x;
    const startVectorY = descriptor.startHandle.y - descriptor.anchor.y;
    const currentVectorX = snappedPoint.x - descriptor.anchor.x;
    const currentVectorY = snappedPoint.y - descriptor.anchor.y;

    let scaleX = Math.abs(startVectorX) > 0.001 ? currentVectorX / startVectorX : 1;
    let scaleY = Math.abs(startVectorY) > 0.001 ? currentVectorY / startVectorY : 1;

    if (!Number.isFinite(scaleX) || scaleX <= 0) {
      scaleX = 0.05;
    }
    if (!Number.isFinite(scaleY) || scaleY <= 0) {
      scaleY = 0.05;
    }

    const nextMatrix = multiplyMatrix(
      multiplyMatrix(
        multiplyMatrix(
          translateMatrix(descriptor.anchor.x, descriptor.anchor.y),
          scaleMatrix(scaleX, scaleY)
        ),
        translateMatrix(-descriptor.anchor.x, -descriptor.anchor.y)
      ),
      descriptor.baseMatrix
    );

    node.setAttribute("transform", matrixToTransform(nextMatrix));
  }

  return {
    applyDrag,
    applyResize,
    canDragNode,
    canResizeNode,
    createElementNode,
    createImageNodeFromFile,
    getDragDescriptor,
    getInsertParent,
    getNumericAttr,
    getResizeHandles,
    getResizeDescriptor,
    getViewBoxRect,
    roundCoordinate,
    snapCoordinate,
    snapFieldValue,
    snapNodeToGrid,
    toLocalPoint,
    viewBoxFor
  };
}
