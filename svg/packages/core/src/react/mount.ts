import "../../../../styles.css";
import "../host.css";
import { EMPTY_SVG, SAMPLE_SVG } from "../../../../scripts/constants.js";
import { createEditor } from "../../../../scripts/editor.js";
import { createRenderer } from "../../../../scripts/renderer.js";
import { createSvgModel } from "../../../../scripts/svg-model.js";
import { createSvgStudioState } from "./state";
import type { SvgStudioUiRefs } from "./types";

export function mountReactSvgStudio(ui: SvgStudioUiRefs) {
  const state = createSvgStudioState();
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
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

  return {
    editor,
    model,
    renderer,
    state
  };
}
