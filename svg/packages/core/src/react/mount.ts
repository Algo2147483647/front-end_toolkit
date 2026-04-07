import "../../../../styles.css";
import "../host.css";
import { EMPTY_SVG, SAMPLE_SVG } from "../runtime/constants";
import { createEditor } from "../runtime/create-editor";
import { createSvgModel } from "../runtime/create-svg-model";
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

  const unbindEvents = editor.bindEvents({
    bindWindowEvents: true,
    bindWorkspaceEvents: false
  });
  renderer.syncChrome();
  editor.setSourcePaneVisible(false);
  editor.loadDocument(SAMPLE_SVG);

  return {
    dispose() {
      unbindEvents?.();
      renderer.dispose?.();
    },
    editor,
    model,
    renderer,
    state,
    store
  };
}
