import { createSvgDragResizeTools } from "./geometry/drag-resize";
import { createSvgPathTools } from "./geometry/path-tools";
import { createSvgShapeFactoryTools } from "./geometry/shape-factory";
import { createSvgSnapTools } from "./geometry/snap-tools";
import { createSvgViewportCoordsTools } from "./geometry/viewport-coords";
import type { DragResizeTools, MetadataTools, PathTools, ShapeFactoryTools, SnapTools, SvgRuntimeStateLike, ViewportTools } from "./types";

interface GeometryDeps {
  state: SvgRuntimeStateLike;
  isNodeLocked: MetadataTools["isNodeLocked"];
}

export function createSvgGeometryTools({ state, isNodeLocked }: GeometryDeps): ViewportTools & SnapTools & PathTools & ShapeFactoryTools & DragResizeTools {
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
    getNodeVisualBounds: viewportTools.getNodeVisualBounds,
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
