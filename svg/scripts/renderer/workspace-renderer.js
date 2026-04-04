export function createWorkspaceRenderer({ state, ui, model, actions, applyZoom, updateGridSurface }) {
  function renderOverlay() {
    ui.overlay.innerHTML = "";
    const node = state.nodeMap.get(state.selectedId);
    if (!node) {
      ui.statusPill.textContent = "No selection";
      return;
    }

    ui.statusPill.textContent = `${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
    if (node === state.svgRoot) {
      return;
    }

    try {
      const box = node.getBBox();
      if (!box.width || !box.height) {
        return;
      }
      const padding = Math.max(2, Math.min(box.width, box.height) * 0.03);
      const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      rect.setAttribute("x", String(box.x - padding));
      rect.setAttribute("y", String(box.y - padding));
      rect.setAttribute("width", String(box.width + padding * 2));
      rect.setAttribute("height", String(box.height + padding * 2));
      rect.setAttribute("rx", "8");
      rect.setAttribute("fill", "none");
      rect.setAttribute("stroke", "#0f766e");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("stroke-dasharray", "10 8");
      ui.overlay.append(rect);
    } catch (error) {
      ui.statusPill.textContent = `${node.tagName.toLowerCase()} selected`;
    }
  }

  function renderWorkspace() {
    ui.overlay.innerHTML = "";
    if (!state.svgRoot) {
      return;
    }

    state.svgRoot.classList.add("workspace-svg");
    const viewBox = model.getViewBoxRect();
    ui.svgHost.style.aspectRatio = `${viewBox.width} / ${viewBox.height}`;
    const currentSvg = ui.svgHost.querySelector(".workspace-svg");
    if (currentSvg && currentSvg !== state.svgRoot) {
      currentSvg.remove();
    }

    ui.svgHost.prepend(state.svgRoot);
    ui.svgHost.append(ui.overlay);
    ui.overlay.setAttribute("viewBox", model.viewBoxFor(state.svgRoot));
    ui.overlay.setAttribute("preserveAspectRatio", state.svgRoot.getAttribute("preserveAspectRatio") || "xMidYMid meet");
    state.svgRoot.removeEventListener("click", actions.onSvgClick);
    state.svgRoot.removeEventListener("pointerdown", actions.onSvgPointerDown);
    state.svgRoot.addEventListener("click", actions.onSvgClick);
    state.svgRoot.addEventListener("pointerdown", actions.onSvgPointerDown);
    updateGridSurface();
    applyZoom();
    renderOverlay();
  }

  return {
    renderOverlay,
    renderWorkspace
  };
}
