import type { RectLike, SvgPoint, SvgRect, SvgRuntimeStateLike, SvgSvgNode, ViewportTools } from "../types";

interface ViewportDeps {
  state: SvgRuntimeStateLike;
}

const SVG_UNIT_SCALE: Record<string, number> = {
  "": 1,
  px: 1,
  in: 96,
  cm: 96 / 2.54,
  mm: 96 / 25.4,
  pt: 96 / 72,
  pc: 16
};

function normalizeRectInternal(rect: RectLike | null | undefined, allowZeroSize: boolean) {
  if (!rect) {
    return null;
  }

  const x = Number(rect.x);
  const y = Number(rect.y);
  const width = Number(rect.width);
  const height = Number(rect.height);
  const invalidSize = allowZeroSize ? width < 0 || height < 0 : width <= 0 || height <= 0;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || invalidSize) {
    return null;
  }

  return { x, y, width, height };
}

export function createSvgViewportCoordsTools({ state }: ViewportDeps): ViewportTools {
  function normalizeRect(rect: RectLike | null | undefined) {
    return normalizeRectInternal(rect, false);
  }

  function normalizeVisualRect(rect: RectLike | null | undefined) {
    return normalizeRectInternal(rect, true);
  }

  function parseSvgLength(value: string | null | undefined) {
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
    if (!(unit in SVG_UNIT_SCALE)) {
      return null;
    }

    return amount * SVG_UNIT_SCALE[unit];
  }

  function parseViewBox(root: SvgSvgNode | null | undefined): SvgRect | null {
    const attr = root?.getAttribute("viewBox");
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

  function parseRootDimensions(root: SvgSvgNode | null | undefined): SvgRect | null {
    const width = parseSvgLength(root?.getAttribute("width"));
    const height = parseSvgLength(root?.getAttribute("height"));
    if (width == null || height == null || width <= 0 || height <= 0) {
      return null;
    }

    return {
      x: 0,
      y: 0,
      width,
      height
    };
  }

  function measureRootBounds(root: SvgSvgNode | null | undefined): SvgRect | null {
    try {
      return normalizeRect(root?.getBBox());
    } catch {
      return null;
    }
  }

  function resolveRootViewportRect(root: SvgSvgNode | null = state.svgRoot): SvgRect {
    return parseViewBox(root)
      || parseRootDimensions(root)
      || measureRootBounds(root)
      || { x: 0, y: 0, width: 1200, height: 800 };
  }

  function getViewBoxRect(root: SvgSvgNode | null = state.svgRoot) {
    return resolveRootViewportRect(root);
  }

  function getNumericAttr(node: Element, attrName: string, fallback = 0) {
    const value = Number.parseFloat(node.getAttribute(attrName) || "");
    return Number.isFinite(value) ? value : fallback;
  }

  function roundCoordinate(value: number) {
    return Math.round(value * 100) / 100;
  }

  function toLocalPoint(referenceNode: SVGGraphicsElement | SVGSVGElement, clientX: number, clientY: number): SvgPoint {
    const point = state.svgRoot?.createSVGPoint();
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

  function getNodeVisualBounds(node: Element | null | undefined) {
    const graphicsNode = node as SVGGraphicsElement | null | undefined;
    if (!graphicsNode) {
      return null;
    }

    const root = state.svgRoot;
    const point = root?.createSVGPoint();
    const rootMatrix = root?.getScreenCTM();
    const rect = graphicsNode.getBoundingClientRect?.();
    if (!point || !rootMatrix || !rect || (!rect.width && !rect.height)) {
      try {
        return normalizeVisualRect(graphicsNode.getBBox());
      } catch {
        return null;
      }
    }

    const inverse = rootMatrix.inverse();
    const corners = [
      { x: rect.left, y: rect.top },
      { x: rect.right, y: rect.top },
      { x: rect.right, y: rect.bottom },
      { x: rect.left, y: rect.bottom }
    ].map((corner) => {
      point.x = corner.x;
      point.y = corner.y;
      return point.matrixTransform(inverse);
    });

    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);
    return normalizeVisualRect({
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys)
    });
  }

  function viewBoxFor(root: SvgSvgNode | null | undefined) {
    const box = resolveRootViewportRect(root || null);
    return `${box.x} ${box.y} ${box.width} ${box.height}`;
  }

  return {
    getNumericAttr,
    getNodeVisualBounds,
    getViewBoxRect,
    normalizeRect,
    roundCoordinate,
    toLocalPoint,
    viewBoxFor
  };
}
