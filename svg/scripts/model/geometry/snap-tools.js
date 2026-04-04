import { GRID_SCREEN_SIZE } from "../../constants.js";

export function createSvgSnapTools({ state, getNumericAttr, roundCoordinate }) {
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

  return {
    getGridMetrics,
    snapCoordinate,
    snapFieldValue,
    snapNodeToGrid
  };
}
