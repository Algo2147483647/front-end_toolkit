import "../../../../styles.css";
import "../host.css";
import { EMPTY_SVG, SAMPLE_SVG } from "../../../../scripts/constants.js";
import { createEditor } from "../../../../scripts/editor.js";
import { createRenderer } from "../../../../scripts/renderer.js";
import { createSvgModel } from "../../../../scripts/svg-model.js";
import { createReactInspectorRenderer } from "./renderers/inspector-renderer";
import { createReactTreeRenderer } from "./renderers/tree-renderer";
import { createReactWorkspaceRenderer } from "./renderers/workspace-renderer";
import { createSvgStudioState } from "./state";
import type { SvgStudioUiRefs } from "./types";

export function mountReactSvgStudio(ui: SvgStudioUiRefs) {
  const state = createSvgStudioState();
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
  const model = createSvgModel(state);
  const renderer = createRenderer({
    state,
    ui,
    model,
    actions,
    rendererFactories: {
      createInspectorRenderer: createReactInspectorRenderer,
      createTreeRenderer: createReactTreeRenderer,
      createWorkspaceRenderer: createReactWorkspaceRenderer
    }
  });
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
    state
  };
}
