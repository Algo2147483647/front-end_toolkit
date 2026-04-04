import { createSvgDragResizeTools } from "./geometry/drag-resize.js";
import { createSvgPathTools } from "./geometry/path-tools.js";
import { createSvgShapeFactoryTools } from "./geometry/shape-factory.js";
import { createSvgSnapTools } from "./geometry/snap-tools.js";
import { createSvgViewportCoordsTools } from "./geometry/viewport-coords.js";

export function createSvgGeometryTools({ state, isNodeLocked }) {
  const viewportTools = createSvgViewportCoordsTools({ state });
  const snapTools = createSvgSnapTools({
    state,
    getNumericAttr: viewportTools.getNumericAttr,
    roundCoordinate: viewportTools.roundCoordinate
  });
  const pathTools = createSvgPathTools({
    state,
    roundCoordinate: viewportTools.roundCoordinate
  });
  const shapeFactoryTools = createSvgShapeFactoryTools({
    state,
    getViewBoxRect: viewportTools.getViewBoxRect,
    isNodeLocked
  });
  const dragResizeTools = createSvgDragResizeTools({
    state,
    isNodeLocked,
    normalizeRect: viewportTools.normalizeRect,
    getNumericAttr: viewportTools.getNumericAttr,
    roundCoordinate: viewportTools.roundCoordinate,
    snapCoordinate: snapTools.snapCoordinate,
    parseSimpleCubicBezier: pathTools.parseSimpleCubicBezier,
    serializeSimpleCubicBezier: pathTools.serializeSimpleCubicBezier,
    translateSimpleCubicBezier: pathTools.translateSimpleCubicBezier,
    translatePathData: pathTools.translatePathData
  });

  return {
    ...viewportTools,
    ...snapTools,
    ...pathTools,
    ...shapeFactoryTools,
    ...dragResizeTools
  };
}
