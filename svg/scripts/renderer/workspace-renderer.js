export function createWorkspaceRenderer({ state, ui, model, actions, applyZoom, updateGridSurface }) {
  function drawOverlayHandle(config) {
    const {
      x,
      y,
      radius,
      className,
      cursor,
      editorId,
      handle,
      onPointerDown,
      fill = "#fffaf0",
      stroke = "#0f766e",
      strokeWidth = "2"
    } = config;
    const element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    element.setAttribute("cx", String(x));
    element.setAttribute("cy", String(y));
    element.setAttribute("r", String(radius));
    element.setAttribute("fill", fill);
    element.setAttribute("stroke", stroke);
    element.setAttribute("stroke-width", strokeWidth);
    element.setAttribute("class", className);
    if (cursor) {
      element.style.cursor = cursor;
    }
    element.dataset.editorId = editorId;
    element.dataset.handle = handle;
    element.addEventListener("pointerdown", (event) => onPointerDown?.(event, editorId, handle));
    ui.overlay.append(element);
  }

  function drawResizeHandle(x, y, position, editorId, radius, cursor) {
    drawOverlayHandle({
      className: `overlay-handle overlay-handle--${position}`,
      cursor,
      editorId,
      handle: position,
      onPointerDown: actions.onResizeHandlePointerDown,
      radius,
      x,
      y
    });
  }

  function drawBezierGuideLine(x1, y1, x2, y2) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("class", "overlay-guide overlay-guide--bezier");
    ui.overlay.append(line);
  }

  function drawBezierHandles(node, radius) {
    const handles = model.getPathBezierHandles(node);
    if (handles.length !== 4) {
      return;
    }

    drawBezierGuideLine(handles[0].x, handles[0].y, handles[1].x, handles[1].y);
    drawBezierGuideLine(handles[2].x, handles[2].y, handles[3].x, handles[3].y);

    handles.forEach((handleConfig) => {
      drawOverlayHandle({
        className: `overlay-handle overlay-handle--bezier overlay-handle--bezier-${handleConfig.kind}`,
        cursor: "move",
        editorId: node.dataset.editorId,
        fill: handleConfig.kind === "control" ? "#fff" : "#fffaf0",
        handle: handleConfig.key,
        onPointerDown: actions.onPathBezierHandlePointerDown,
        radius: handleConfig.kind === "control" ? Math.max(6, radius - 2) : radius,
        stroke: handleConfig.kind === "control" ? "#b5461d" : "#0f766e",
        strokeWidth: handleConfig.kind === "control" ? "2.5" : "2",
        x: handleConfig.x,
        y: handleConfig.y
      });
    });
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
          if (node.tagName.toLowerCase() === "path" && model.getPathBezier(node)) {
            drawBezierHandles(node, radius);
          }
          model.getResizeHandles(node).forEach((handle) => {
            drawResizeHandle(handle.x, handle.y, handle.key, node.dataset.editorId, radius, handle.cursor);
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
