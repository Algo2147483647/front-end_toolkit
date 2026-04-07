import { GRID_SNAP_DEFAULT_SIZE, GRID_SNAP_SIZE_OPTIONS } from "./constants";
import { createReactInspectorRenderer } from "../react/renderers/inspector-renderer";
import { createReactTreeRenderer } from "../react/renderers/tree-renderer";
import { createReactWorkspaceRenderer } from "../react/renderers/workspace-renderer";
import type { SvgStudioUiRefs } from "../react/types";

interface RendererDeps {
  store: any;
  state: any;
  ui: SvgStudioUiRefs;
  model: any;
  actions: Record<string, (...args: unknown[]) => unknown>;
}

export function createRenderer({ store, state, ui, model, actions }: RendererDeps) {
  const runtime = store?.getState?.() || state;

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

    if (!runtime.gridSnapEnabled || !runtime.svgRoot) {
      return;
    }

    const viewBox = model.getViewBoxRect();
    const surfaceWidth = ui.surfaceGrid.clientWidth || ui.surfaceInner?.clientWidth || 0;
    const surfaceHeight = ui.surfaceGrid.clientHeight || ui.surfaceInner?.clientHeight || 0;
    const hostWidth = ui.svgHost.offsetWidth || 0;
    const hostHeight = ui.svgHost.offsetHeight || 0;
    const gridSize = runtime.gridSnapSize || GRID_SNAP_DEFAULT_SIZE || GRID_SNAP_SIZE_OPTIONS[0] || 1;

    if (!viewBox.width || !viewBox.height || !surfaceWidth || !surfaceHeight || !hostWidth || !hostHeight || !gridSize) {
      return;
    }

    const screenUnitX = (hostWidth / viewBox.width) * runtime.zoom;
    const screenUnitY = (hostHeight / viewBox.height) * runtime.zoom;
    const stepX = gridSize * screenUnitX;
    const stepY = gridSize * screenUnitY;
    if (!stepX || !stepY) {
      return;
    }

    const renderedLeft = ((surfaceWidth - hostWidth) / 2) + runtime.panX + ((1 - runtime.zoom) * hostWidth / 2);
    const renderedTop = ((surfaceHeight - hostHeight) / 2) + runtime.panY + ((1 - runtime.zoom) * hostHeight / 2);
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
    ui.appShell.classList.toggle("is-topbar-collapsed", runtime.topbarCollapsed);
    ui.appShell.classList.toggle("is-left-hidden", runtime.leftPanelHidden);
    ui.appShell.classList.toggle("is-right-hidden", runtime.rightPanelHidden);
    ui.workspaceSurface.style.setProperty("--grid-size", `${runtime.gridSnapSize}px`);
    ui.surfaceGrid.classList.toggle("hidden", !runtime.gridSnapEnabled);

    ui.showTopbarButton.classList.toggle("hidden", !runtime.topbarCollapsed);
    ui.collapseTopbarButton.querySelector(".tool-label")!.textContent = runtime.topbarCollapsed ? "Show" : "Hide";
    ui.collapseTopbarButton.querySelector(".tool-icon")!.textContent = runtime.topbarCollapsed ? "+" : "-";
    ui.collapseTopbarButton.title = runtime.topbarCollapsed ? "Show toolbar" : "Hide toolbar";
    ui.gridSnapButton.classList.toggle("is-active", runtime.gridSnapEnabled);
    ui.gridSnapButton.setAttribute("aria-pressed", String(runtime.gridSnapEnabled));
    ui.gridSnapButton.title = runtime.gridSnapEnabled ? "Disable grid snap" : "Enable grid snap";

    const canOverwriteSave = Boolean(
      runtime.currentFileHandle && typeof runtime.currentFileHandle.createWritable === "function"
    );
    ui.saveButton.disabled = !canOverwriteSave;
    ui.saveButton.title = canOverwriteSave
      ? `Save and overwrite ${runtime.currentFileName || "current SVG"}`
      : runtime.currentFileName
        ? `Overwrite save unavailable for ${runtime.currentFileName}. Re-import with file access.`
        : "Import an SVG file with file access to enable overwrite save.";

    ui.gridSnapSizeInput.value = String(runtime.gridSnapSize);
    ui.gridSnapSizeSelect.value = "";
    ui.gridSnapSizeGroup.title = `Grid size: ${runtime.gridSnapSize}px`;

    const isInsertView = runtime.leftPanelView !== "layers";
    ui.leftPanelInsertTab.classList.toggle("is-active", isInsertView);
    ui.leftPanelInsertTab.setAttribute("aria-selected", String(isInsertView));
    ui.leftPanelLayersTab.classList.toggle("is-active", !isInsertView);
    ui.leftPanelLayersTab.setAttribute("aria-selected", String(!isInsertView));
    ui.leftPanelInsertSection.classList.toggle("hidden", !isInsertView);
    ui.leftPanelLayersSection.classList.toggle("hidden", isInsertView);

    ui.floatingLeftButton.textContent = runtime.leftPanelHidden ? "Show Left" : "Hide Left";
    ui.floatingLeftButton.classList.toggle("is-active", !runtime.leftPanelHidden);
    ui.hideLeftPanelButton.textContent = runtime.leftPanelHidden ? "+" : "x";

    ui.floatingRightButton.textContent = runtime.rightPanelHidden ? "Show Right" : "Hide Right";
    ui.floatingRightButton.classList.toggle("is-active", !runtime.rightPanelHidden);
    ui.hideRightPanelButton.textContent = runtime.rightPanelHidden ? "+" : "x";
    updateGridSurface();
  }

  function applyZoom() {
    ui.svgHost.style.transform = `translate(${runtime.panX}px, ${runtime.panY}px) scale(${runtime.zoom})`;
    ui.zoomLabel.textContent = `${Math.round(runtime.zoom * 100)}%`;
    updateGridSurface();
  }

  function getFitZoom() {
    if (!runtime.svgRoot) {
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
    const selectedNodes = [...runtime.selectedIds]
      .map((editorId) => runtime.nodeMap.get(editorId))
      .filter(Boolean);
    const canChange = selectedNodes.length > 0
      && selectedNodes.every((node) => node !== runtime.svgRoot && !model.isNodeLocked(node));
    ui.undoButton.disabled = runtime.historyIndex <= 0;
    ui.redoButton.disabled = runtime.historyIndex >= runtime.history.length - 1 || runtime.historyIndex < 0;
    ui.duplicateButton.disabled = !canChange;
    ui.deleteButton.disabled = !canChange;
  }

  const inspectorRenderer = createReactInspectorRenderer({ store, state: runtime, ui, model, actions });
  const { renderInspector } = inspectorRenderer;
  const treeRenderer = createReactTreeRenderer({ store, state: runtime, ui, model, actions });
  const { renderTree } = treeRenderer;
  const workspaceRenderer = createReactWorkspaceRenderer({
    store,
    state: runtime,
    ui,
    model,
    actions,
    applyZoom,
    updateGridSurface
  });
  const { renderOverlay, renderWorkspace } = workspaceRenderer;

  function refresh(options: {
    workspace?: boolean;
    tree?: boolean;
    inspector?: boolean;
    source?: boolean;
    actions?: boolean;
    overlay?: boolean;
  } = {}) {
    const {
      workspace = false,
      tree = false,
      inspector = false,
      source = false,
      actions: refreshActions = false,
      overlay = false
    } = options;

    if (workspace || tree || inspector || overlay) {
      store.invalidate();
    }

    if (source) {
      updateSource();
    }

    if (refreshActions) {
      updateActions();
    }
  }

  return {
    applyZoom,
    dispose() {
      workspaceRenderer.dispose?.();
      treeRenderer.dispose?.();
      inspectorRenderer.dispose?.();
    },
    getFitZoom,
    refresh,
    renderInspector,
    renderOverlay,
    renderTree,
    renderWorkspace,
    syncChrome,
    updateActions,
    updateSource
  };
}
