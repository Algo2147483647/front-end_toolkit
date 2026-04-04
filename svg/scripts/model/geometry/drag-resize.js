export function createSvgDragResizeTools({
  state,
  isNodeLocked,
  normalizeRect,
  getNumericAttr,
  roundCoordinate,
  snapCoordinate,
  parseSimpleCubicBezier,
  serializeSimpleCubicBezier,
  translateSimpleCubicBezier,
  translatePathData
}) {
  const RESIZABLE_TAGS = new Set(["rect", "circle", "ellipse", "line", "polyline", "polygon", "path"]);

  function clampInteger(value, min, max, fallback) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }

    return Math.max(min, Math.min(max, parsed));
  }

  function parsePointList(value) {
    const tokens = String(value || "")
      .trim()
      .split(/[\s,]+/)
      .map((token) => Number.parseFloat(token))
      .filter((token) => Number.isFinite(token));
    const points = [];

    for (let index = 0; index < tokens.length - 1; index += 2) {
      points.push({ x: tokens[index], y: tokens[index + 1] });
    }

    return points;
  }

  function serializePointList(points) {
    return points
      .map((point) => `${roundCoordinate(point.x)},${roundCoordinate(point.y)}`)
      .join(" ");
  }

  function getPointBounds(points) {
    if (!points.length) {
      return null;
    }

    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, 1),
      height: Math.max(maxY - minY, 1)
    };
  }

  function getNodeGeometryBounds(node) {
    return normalizeRect(node?.getBBox?.()) || getPointBounds(parsePointList(node?.getAttribute?.("points")));
  }

  function createRegularPolygonPoints(box, sides) {
    const centerX = box.x + (box.width / 2);
    const centerY = box.y + (box.height / 2);
    const radiusX = Math.max(box.width / 2, 1);
    const radiusY = Math.max(box.height / 2, 1);
    const rawPoints = Array.from({ length: sides }, (_, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / sides);
      return {
        x: centerX + (Math.cos(angle) * radiusX),
        y: centerY + (Math.sin(angle) * radiusY)
      };
    });
    const rawBounds = getPointBounds(rawPoints);

    if (!rawBounds) {
      return rawPoints;
    }

    return scalePointsToBox(rawPoints, rawBounds, box);
  }

  function createEquilateralPolygonPoints(box, sides) {
    const centerX = box.x + (box.width / 2);
    const centerY = box.y + (box.height / 2);
    const radius = Math.max(Math.min(box.width, box.height) / 2, 1);

    return Array.from({ length: sides }, (_, index) => {
      const angle = (-Math.PI / 2) + ((Math.PI * 2 * index) / sides);
      return {
        x: centerX + (Math.cos(angle) * radius),
        y: centerY + (Math.sin(angle) * radius)
      };
    });
  }

  function resamplePolylinePoints(points, count) {
    if (points.length < 2 || count < 2) {
      return points;
    }

    const lastIndex = points.length - 1;
    return Array.from({ length: count }, (_, index) => {
      if (index === 0) {
        return points[0];
      }
      if (index === count - 1) {
        return points[lastIndex];
      }

      const position = (index / (count - 1)) * lastIndex;
      const lowerIndex = Math.floor(position);
      const upperIndex = Math.ceil(position);
      const ratio = position - lowerIndex;
      const lower = points[lowerIndex];
      const upper = points[upperIndex] || lower;

      return {
        x: lower.x + ((upper.x - lower.x) * ratio),
        y: lower.y + ((upper.y - lower.y) * ratio)
      };
    });
  }

  function createResizeBox(anchor, point) {
    return {
      x: Math.min(anchor.x, point.x),
      y: Math.min(anchor.y, point.y),
      width: Math.max(Math.abs(point.x - anchor.x), 1),
      height: Math.max(Math.abs(point.y - anchor.y), 1)
    };
  }

  function createUniformResizeBox(anchor, point) {
    const dx = point.x - anchor.x;
    const dy = point.y - anchor.y;
    const size = Math.max(1, Math.min(Math.abs(dx), Math.abs(dy)));
    const signX = dx >= 0 ? 1 : -1;
    const signY = dy >= 0 ? 1 : -1;

    return {
      x: signX < 0 ? anchor.x - size : anchor.x,
      y: signY < 0 ? anchor.y - size : anchor.y,
      width: size,
      height: size
    };
  }

  function mapValueBetweenBoxes(value, sourceStart, sourceSize, targetStart, targetSize) {
    const safeSourceSize = Math.abs(sourceSize) > 0.001 ? sourceSize : 1;
    const ratio = (value - sourceStart) / safeSourceSize;
    return targetStart + (ratio * targetSize);
  }

  function scalePointsToBox(points, sourceBox, targetBox) {
    return points.map((point) => ({
      x: mapValueBetweenBoxes(point.x, sourceBox.x, sourceBox.width, targetBox.x, targetBox.width),
      y: mapValueBetweenBoxes(point.y, sourceBox.y, sourceBox.height, targetBox.y, targetBox.height)
    }));
  }

  function bezierToPoints(bezier) {
    return [
      { x: bezier.start.x, y: bezier.start.y },
      { x: bezier.control1.x, y: bezier.control1.y },
      { x: bezier.control2.x, y: bezier.control2.y },
      { x: bezier.end.x, y: bezier.end.y }
    ];
  }

  function pointsToBezier(points) {
    if (points.length !== 4) {
      return null;
    }

    return {
      start: { x: points[0].x, y: points[0].y },
      control1: { x: points[1].x, y: points[1].y },
      control2: { x: points[2].x, y: points[2].y },
      end: { x: points[3].x, y: points[3].y }
    };
  }

  function translatePoints(points, dx, dy) {
    return points.map((point) => ({
      x: point.x + dx,
      y: point.y + dy
    }));
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
          cursor: "move",
          x: getNumericAttr(node, "x1"),
          y: getNumericAttr(node, "y1")
        },
        {
          key: "end",
          cursor: "move",
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
      { key: "nw", cursor: "nwse-resize", x: box.x, y: box.y },
      { key: "ne", cursor: "nesw-resize", x: box.x + box.width, y: box.y },
      { key: "se", cursor: "nwse-resize", x: box.x + box.width, y: box.y + box.height },
      { key: "sw", cursor: "nesw-resize", x: box.x, y: box.y + box.height }
    ];
  }

  function getPointHandles(node) {
    const tag = node?.tagName?.toLowerCase?.();
    if (!["polyline", "polygon"].includes(tag) || isNodeLocked(node)) {
      return [];
    }

    return parsePointList(node.getAttribute("points")).map((point, index) => ({
      key: `point-${index}`,
      cursor: "move",
      x: point.x,
      y: point.y
    }));
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

    if (tag === "polyline" || tag === "polygon") {
      const points = parsePointList(node.getAttribute("points"));
      const box = getPointBounds(points) || normalizeRect(node.getBBox());
      return {
        box,
        mode: tag,
        points
      };
    }

    if (tag === "path") {
      const bezier = parseSimpleCubicBezier(node);
      const box = normalizeRect(node.getBBox());
      return {
        bezier,
        box,
        d: node.getAttribute("d") || "",
        mode: "path"
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
      const startHandle = handle === "start"
        ? { x: getNumericAttr(node, "x1"), y: getNumericAttr(node, "y1") }
        : { x: getNumericAttr(node, "x2"), y: getNumericAttr(node, "y2") };
      return {
        handle,
        mode: "line-endpoint",
        startHandle,
        x1: getNumericAttr(node, "x1"),
        y1: getNumericAttr(node, "y1"),
        x2: getNumericAttr(node, "x2"),
        y2: getNumericAttr(node, "y2")
      };
    }

    const tag = node.tagName.toLowerCase();
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

    if (tag === "rect") {
      return {
        anchor: corners[anchorHandle],
        box,
        handle,
        mode: "rect",
        rx: getNumericAttr(node, "rx"),
        ry: getNumericAttr(node, "ry"),
        startHandle: corners[handle]
      };
    }

    if (tag === "circle") {
      return {
        anchor: corners[anchorHandle],
        box,
        handle,
        mode: "circle",
        startHandle: corners[handle]
      };
    }

    if (tag === "ellipse") {
      return {
        anchor: corners[anchorHandle],
        box,
        handle,
        mode: "ellipse",
        startHandle: corners[handle]
      };
    }

    if (tag === "polyline" || tag === "polygon") {
      const points = parsePointList(node.getAttribute("points"));
      return {
        anchor: corners[anchorHandle],
        box,
        handle,
        mode: tag,
        points,
        startHandle: corners[handle]
      };
    }

    if (tag === "path") {
      const bezier = parseSimpleCubicBezier(node);
      if (!bezier) {
        return null;
      }

      return {
        anchor: corners[anchorHandle],
        bezier,
        box,
        handle,
        mode: "path-bezier-resize",
        startHandle: corners[handle]
      };
    }

    return {
      anchor: corners[anchorHandle],
      box,
      handle,
      startHandle: corners[handle]
    };
  }

  function getPointHandleDescriptor(node, handle) {
    const tag = node?.tagName?.toLowerCase?.();
    if (!["polyline", "polygon"].includes(tag) || isNodeLocked(node)) {
      return null;
    }

    const match = String(handle || "").match(/^point-(\d+)$/);
    if (!match) {
      return null;
    }

    const index = Number.parseInt(match[1], 10);
    const points = parsePointList(node.getAttribute("points"));
    const point = points[index];
    if (!point) {
      return null;
    }

    return {
      index,
      mode: "point-handle",
      points,
      startHandle: {
        x: point.x,
        y: point.y
      }
    };
  }

  function applyDrag(node, descriptor, dx, dy) {
    if (descriptor.mode === "xy") {
      const nextX = snapCoordinate(descriptor.x + dx, state.gridSnapSize || 1, 0);
      const nextY = snapCoordinate(descriptor.y + dy, state.gridSnapSize || 1, 0);
      node.setAttribute("x", String(roundCoordinate(nextX)));
      node.setAttribute("y", String(roundCoordinate(nextY)));
      return;
    }

    if (descriptor.mode === "center") {
      const nextCx = snapCoordinate(descriptor.cx + dx, state.gridSnapSize || 1, 0);
      const nextCy = snapCoordinate(descriptor.cy + dy, state.gridSnapSize || 1, 0);
      node.setAttribute("cx", String(roundCoordinate(nextCx)));
      node.setAttribute("cy", String(roundCoordinate(nextCy)));
      return;
    }

    if (descriptor.mode === "line") {
      const nextX1 = snapCoordinate(descriptor.x1 + dx, state.gridSnapSize || 1, 0);
      const nextY1 = snapCoordinate(descriptor.y1 + dy, state.gridSnapSize || 1, 0);
      const snappedDx = nextX1 - descriptor.x1;
      const snappedDy = nextY1 - descriptor.y1;
      node.setAttribute("x1", String(roundCoordinate(nextX1)));
      node.setAttribute("y1", String(roundCoordinate(nextY1)));
      node.setAttribute("x2", String(roundCoordinate(descriptor.x2 + snappedDx)));
      node.setAttribute("y2", String(roundCoordinate(descriptor.y2 + snappedDy)));
      return;
    }

    if (descriptor.mode === "polyline" || descriptor.mode === "polygon") {
      const box = descriptor.box || getPointBounds(descriptor.points);
      if (!box) {
        return;
      }

      const nextX = snapCoordinate(box.x + dx, state.gridSnapSize || 1, 0);
      const nextY = snapCoordinate(box.y + dy, state.gridSnapSize || 1, 0);
      const snappedDx = nextX - box.x;
      const snappedDy = nextY - box.y;
      node.setAttribute("points", serializePointList(translatePoints(descriptor.points, snappedDx, snappedDy)));
      return;
    }

    if (descriptor.mode === "path") {
      const box = descriptor.box;
      if (!box) {
        return;
      }

      const nextX = snapCoordinate(box.x + dx, state.gridSnapSize || 1, 0);
      const nextY = snapCoordinate(box.y + dy, state.gridSnapSize || 1, 0);
      const snappedDx = nextX - box.x;
      const snappedDy = nextY - box.y;

      if (descriptor.bezier) {
        node.setAttribute("d", serializeSimpleCubicBezier(translateSimpleCubicBezier(descriptor.bezier, snappedDx, snappedDy)));
        return;
      }

      node.setAttribute("d", translatePathData(descriptor.d, snappedDx, snappedDy));
      return;
    }

    const { a, b, c, d, e, f } = descriptor.baseMatrix;
    const nextE = roundCoordinate(snapCoordinate(e + dx, state.gridSnapSize || 1, 0));
    const nextF = roundCoordinate(snapCoordinate(f + dy, state.gridSnapSize || 1, 0));
    node.setAttribute("transform", `matrix(${a} ${b} ${c} ${d} ${nextE} ${nextF})`);
  }

  function applyResize(node, descriptor, point) {
    if (!descriptor || !canResizeNode(node)) {
      return;
    }

    const snappedPoint = {
      x: snapCoordinate(point.x, state.gridSnapSize || 1, 0),
      y: snapCoordinate(point.y, state.gridSnapSize || 1, 0)
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

    if (descriptor.mode === "rect") {
      const nextBox = createResizeBox(descriptor.anchor, snappedPoint);
      node.setAttribute("x", String(roundCoordinate(nextBox.x)));
      node.setAttribute("y", String(roundCoordinate(nextBox.y)));
      node.setAttribute("width", String(roundCoordinate(nextBox.width)));
      node.setAttribute("height", String(roundCoordinate(nextBox.height)));
      if (descriptor.rx > 0) {
        node.setAttribute("rx", String(roundCoordinate(Math.min(descriptor.rx, nextBox.width / 2))));
      }
      if (descriptor.ry > 0) {
        node.setAttribute("ry", String(roundCoordinate(Math.min(descriptor.ry, nextBox.height / 2))));
      }
      return;
    }

    if (descriptor.mode === "circle") {
      const nextBox = createUniformResizeBox(descriptor.anchor, snappedPoint);
      const radius = Math.max(0.5, Math.min(nextBox.width, nextBox.height) / 2);
      node.setAttribute("cx", String(roundCoordinate(nextBox.x + (nextBox.width / 2))));
      node.setAttribute("cy", String(roundCoordinate(nextBox.y + (nextBox.height / 2))));
      node.setAttribute("r", String(roundCoordinate(radius)));
      return;
    }

    if (descriptor.mode === "ellipse") {
      const nextBox = createResizeBox(descriptor.anchor, snappedPoint);
      node.setAttribute("cx", String(roundCoordinate(nextBox.x + (nextBox.width / 2))));
      node.setAttribute("cy", String(roundCoordinate(nextBox.y + (nextBox.height / 2))));
      node.setAttribute("rx", String(roundCoordinate(nextBox.width / 2)));
      node.setAttribute("ry", String(roundCoordinate(nextBox.height / 2)));
      return;
    }

    if (descriptor.mode === "polyline" || descriptor.mode === "polygon") {
      const nextBox = createResizeBox(descriptor.anchor, snappedPoint);
      const nextPoints = scalePointsToBox(descriptor.points, descriptor.box, nextBox);
      node.setAttribute("points", serializePointList(nextPoints));
      return;
    }

    if (descriptor.mode === "path-bezier-resize") {
      const nextBox = createResizeBox(descriptor.anchor, snappedPoint);
      const nextBezierPoints = scalePointsToBox(bezierToPoints(descriptor.bezier), descriptor.box, nextBox);
      const nextBezier = pointsToBezier(nextBezierPoints);
      if (!nextBezier) {
        return;
      }
      node.setAttribute("d", serializeSimpleCubicBezier(nextBezier));
    }
  }

  function applyPointHandle(node, descriptor, point) {
    if (!descriptor || descriptor.mode !== "point-handle") {
      return false;
    }

    const points = [...descriptor.points];
    if (!points[descriptor.index]) {
      return false;
    }

    points[descriptor.index] = {
      x: snapCoordinate(point.x, state.gridSnapSize || 1, 0),
      y: snapCoordinate(point.y, state.gridSnapSize || 1, 0)
    };
    node.setAttribute("points", serializePointList(points));
    return true;
  }

  function getPolygonSideCount(node) {
    return Math.max(0, parsePointList(node?.getAttribute?.("points")).length);
  }

  function updatePolygonSideCount(node, nextCount) {
    const currentPoints = parsePointList(node?.getAttribute?.("points"));
    const currentCount = currentPoints.length;
    const count = clampInteger(nextCount, 3, 16, currentCount || 5);
    if (!count || count === currentCount) {
      return false;
    }

    const box = getNodeGeometryBounds(node) || getPointBounds(currentPoints);
    if (!box) {
      return false;
    }

    node.setAttribute("points", serializePointList(createRegularPolygonPoints(box, count)));
    return true;
  }

  function regularizePolygon(node) {
    const currentPoints = parsePointList(node?.getAttribute?.("points"));
    const count = clampInteger(currentPoints.length, 3, 16, 5);
    if (!count) {
      return false;
    }

    const box = getNodeGeometryBounds(node) || getPointBounds(currentPoints);
    if (!box) {
      return false;
    }

    node.setAttribute("points", serializePointList(createRegularPolygonPoints(box, count)));
    return true;
  }

  function regularizePolygonEqualSides(node) {
    const currentPoints = parsePointList(node?.getAttribute?.("points"));
    const count = clampInteger(currentPoints.length, 3, 16, 5);
    if (!count) {
      return false;
    }

    const box = getNodeGeometryBounds(node) || getPointBounds(currentPoints);
    if (!box) {
      return false;
    }

    node.setAttribute("points", serializePointList(createEquilateralPolygonPoints(box, count)));
    return true;
  }

  function getPolylinePointCount(node) {
    return Math.max(0, parsePointList(node?.getAttribute?.("points")).length);
  }

  function updatePolylinePointCount(node, nextCount) {
    const currentPoints = parsePointList(node?.getAttribute?.("points"));
    const currentCount = currentPoints.length;
    const count = clampInteger(nextCount, 2, 24, currentCount || 4);
    if (currentPoints.length < 2 || count === currentCount) {
      return false;
    }

    node.setAttribute("points", serializePointList(resamplePolylinePoints(currentPoints, count)));
    return true;
  }

  return {
    applyPointHandle,
    applyDrag,
    applyResize,
    canDragNode,
    canResizeNode,
    getDragDescriptor,
    getPointHandleDescriptor,
    getPointHandles,
    getPolygonSideCount,
    getPolylinePointCount,
    regularizePolygon,
    regularizePolygonEqualSides,
    getResizeDescriptor,
    getResizeHandles,
    updatePolygonSideCount,
    updatePolylinePointCount
  };
}
