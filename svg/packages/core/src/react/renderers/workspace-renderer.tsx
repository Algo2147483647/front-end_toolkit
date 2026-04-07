import { createElement, useLayoutEffect, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { CSSProperties, ReactNode } from "react";
import type { SerializedSvgChild, SerializedSvgElementNode } from "../../runtime/model/types";
import { useRuntimeVersion } from "./use-runtime-version";

const PPT_OVERLAY = {
  accent: "#4f81bd",
  control: "#7a7a7a",
  controlSoft: "#b5b5b5",
  fill: "#ffffff",
  guide: "#8a8a8a",
  marqueeFill: "#4f81bd",
  selection: "#6f6f73"
};

interface WorkspaceDeps {
  store: any;
  state: any;
  ui: any;
  model: any;
  actions: any;
  applyZoom: () => void;
  updateGridSurface: () => void;
}

function getOverlayLengthForPixels(model: any, state: any, ui: any, pixels: number) {
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

function OverlayHandle({ className, cursor, editorId, fill = PPT_OVERLAY.fill, handle, onPointerDown, radius, stroke, strokeWidth, x, y }: any) {
  return (
    <circle
      cx={x}
      cy={y}
      r={radius}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
      className={className}
      vectorEffect="non-scaling-stroke"
      style={cursor ? { cursor } : undefined}
      data-editor-id={editorId}
      data-handle={handle}
      onPointerDown={(event) => onPointerDown?.(event.nativeEvent, editorId, handle)}
    />
  );
}

function toCamelCaseAttribute(attributeName: string) {
  return attributeName.replace(/[:-]([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function toReactPropName(attributeName: string) {
  if (attributeName === "class") {
    return "className";
  }

  if (attributeName === "for") {
    return "htmlFor";
  }

  if (attributeName.startsWith("data-") || attributeName.startsWith("aria-")) {
    return attributeName;
  }

  return toCamelCaseAttribute(attributeName);
}

function parseInlineStyle(styleText: string): CSSProperties {
  return styleText
    .split(";")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((styles, segment) => {
      const separatorIndex = segment.indexOf(":");
      if (separatorIndex < 0) {
        return styles;
      }

      const name = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      if (!name || !value) {
        return styles;
      }

      const propName = toCamelCaseAttribute(name);
      styles[propName as keyof CSSProperties] = value as never;
      return styles;
    }, {} as CSSProperties);
}

function buildReactProps(node: SerializedSvgElementNode) {
  const props: Record<string, unknown> = {};

  Object.entries(node.attributes).forEach(([attributeName, attributeValue]) => {
    if (attributeName === "style") {
      props.style = parseInlineStyle(attributeValue);
      return;
    }

    props[toReactPropName(attributeName)] = attributeValue;
  });

  return props;
}

function renderSnapshotChild(node: SerializedSvgChild, rootRef: ((node: SVGSVGElement | null) => void) | null, path = "0"): ReactNode {
  if (node.kind === "text") {
    return node.value;
  }

  const props = buildReactProps(node);
  props.key = node.attributes["data-editor-id"] || `${node.tagName}-${path}`;
  if (rootRef && node.tagName.toLowerCase() === "svg") {
    props.ref = rootRef;
  }

  return createElement(
    node.tagName,
    props,
    node.children.map((child, index) => renderSnapshotChild(child, null, `${path}.${index}`))
  );
}

function WorkspaceRoot({ actions, applyZoom, model, state, store, ui, updateGridSurface }: WorkspaceDeps) {
  const mountedSvgRef = useRef<SVGSVGElement | null>(null);
  const boundRevisionRef = useRef(-1);
  const selectedNodes = [...state.selectedIds]
    .map((editorId) => state.nodeMap.get(editorId))
    .filter(Boolean);
  const viewBox = state.svgRoot ? model.viewBoxFor(state.svgRoot) : undefined;
  const preserveAspectRatio = state.svgRoot?.getAttribute("preserveAspectRatio") || "xMidYMid meet";

  useLayoutEffect(() => {
    if (!state.documentSnapshot) {
      if (state.svgRoot) {
        store.document.bindMountedSvgRoot(null);
        model.rebuildNodeMap();
      }
      return;
    }

    const mountedRoot = mountedSvgRef.current;
    if (!mountedRoot) {
      return;
    }

    mountedRoot.classList.add("workspace-svg");
    const rootChanged = state.svgRoot !== mountedRoot;
    store.document.bindMountedSvgRoot(mountedRoot);
    if (rootChanged || boundRevisionRef.current !== state.documentRevision) {
      model.rebuildNodeMap();
      model.syncEditorMetadata();
      boundRevisionRef.current = state.documentRevision;
      store.invalidate();
    }

    updateGridSurface();
    applyZoom();
  }, [applyZoom, model, state.documentRevision, state.documentSnapshot, state.svgRoot, store, updateGridSurface]);

  useLayoutEffect(() => {
    ui.svgHost.style.aspectRatio = state.svgRoot
      ? `${model.getViewBoxRect().width} / ${model.getViewBoxRect().height}`
      : "";
  }, [model, state.documentRevision, state.svgRoot, ui.svgHost]);

  const overlayElements = useMemo(() => {
    if (!state.svgRoot) {
      return null;
    }

    const elements: React.ReactNode[] = [];
    const resizeMetrics = {
      radius: getOverlayLengthForPixels(model, state, ui, 4.75),
      strokeWidth: getOverlayLengthForPixels(model, state, ui, 1.25)
    };
    const pointMetrics = {
      radius: getOverlayLengthForPixels(model, state, ui, 4.5),
      strokeWidth: getOverlayLengthForPixels(model, state, ui, 1.25)
    };
    const bezierMetrics = {
      radius: getOverlayLengthForPixels(model, state, ui, 4),
      strokeWidth: getOverlayLengthForPixels(model, state, ui, 1.25)
    };

    selectedNodes.forEach((node) => {
      if (node === state.svgRoot) {
        return;
      }

      const box = model.getNodeVisualBounds(node);
      if (!box || (!box.width && !box.height)) {
        return;
      }

      elements.push(
        <rect
          key={`selection-${node.dataset.editorId}`}
          x={box.x}
          y={box.y}
          width={box.width}
          height={box.height}
          className="overlay-selection"
          fill="none"
          stroke={PPT_OVERLAY.selection}
          strokeWidth={getOverlayLengthForPixels(model, state, ui, 1.25)}
          vectorEffect="non-scaling-stroke"
        />
      );

      if (selectedNodes.length !== 1 || !model.canResizeNode(node)) {
        return;
      }

      if (["polyline", "polygon"].includes(node.tagName.toLowerCase())) {
        model.getPointHandles(node).forEach((handleConfig: any) => {
          elements.push(
            <OverlayHandle
              key={`point-${node.dataset.editorId}-${handleConfig.key}`}
              className="overlay-handle overlay-handle--point"
              cursor={handleConfig.cursor}
              editorId={node.dataset.editorId}
              handle={handleConfig.key}
              onPointerDown={actions.onPointHandlePointerDown}
              radius={pointMetrics.radius}
              stroke={PPT_OVERLAY.control}
              strokeWidth={pointMetrics.strokeWidth}
              x={handleConfig.x}
              y={handleConfig.y}
            />
          );
        });
      }

      if (node.tagName.toLowerCase() === "path" && model.getPathBezier(node)) {
        const handles = model.getPathBezierHandles(node);
        if (handles.length === 4) {
          elements.push(
            <line
              key={`guide-a-${node.dataset.editorId}`}
              x1={handles[0].x}
              y1={handles[0].y}
              x2={handles[1].x}
              y2={handles[1].y}
              className="overlay-guide overlay-guide--bezier"
              stroke={PPT_OVERLAY.guide}
              strokeWidth={getOverlayLengthForPixels(model, state, ui, 1)}
              strokeDasharray={`${getOverlayLengthForPixels(model, state, ui, 3)} ${getOverlayLengthForPixels(model, state, ui, 3)}`}
              vectorEffect="non-scaling-stroke"
            />
          );
          elements.push(
            <line
              key={`guide-b-${node.dataset.editorId}`}
              x1={handles[2].x}
              y1={handles[2].y}
              x2={handles[3].x}
              y2={handles[3].y}
              className="overlay-guide overlay-guide--bezier"
              stroke={PPT_OVERLAY.guide}
              strokeWidth={getOverlayLengthForPixels(model, state, ui, 1)}
              strokeDasharray={`${getOverlayLengthForPixels(model, state, ui, 3)} ${getOverlayLengthForPixels(model, state, ui, 3)}`}
              vectorEffect="non-scaling-stroke"
            />
          );

          handles.forEach((handleConfig: any) => {
            const isControl = handleConfig.kind === "control";
            elements.push(
              <OverlayHandle
                key={`bezier-${node.dataset.editorId}-${handleConfig.key}`}
                className={`overlay-handle overlay-handle--bezier overlay-handle--bezier-${handleConfig.kind}`}
                cursor="move"
                editorId={node.dataset.editorId}
                handle={handleConfig.key}
                onPointerDown={actions.onPathBezierHandlePointerDown}
                radius={isControl ? bezierMetrics.radius : resizeMetrics.radius}
                stroke={isControl ? PPT_OVERLAY.controlSoft : PPT_OVERLAY.control}
                strokeWidth={isControl ? bezierMetrics.strokeWidth : resizeMetrics.strokeWidth}
                x={handleConfig.x}
                y={handleConfig.y}
              />
            );
          });
        }
      }

      model.getResizeHandles(node).forEach((handle: any) => {
        elements.push(
          <OverlayHandle
            key={`resize-${node.dataset.editorId}-${handle.key}`}
            className={`overlay-handle overlay-handle--resize overlay-handle--${handle.key}`}
            cursor={handle.cursor}
            editorId={node.dataset.editorId}
            handle={handle.key}
            onPointerDown={actions.onResizeHandlePointerDown}
            radius={resizeMetrics.radius}
            stroke={PPT_OVERLAY.control}
            strokeWidth={resizeMetrics.strokeWidth}
            x={handle.x}
            y={handle.y}
          />
        );
      });
    });

    if (state.selectionBox && (state.selectionBox.width > 0 || state.selectionBox.height > 0)) {
      elements.push(
        <rect
          key="selection-marquee"
          x={state.selectionBox.x}
          y={state.selectionBox.y}
          width={state.selectionBox.width}
          height={state.selectionBox.height}
          className="overlay-selection overlay-selection--marquee"
          fill={PPT_OVERLAY.marqueeFill}
          fillOpacity="0.08"
          stroke={PPT_OVERLAY.accent}
          strokeWidth={getOverlayLengthForPixels(model, state, ui, 1)}
          strokeDasharray={`${getOverlayLengthForPixels(model, state, ui, 4)} ${getOverlayLengthForPixels(model, state, ui, 3)}`}
          vectorEffect="non-scaling-stroke"
        />
      );
    }

    return elements;
  }, [actions, model, selectedNodes, state, ui]);

  return (
    <>
      <div
        className="workspace-svg-slot"
        onClick={(event) => actions.onSvgClick?.(event.nativeEvent)}
        onPointerDown={(event) => actions.onSvgPointerDown?.(event.nativeEvent)}
      >
        {state.documentSnapshot
          ? renderSnapshotChild(state.documentSnapshot, (node) => {
            mountedSvgRef.current = node;
          })
          : null}
      </div>
      {state.svgRoot ? (
        <svg
          className="selection-overlay"
          viewBox={viewBox}
          preserveAspectRatio={preserveAspectRatio}
          aria-hidden="true"
        >
          {overlayElements}
        </svg>
      ) : null}
    </>
  );
}

function WorkspaceRendererRoot({ store, ...deps }: WorkspaceDeps) {
  useRuntimeVersion(store);
  const state = store.getState();

  return (
    <WorkspaceRoot
      {...deps}
      state={state}
      store={store}
    />
  );
}

export function createReactWorkspaceRenderer({ store, state, ui, model, actions, applyZoom, updateGridSurface }: WorkspaceDeps) {
  const host = document.createElement("div");
  host.className = "workspace-react-root";
  ui.svgHost.append(host);
  const root: Root = createRoot(host);
  root.render(
    <WorkspaceRendererRoot
      actions={actions}
      applyZoom={applyZoom}
      model={model}
      state={state}
      store={store}
      ui={ui}
      updateGridSurface={updateGridSurface}
    />
  );

  function renderWorkspace() {
    store.invalidate();
  }

  function renderOverlay() {
    store.invalidate();
  }

  return {
    dispose() {
      root.unmount();
      host.remove();
    },
    renderOverlay,
    renderWorkspace
  };
}
