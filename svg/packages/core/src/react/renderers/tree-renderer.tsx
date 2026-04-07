import { Fragment, useLayoutEffect, type CSSProperties } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useRuntimeVersion } from "./use-runtime-version";

interface TreeRendererDeps {
  store: any;
  state: any;
  ui: any;
  model: any;
  actions: any;
}

interface TreeNodeRowProps {
  actions: any;
  depth: number;
  model: any;
  node: SVGElement;
  state: any;
}

function TreeNodeRow({ actions, depth, model, node, state }: TreeNodeRowProps) {
  if (node.tagName.toLowerCase() === "style") {
    return null;
  }

  const children = model.getRenderableChildren(node);
  const hasChildren = children.length > 0;
  const collapsed = state.collapsedNodeKeys.has(model.getNodeKey(node));
  const locked = model.isNodeLocked(node);
  const hidden = model.isNodeHidden(node);
  const editorId = node.dataset.editorId || "";
  const isSelected = state.selectedIds.has(editorId);

  return (
    <Fragment>
      <div
        className={[
          "tree-item",
          isSelected ? "is-selected" : "",
          locked ? "is-locked" : "",
          hidden ? "is-hidden" : ""
        ].filter(Boolean).join(" ")}
        style={{ "--depth": depth } as CSSProperties}
      >
        <div className="tree-main">
          <button
            type="button"
            className={`tree-expander${hasChildren ? "" : " is-placeholder"}`}
            disabled={!hasChildren}
            onClick={(event) => {
              event.stopPropagation();
              actions.toggleNodeCollapse(editorId);
            }}
          >
            {hasChildren ? (collapsed ? "+" : "-") : "."}
          </button>

          <button
            type="button"
            className="tree-select"
            onClick={() => actions.selectNode(editorId)}
          >
            <span className="tree-dot"></span>
            <span className="tree-tag">{node.tagName.toLowerCase()}</span>
            <span className="tree-label">{model.labelFor(node)}</span>
          </button>
        </div>

        <div className="tree-actions">
          <button
            type="button"
            className={`tree-action${!hidden ? " is-active" : ""}`}
            title={hidden ? "Show layer" : "Hide layer"}
            disabled={node === state.svgRoot}
            onClick={(event) => {
              event.stopPropagation();
              actions.toggleNodeVisibility(editorId);
            }}
          >
            {hidden ? "Show" : "Hide"}
          </button>
          <button
            type="button"
            className={`tree-action${locked ? " is-active" : ""}`}
            title={locked ? "Unlock layer" : "Lock layer"}
            disabled={node === state.svgRoot}
            onClick={(event) => {
              event.stopPropagation();
              actions.toggleNodeLock(editorId);
            }}
          >
            {locked ? "Unlock" : "Lock"}
          </button>
        </div>
      </div>

      {!collapsed ? children.map((child: SVGElement) => (
        <TreeNodeRow
          key={child.dataset.editorId || model.getNodeKey(child)}
          actions={actions}
          depth={depth + 1}
          model={model}
          node={child}
          state={state}
        />
      )) : null}
    </Fragment>
  );
}

function TreePanel({ actions, model, state }: Pick<TreeRendererDeps, "actions" | "model" | "state">) {
  if (!state.svgRoot) {
    return null;
  }

  return (
    <TreeNodeRow
      actions={actions}
      depth={0}
      model={model}
      node={state.svgRoot as SVGElement}
      state={state}
    />
  );
}

function TreeRendererRoot({ actions, model, store, ui }: TreeRendererDeps) {
  const version = useRuntimeVersion(store);
  const state = store.getState();

  useLayoutEffect(() => {
    if (state.svgRoot) {
      ui.nodeCountBadge.textContent = `${state.svgRoot.querySelectorAll("*").length + 1} nodes`;
      return;
    }

    ui.nodeCountBadge.textContent = "0 nodes";
  }, [state.svgRoot, ui, version]);

  return (
    <TreePanel
      actions={actions}
      model={model}
      state={state}
    />
  );
}

export function createReactTreeRenderer({ store, state, ui, model, actions }: TreeRendererDeps) {
  const root: Root = createRoot(ui.treePanel);
  root.render(
    <TreeRendererRoot
      actions={actions}
      model={model}
      state={state}
      store={store}
      ui={ui}
    />
  );

  function renderTree() {
    store.invalidate();
  }

  return {
    dispose() {
      root.unmount();
    },
    renderTree
  };
}
