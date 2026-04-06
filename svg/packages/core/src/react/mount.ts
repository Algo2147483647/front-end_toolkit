import "../../../../styles.css";
import "../host.css";
import { EMPTY_SVG, SAMPLE_SVG } from "../../../../scripts/constants.js";
import { createEditor } from "../../../../scripts/editor.js";
import { createSvgModel } from "../../../../scripts/svg-model.js";
import { createRenderer } from "../runtime/create-renderer";
import { createSvgRuntimeStore } from "./state";
import type { SvgStudioUiRefs } from "./types";

export function mountReactSvgStudio(ui: SvgStudioUiRefs) {
  const store = createSvgRuntimeStore();
  const state = store.getState();
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
  const model = createSvgModel(state);
  const renderer = createRenderer({
    store,
    state,
    ui,
    model,
    actions
  });
  const editor = createEditor({ store, state, ui, model, renderer, emptySvg: EMPTY_SVG });

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

  editor.bindEvents({
    bindWindowEvents: false,
    bindWorkspaceEvents: false
  });
  renderer.syncChrome();
  editor.setSourcePaneVisible(false);
  editor.loadDocument(SAMPLE_SVG);

  return {
    dispose() {
      renderer.dispose?.();
    },
    editor,
    model,
    renderer,
    state,
    store
  };
}
