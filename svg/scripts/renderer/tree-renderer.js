export function createTreeRenderer({ state, ui, model, actions }) {
  function renderTree() {
    ui.treePanel.innerHTML = "";
    if (!state.svgRoot) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const walk = (node, depth) => {
      if (node.tagName.toLowerCase() === "style") {
        return;
      }

      const children = model.getRenderableChildren(node);
      const hasChildren = children.length > 0;
      const collapsed = state.collapsedNodeKeys.has(model.getNodeKey(node));
      const locked = model.isNodeLocked(node);
      const hidden = model.isNodeHidden(node);
      const row = document.createElement("div");
      const main = document.createElement("div");
      const expander = document.createElement("button");
      const selectButton = document.createElement("button");
      const dot = document.createElement("span");
      const tag = document.createElement("span");
      const label = document.createElement("span");

      row.className = "tree-item";
      if (node.dataset.editorId === state.selectedId) row.classList.add("is-selected");
      if (locked) row.classList.add("is-locked");
      if (hidden) row.classList.add("is-hidden");
      row.style.setProperty("--depth", depth);

      main.className = "tree-main";
      expander.type = "button";
      expander.className = "tree-expander";
      expander.textContent = hasChildren ? (collapsed ? "+" : "-") : ".";
      if (!hasChildren) {
        expander.classList.add("is-placeholder");
        expander.disabled = true;
      } else {
        expander.addEventListener("click", (event) => {
          event.stopPropagation();
          actions.toggleNodeCollapse(node.dataset.editorId);
        });
      }

      selectButton.type = "button";
      selectButton.className = "tree-select";
      dot.className = "tree-dot";
      tag.className = "tree-tag";
      label.className = "tree-label";
      tag.textContent = node.tagName.toLowerCase();
      label.textContent = model.labelFor(node);
      selectButton.append(dot, tag, label);
      selectButton.addEventListener("click", () => actions.selectNode(node.dataset.editorId));
      main.append(expander, selectButton);

      const actionsRow = document.createElement("div");
      const visibilityButton = document.createElement("button");
      const lockButton = document.createElement("button");
      actionsRow.className = "tree-actions";
      visibilityButton.type = "button";
      visibilityButton.className = `tree-action${!hidden ? " is-active" : ""}`;
      visibilityButton.textContent = hidden ? "Show" : "Hide";
      visibilityButton.title = hidden ? "Show layer" : "Hide layer";
      visibilityButton.disabled = node === state.svgRoot;
      visibilityButton.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.toggleNodeVisibility(node.dataset.editorId);
      });
      lockButton.type = "button";
      lockButton.className = `tree-action${locked ? " is-active" : ""}`;
      lockButton.textContent = locked ? "Unlock" : "Lock";
      lockButton.title = locked ? "Unlock layer" : "Lock layer";
      lockButton.disabled = node === state.svgRoot;
      lockButton.addEventListener("click", (event) => {
        event.stopPropagation();
        actions.toggleNodeLock(node.dataset.editorId);
      });
      actionsRow.append(visibilityButton, lockButton);

      row.append(main, actionsRow);
      fragment.append(row);
      if (!collapsed) {
        children.forEach((child) => walk(child, depth + 1));
      }
    };

    walk(state.svgRoot, 0);
    ui.treePanel.append(fragment);
    ui.nodeCountBadge.textContent = `${state.svgRoot.querySelectorAll("*").length + 1} nodes`;
  }

  return {
    renderTree
  };
}
