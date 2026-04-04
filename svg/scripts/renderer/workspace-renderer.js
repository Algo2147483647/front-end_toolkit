export function createWorkspaceRenderer({ state, ui, model, actions, applyZoom, updateGridSurface }) {
  const PPT_OVERLAY = {
    accent: "#4f81bd",
    control: "#7a7a7a",
    controlSoft: "#b5b5b5",
    fill: "#ffffff",
    guide: "#8a8a8a",
    marqueeFill: "#4f81bd",
    selection: "#6f6f73"
  };

  function getOverlayLengthForPixels(pixels) {
    const viewBox = model.getViewBoxRect?.();
    const hostWidth = ui.svgHost?.offsetWidth || ui.svgHost?.clientWidth || 0;
    const hostHeight = ui.svgHost?.offsetHeight || ui.svgHost?.clientHeight || 0;
    const zoom = Math.max(state.zoom || 1, 0.01);
    const screenUnitX = viewBox?.width && hostWidth ? (hostWidth / viewBox.width) * zoom : 0;
    const screenUnitY = viewBox?.height && hostHeight ? (hostHeight / viewBox.height) * zoom : 0;
    const screenUnits = [screenUnitX, screenUnitY].filter((value) => Number.isFinite(value) && value > 0);

    if (!screenUnits.length) {
      return pixels;
    }

    return pixels / Math.min(...screenUnits);
  }

  function getHandleMetrics(kind = "resize") {
    if (kind === "point") {
      return {
        radius: getOverlayLengthForPixels(4.5),
        strokeWidth: getOverlayLengthForPixels(1.25)
      };
    }

    if (kind === "bezier-control") {
      return {
        radius: getOverlayLengthForPixels(4),
        strokeWidth: getOverlayLengthForPixels(1.25)
      };
    }

    return {
      radius: getOverlayLengthForPixels(4.75),
      strokeWidth: getOverlayLengthForPixels(1.25)
    };
  }

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
      fill = PPT_OVERLAY.fill,
      stroke = PPT_OVERLAY.control,
      strokeWidth = getOverlayLengthForPixels(1.25)
    } = config;
    const element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    element.setAttribute("cx", String(x));
    element.setAttribute("cy", String(y));
    element.setAttribute("r", String(radius));
    element.setAttribute("fill", fill);
    element.setAttribute("stroke", stroke);
    element.setAttribute("stroke-width", strokeWidth);
    element.setAttribute("class", className);
    element.setAttribute("vector-effect", "non-scaling-stroke");
    if (cursor) {
      element.style.cursor = cursor;
    }
    element.dataset.editorId = editorId;
    element.dataset.handle = handle;
    element.addEventListener("pointerdown", (event) => onPointerDown?.(event, editorId, handle));
    ui.overlay.append(element);
  }

  function drawResizeHandle(x, y, position, editorId, radius, cursor) {
    const metrics = getHandleMetrics("resize");
    drawOverlayHandle({
      className: `overlay-handle overlay-handle--resize overlay-handle--${position}`,
      cursor,
      editorId,
      handle: position,
      onPointerDown: actions.onResizeHandlePointerDown,
      radius: radius || metrics.radius,
      strokeWidth: metrics.strokeWidth,
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
    line.setAttribute("stroke", PPT_OVERLAY.guide);
    line.setAttribute("stroke-width", String(getOverlayLengthForPixels(1)));
    line.setAttribute("stroke-dasharray", `${getOverlayLengthForPixels(3)} ${getOverlayLengthForPixels(3)}`);
    line.setAttribute("vector-effect", "non-scaling-stroke");
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
      const isControl = handleConfig.kind === "control";
      const metrics = getHandleMetrics(isControl ? "bezier-control" : "resize");
      drawOverlayHandle({
        className: `overlay-handle overlay-handle--bezier overlay-handle--bezier-${handleConfig.kind}`,
        cursor: "move",
        editorId: node.dataset.editorId,
        fill: PPT_OVERLAY.fill,
        handle: handleConfig.key,
        onPointerDown: actions.onPathBezierHandlePointerDown,
        radius: isControl ? metrics.radius : (radius || metrics.radius),
        stroke: isControl ? PPT_OVERLAY.controlSoft : PPT_OVERLAY.control,
        strokeWidth: metrics.strokeWidth,
        x: handleConfig.x,
        y: handleConfig.y
      });
    });
  }

  function drawPointHandles(node, radius) {
    const metrics = getHandleMetrics("point");
    model.getPointHandles(node).forEach((handleConfig) => {
      drawOverlayHandle({
        className: "overlay-handle overlay-handle--point",
        cursor: handleConfig.cursor,
        editorId: node.dataset.editorId,
        fill: PPT_OVERLAY.fill,
        handle: handleConfig.key,
        onPointerDown: actions.onPointHandlePointerDown,
        radius: radius || metrics.radius,
        stroke: PPT_OVERLAY.control,
        strokeWidth: metrics.strokeWidth,
        x: handleConfig.x,
        y: handleConfig.y
      });
    });
  }

  function drawSelectionRect(box, options = {}) {
    const {
      className = "overlay-selection",
      dasharray = null,
      fill = "none",
      opacity = "1",
      stroke = PPT_OVERLAY.selection,
      strokeWidth = getOverlayLengthForPixels(1.25)
    } = options;
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", String(box.x));
    rect.setAttribute("y", String(box.y));
    rect.setAttribute("width", String(box.width));
    rect.setAttribute("height", String(box.height));
    rect.setAttribute("class", className);
    rect.setAttribute("fill", fill);
    rect.setAttribute("fill-opacity", opacity);
    rect.setAttribute("stroke", stroke);
    rect.setAttribute("stroke-width", strokeWidth);
    rect.setAttribute("vector-effect", "non-scaling-stroke");
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
        const box = model.getNodeVisualBounds(node);
        if (!box || (!box.width && !box.height)) {
          return;
        }
        drawSelectionRect(box);
        if (selectedNodes.length === 1 && model.canResizeNode(node)) {
          const resizeMetrics = getHandleMetrics("resize");
          const pointMetrics = getHandleMetrics("point");
          if (["polyline", "polygon"].includes(node.tagName.toLowerCase())) {
            drawPointHandles(node, pointMetrics.radius);
          }
          if (node.tagName.toLowerCase() === "path" && model.getPathBezier(node)) {
            drawBezierHandles(node, resizeMetrics.radius);
          }
          model.getResizeHandles(node).forEach((handle) => {
            drawResizeHandle(handle.x, handle.y, handle.key, node.dataset.editorId, resizeMetrics.radius, handle.cursor);
          });
        }
      } catch (error) {
        ui.statusPill.textContent = `${node.tagName.toLowerCase()} selected`;
      }
    });

    if (state.selectionBox && (state.selectionBox.width > 0 || state.selectionBox.height > 0)) {
      drawSelectionRect(state.selectionBox, {
        className: "overlay-selection overlay-selection--marquee",
        dasharray: `${getOverlayLengthForPixels(4)} ${getOverlayLengthForPixels(3)}`,
        fill: PPT_OVERLAY.marqueeFill,
        opacity: "0.08",
        stroke: PPT_OVERLAY.accent,
        strokeWidth: getOverlayLengthForPixels(1)
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
