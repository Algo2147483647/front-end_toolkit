import { EMPTY_SVG, SAMPLE_SVG } from "./constants.js";
import { state, ui } from "./context.js";
import { createEditor } from "./editor.js";
import { createRenderer } from "./renderer.js";
import { createSvgModel } from "./svg-model.js";

const actions = {};
const model = createSvgModel(state);
const renderer = createRenderer({ state, ui, model, actions });
const editor = createEditor({ state, ui, model, renderer, emptySvg: EMPTY_SVG });

Object.assign(actions, {
  onPointHandlePointerDown: editor.onPointHandlePointerDown,
  onPathBezierHandlePointerDown: editor.onPathBezierHandlePointerDown,
  onResizeHandlePointerDown: editor.onResizeHandlePointerDown,
  onSvgClick: editor.onSvgClick,
  onSvgPointerDown: editor.onSvgPointerDown,
  regularizePolygon: editor.regularizePolygon,
  regularizePolygonEqualSides: editor.regularizePolygonEqualSides,
  selectNode: editor.selectNode,
  toggleNodeCollapse: editor.toggleNodeCollapse,
  toggleNodeLock: editor.toggleNodeLock,
  toggleNodeVisibility: editor.toggleNodeVisibility,
  updateField: editor.updateField,
  updatePathBezier: editor.updatePathBezier,
  updatePolygonSides: editor.updatePolygonSides,
  updatePolylinePointCount: editor.updatePolylinePointCount
});

editor.bindEvents();
renderer.syncChrome();
editor.setSourcePaneVisible(false);
editor.loadDocument(SAMPLE_SVG);
