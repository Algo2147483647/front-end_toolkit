export function createSvgViewportCoordsTools({ state }) {
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

    return normalizeRect(root?.viewBox?.baseVal);
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

  function getNumericAttr(node, attrName, fallback = 0) {
    const value = Number.parseFloat(node.getAttribute(attrName));
    return Number.isFinite(value) ? value : fallback;
  }

  function roundCoordinate(value) {
    return Math.round(value * 100) / 100;
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

  function viewBoxFor(root) {
    const box = resolveRootViewportRect(root);
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  }

  return {
    getNumericAttr,
    getViewBoxRect,
    normalizeRect,
    roundCoordinate,
    toLocalPoint,
    viewBoxFor
  };
}
