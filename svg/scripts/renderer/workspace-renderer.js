export function createWorkspaceRenderer({ state, ui, model, actions, applyZoom, updateGridSurface }) {
  function drawResizeHandle(x, y, position, editorId, radius) {
    const handle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    handle.setAttribute("cx", String(x));
    handle.setAttribute("cy", String(y));
    handle.setAttribute("r", String(radius));
    handle.setAttribute("fill", "#fffaf0");
    handle.setAttribute("stroke", "#0f766e");
    handle.setAttribute("stroke-width", "2");
    handle.setAttribute("class", `overlay-handle overlay-handle--${position}`);
    handle.dataset.editorId = editorId;
    handle.dataset.handle = position;
    handle.addEventListener("pointerdown", (event) => actions.onResizeHandlePointerDown?.(event, editorId, position));
    ui.overlay.append(handle);
  }

  function drawSelectionRect(box, options = {}) {
    const {
      dasharray = null,
      fill = "none",
      opacity = "1",
      stroke = "#0f766e",
      strokeWidth = "2"
    } = options;
    const padding = Math.max(2, Math.min(box.width || 12, box.height || 12) * 0.03);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(box.x - padding));
    rect.setAttribute("y", String(box.y - padding));
    rect.setAttribute("width", String(box.width + padding * 2));
    rect.setAttribute("height", String(box.height + padding * 2));
    rect.setAttribute("rx", "8");
    rect.setAttribute("fill", fill);
    rect.setAttribute("fill-opacity", opacity);
    rect.setAttribute("stroke", stroke);
    rect.setAttribute("stroke-width", strokeWidth);
    rect.setAttribute("stroke-linejoin", "round");
    if (dasharray) {
      rect.setAttribute("stroke-dasharray", dasharray);
    }
    ui.overlay.append(rect);
  }

  function renderOverlay() {
    ui.overlay.innerHTML = "";
    const selectedNodes = [...state.selectedIds]
      .map((editorId) => state.nodeMap.get(editorId))
      .filter(Boolean);

    if (!selectedNodes.length && !state.selectionBox) {
      ui.statusPill.textContent = "No selection";
      return;
    }

    if (selectedNodes.length > 1) {
      ui.statusPill.textContent = `${selectedNodes.length} objects selected`;
    } else if (selectedNodes.length === 1) {
      const node = selectedNodes[0];
      ui.statusPill.textContent = `${node.tagName.toLowerCase()} ${model.labelFor(node)}`;
    } else if (state.selectionBox) {
      ui.statusPill.textContent = "Selecting objects";
    }

    selectedNodes.forEach((node) => {
      if (node === state.svgRoot) {
        return;
      }

      try {
        const box = node.getBBox();
        if (!box.width && !box.height) {
          return;
        }
        drawSelectionRect(box);
        if (selectedNodes.length === 1 && model.canResizeNode(node)) {
          const radius = Math.max(8, Math.min(14, Math.max(box.width, box.height, 32) * 0.03));
          model.getResizeHandles(node).forEach((handle) => {
            drawResizeHandle(handle.x, handle.y, handle.key, node.dataset.editorId, radius);
          });
        }
      } catch (error) {
        ui.statusPill.textContent = `${node.tagName.toLowerCase()} selected`;
      }
    });

    if (state.selectionBox && (state.selectionBox.width > 0 || state.selectionBox.height > 0)) {
      drawSelectionRect(state.selectionBox, {
        dasharray: "6 6",
        fill: "#0f766e",
        opacity: "0.08",
        strokeWidth: "1.5"
      });
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
