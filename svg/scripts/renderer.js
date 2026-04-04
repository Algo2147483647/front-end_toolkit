import { GRID_SNAP_SIZE_OPTIONS } from "./constants.js";
import { createInspectorRenderer } from "./renderer/inspector-renderer.js";
import { createTreeRenderer } from "./renderer/tree-renderer.js";
import { createWorkspaceRenderer } from "./renderer/workspace-renderer.js";

export function createRenderer({ state, ui, model, actions }) {
  function updateSource() {
    ui.sourceEditor.value = model.serialize();
  }

  function ensureGridSizeOptions() {
    if (ui.gridSnapSizeSelect.options.length > 1) {
      return;
    }

    GRID_SNAP_SIZE_OPTIONS.forEach((size) => {
      const option = document.createElement("option");
      option.value = String(size);
      option.textContent = `${size}px`;
      ui.gridSnapSizeSelect.append(option);
    });
  }

  function updateGridSurface() {
    if (!ui.surfaceGrid) {
      return;
    }

    ui.surfaceGrid.style.removeProperty("--grid-step-x");
    ui.surfaceGrid.style.removeProperty("--grid-step-y");
    ui.surfaceGrid.style.removeProperty("--grid-offset-x");
    ui.surfaceGrid.style.removeProperty("--grid-offset-y");

    if (!state.gridSnapEnabled || !state.svgRoot) {
      return;
    }

    const viewBox = model.getViewBoxRect();
    const surfaceWidth = ui.surfaceGrid.clientWidth || ui.surfaceInner?.clientWidth || 0;
    const surfaceHeight = ui.surfaceGrid.clientHeight || ui.surfaceInner?.clientHeight || 0;
    const hostWidth = ui.svgHost.offsetWidth || 0;
    const hostHeight = ui.svgHost.offsetHeight || 0;
    const gridSize = state.gridSnapSize || GRID_SNAP_SIZE_OPTIONS[0] || 1;

    if (!viewBox.width || !viewBox.height || !surfaceWidth || !surfaceHeight || !hostWidth || !hostHeight || !gridSize) {
      return;
    }

    const screenUnitX = (hostWidth / viewBox.width) * state.zoom;
    const screenUnitY = (hostHeight / viewBox.height) * state.zoom;
    const stepX = gridSize * screenUnitX;
    const stepY = gridSize * screenUnitY;
    if (!stepX || !stepY) {
      return;
    }

    const renderedLeft = ((surfaceWidth - hostWidth) / 2) + state.panX + ((1 - state.zoom) * hostWidth / 2);
    const renderedTop = ((surfaceHeight - hostHeight) / 2) + state.panY + ((1 - state.zoom) * hostHeight / 2);
    const docOffsetX = ((-viewBox.x % gridSize) + gridSize) % gridSize;
    const docOffsetY = ((-viewBox.y % gridSize) + gridSize) % gridSize;
    const offsetX = renderedLeft + (docOffsetX * screenUnitX);
    const offsetY = renderedTop + (docOffsetY * screenUnitY);

    ui.surfaceGrid.style.setProperty("--grid-step-x", `${stepX}px`);
    ui.surfaceGrid.style.setProperty("--grid-step-y", `${stepY}px`);
    ui.surfaceGrid.style.setProperty("--grid-offset-x", `${offsetX}px`);
    ui.surfaceGrid.style.setProperty("--grid-offset-y", `${offsetY}px`);
  }

  function syncChrome() {
    ensureGridSizeOptions();
    ui.appShell.classList.toggle("is-topbar-collapsed", state.topbarCollapsed);
    ui.appShell.classList.toggle("is-left-hidden", state.leftPanelHidden);
    ui.appShell.classList.toggle("is-right-hidden", state.rightPanelHidden);
    ui.workspaceSurface.classList.toggle("is-grid-snap", state.gridSnapEnabled);
    ui.workspaceSurface.style.setProperty("--grid-size", `${state.gridSnapSize}px`);

    ui.showTopbarButton.classList.toggle("hidden", !state.topbarCollapsed);
    ui.collapseTopbarButton.querySelector(".tool-label").textContent = state.topbarCollapsed ? "Show" : "Hide";
    ui.collapseTopbarButton.querySelector(".tool-icon").textContent = state.topbarCollapsed ? "+" : "-";
    ui.collapseTopbarButton.title = state.topbarCollapsed ? "Show toolbar" : "Hide toolbar";
    ui.gridSnapButton.classList.toggle("is-active", state.gridSnapEnabled);
    ui.gridSnapButton.setAttribute("aria-pressed", String(state.gridSnapEnabled));
    ui.gridSnapButton.title = state.gridSnapEnabled ? "Disable grid snap" : "Enable grid snap";

    ui.gridSnapSizeInput.value = String(state.gridSnapSize);
    ui.gridSnapSizeSelect.value = "";
    ui.gridSnapSizeGroup.title = `Grid size: ${state.gridSnapSize}px`;

    const isInsertView = state.leftPanelView !== "layers";
    ui.leftPanelInsertTab.classList.toggle("is-active", isInsertView);
    ui.leftPanelInsertTab.setAttribute("aria-selected", String(isInsertView));
    ui.leftPanelLayersTab.classList.toggle("is-active", !isInsertView);
    ui.leftPanelLayersTab.setAttribute("aria-selected", String(!isInsertView));
    ui.leftPanelInsertSection.classList.toggle("hidden", !isInsertView);
    ui.leftPanelLayersSection.classList.toggle("hidden", isInsertView);

    ui.floatingLeftButton.textContent = state.leftPanelHidden ? "Show Left" : "Hide Left";
    ui.floatingLeftButton.classList.toggle("is-active", !state.leftPanelHidden);
    ui.hideLeftPanelButton.textContent = state.leftPanelHidden ? "+" : "X";

    ui.floatingRightButton.textContent = state.rightPanelHidden ? "Show Right" : "Hide Right";
    ui.floatingRightButton.classList.toggle("is-active", !state.rightPanelHidden);
    ui.hideRightPanelButton.textContent = state.rightPanelHidden ? "+" : "X";
    updateGridSurface();
  }

  function applyZoom() {
    ui.svgHost.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    ui.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    updateGridSurface();
  }

  function getFitZoom() {
    if (!state.svgRoot) {
      return 1;
    }

    const container = ui.svgHost.parentElement;
    const containerWidth = container?.clientWidth || 0;
    const containerHeight = container?.clientHeight || 0;
    const hostWidth = ui.svgHost.offsetWidth || ui.svgHost.clientWidth || 0;
    const hostHeight = ui.svgHost.offsetHeight || ui.svgHost.clientHeight || 0;

    if (containerWidth > 0 && containerHeight > 0 && hostWidth > 0 && hostHeight > 0) {
      return Math.min(containerWidth / hostWidth, containerHeight / hostHeight);
    }

    const viewBox = model.getViewBoxRect();
    if (!containerWidth || !containerHeight || !viewBox.width || !viewBox.height) {
      return 1;
    }

    return Math.min(containerWidth / viewBox.width, containerHeight / viewBox.height);
  }

  function updateActions() {
    const selectedNodes = [...state.selectedIds]
      .map((editorId) => state.nodeMap.get(editorId))
      .filter(Boolean);
    const canChange = selectedNodes.length > 0
      && selectedNodes.every((node) => node !== state.svgRoot && !model.isNodeLocked(node));
    ui.undoButton.disabled = state.historyIndex <= 0;
    ui.redoButton.disabled = state.historyIndex >= state.history.length - 1 || state.historyIndex < 0;
    ui.duplicateButton.disabled = !canChange;
    ui.deleteButton.disabled = !canChange;
  }

  const { renderInspector } = createInspectorRenderer({ state, ui, model, actions });
  const { renderTree } = createTreeRenderer({ state, ui, model, actions });
  const { renderOverlay, renderWorkspace } = createWorkspaceRenderer({
    state,
    ui,
    model,
    actions,
    applyZoom,
    updateGridSurface
  });

  return {
    applyZoom,
    getFitZoom,
    renderInspector,
    renderOverlay,
    renderTree,
    renderWorkspace,
    syncChrome,
    updateActions,
    updateSource
  };
}
