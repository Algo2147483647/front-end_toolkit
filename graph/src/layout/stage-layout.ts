import type { GraphLayoutMode, GraphSelection, GraphTheme, NodeKey, NormalizedDag, RelationValue } from "../graph/types";
import { DEFAULT_GRAPH_THEME } from "../graph/types";
import { getRelationKeys } from "../graph/relations";
import { structuredCloneValue } from "../graph/serialize";
import { getNodeVisual } from "./text";
import { resolveStageSelection, withSyntheticSelectionRoot } from "./selection";
import type { LayoutRoutePoint, StageData, StageNode, StageNodeColorTokens, StageRoutePoint } from "./types";
import { buildBfsLayout } from "./algorithms/bfs";
import { buildDagreLayout } from "./algorithms/dagre";
import { buildSugiyamaLayout } from "./algorithms/sugiyama";

export function buildStageData(input: {
  dag: NormalizedDag;
  selection: GraphSelection | null;
  layoutMode?: GraphLayoutMode;
  theme?: GraphTheme;
}): StageData | null {
  const { dag: sourceDag, selection: requestedSelection, layoutMode = "bfs", theme = DEFAULT_GRAPH_THEME } = input;
  if (!sourceDag || Object.keys(sourceDag).length === 0) {
    return null;
  }

  const dag = structuredCloneValue(sourceDag);
  const selection = resolveStageSelection(dag, requestedSelection);
  const layoutDag = withSyntheticSelectionRoot(dag, selection);
  const forestTopLevelSet = new Set(selection.topLevelKeys);
  const layoutRoots = selection.isForest ? selection.topLevelKeys : [selection.rootKey];
  const reachable = selection.isForest
    ? collectReachableFromRoots(layoutDag, selection.topLevelKeys)
    : collectReachableNodes(layoutDag, selection.rootKey);
  const typeColorMap = buildTypeColorMap(sourceDag);
  const visualByKey = buildNodeVisualMap(layoutDag, reachable, theme);
  const layoutResult = resolveLayout(layoutMode, layoutDag, layoutRoots, visualByKey, theme);
  const coordinates = layoutResult.coordinates;
  const nodeKeys = Array.from(reachable).filter((key) => layoutDag[key] && coordinates.has(key));
  const nodesByLayer = new Map<number, StageNode[]>();
  const nodeMap: Record<NodeKey, StageNode> = {};
  const edges: StageData["edges"] = [];
  const incomingMap = buildIncomingMap(layoutDag, nodeKeys);

  nodeKeys.forEach((nodeKey) => {
    const node = layoutDag[nodeKey];
    const coordinate = coordinates.get(nodeKey);
    const visual = visualByKey.get(nodeKey);
    if (!coordinate || !visual) {
      return;
    }

    const [layer, order] = coordinate;
    const typeLabel = normalizeTypeLabel(node.type);
    const nodeData: StageNode = {
      key: nodeKey,
      layer,
      order,
      title: visual.title,
      detail: visual.detail,
      typeLabel,
      colorTokens: typeLabel ? typeColorMap.get(typeLabel) : undefined,
      width: visual.width,
      height: theme.nodeHeight,
      isRoot: selection.isForest ? forestTopLevelSet.has(nodeKey) : nodeKey === selection.rootKey,
      x: 0,
      y: 0,
    };

    if (!nodesByLayer.has(layer)) {
      nodesByLayer.set(layer, []);
    }
    nodesByLayer.get(layer)!.push(nodeData);
    nodeMap[nodeKey] = nodeData;
  });

  const fallbackSlotCounts = new Map(Array.from(nodesByLayer.entries()).map(([layer, layerNodes]) => [layer, layerNodes.length]));
  const sortedLayers = Array.from(new Set([
    ...nodesByLayer.keys(),
    ...(layoutResult.layerSlotCounts?.keys() || []),
  ])).sort((a, b) => a - b);

  let laneCenters = new Map<number, number>();
  let lanes: StageData["lanes"] = [];
  let slotCountsByLayer = layoutResult.layerSlotCounts || fallbackSlotCounts;
  let stageInnerHeight = measureStageInnerHeight(slotCountsByLayer, theme);
  let stageWidth = 0;
  let stageHeight = 0;
  let absoluteOffset: { x: number; y: number } | undefined;

  if (layoutResult.nodePositions?.size) {
    const absoluteGeometry = applyAbsoluteLayoutGeometry({
      nodeKeys,
      nodeMap,
      nodesByLayer,
      sortedLayers,
      nodePositions: layoutResult.nodePositions,
      theme,
      selection,
    });
    lanes = absoluteGeometry.lanes;
    laneCenters = absoluteGeometry.laneCenters;
    slotCountsByLayer = absoluteGeometry.slotCountsByLayer;
    stageInnerHeight = absoluteGeometry.stageInnerHeight;
    stageWidth = absoluteGeometry.stageWidth;
    stageHeight = absoluteGeometry.stageHeight;
    absoluteOffset = absoluteGeometry.absoluteOffset;
  } else {
    sortedLayers.forEach((layer) => {
      const layerNodes = (nodesByLayer.get(layer) || []).sort((a, b) => a.order - b.order);
      if (layoutMode === "bfs" && layer > 0) {
        layerNodes.sort((a, b) => {
          const aScore = getBarycentricScore(a.key, incomingMap, nodeMap);
          const bScore = getBarycentricScore(b.key, incomingMap, nodeMap);
          return aScore === bScore ? a.order - b.order : aScore - bScore;
        });
      }

      if (layoutMode === "bfs") {
        layerNodes.forEach((nodeData, index) => {
          nodeData.order = index;
        });
      }

      const slotCount = slotCountsByLayer.get(layer) || layerNodes.length || 1;
      const layerHeight = slotCount * theme.nodeHeight + Math.max(slotCount - 1, 0) * theme.rowGap;
      const startY = theme.stagePaddingY + (stageInnerHeight - layerHeight) / 2;
      layerNodes.forEach((nodeData) => {
        nodeData.y = startY + nodeData.order * (theme.nodeHeight + theme.rowGap) + theme.nodeHeight / 2;
      });
    });

    const columnWidths = sortedLayers.map((layer) => {
      const layerNodes = nodesByLayer.get(layer) || [];
      return layerNodes.length ? Math.max(...layerNodes.map((node) => node.width)) : theme.minNodeWidth;
    });
    let cursorX = theme.stagePaddingX;

    sortedLayers.forEach((layer, index) => {
      const layerWidth = columnWidths[index];
      const layerNodes = nodesByLayer.get(layer) || [];
      const laneCenter = cursorX + layerWidth / 2;
      laneCenters.set(layer, laneCenter);
      layerNodes.forEach((nodeData) => {
        nodeData.x = laneCenter;
      });
      lanes.push({
        layer,
        label: layer === 0 ? (selection.isForest ? "Root" : "Focus") : `Tier ${layer}`,
        x: laneCenter,
        width: layerWidth,
      });
      cursorX += layerWidth + theme.columnGap;
    });

    stageWidth = cursorX - theme.columnGap + theme.stagePaddingX;
    stageHeight = stageInnerHeight + theme.stagePaddingY * 2;
  }

  nodeKeys.forEach((sourceKey) => {
    const sourceNode = layoutDag[sourceKey];
    const children = sourceNode.children || [];
    const childKeys = getRelationKeys(children);
    childKeys.forEach((targetKey) => {
      if (!nodeMap[targetKey]) {
        return;
      }
      const weight = Array.isArray(children) ? 1 : (children as Record<NodeKey, RelationValue>)[targetKey];
      const route = layoutResult.edgeRoutes?.get(`${sourceKey}-->${targetKey}`);
      const points = route?.points.map((point) => (
        getRoutePointPosition(point, laneCenters, slotCountsByLayer, stageInnerHeight, theme, absoluteOffset)
      ));
      edges.push({
        id: `${sourceKey}-->${targetKey}`,
        source: sourceKey,
        target: targetKey,
        weight,
        label: getEdgeLabel(weight),
        points: points && points.length ? points : undefined,
      });
    });
  });

  return {
    dag: layoutDag,
    layoutMode,
    root: selection.rootKey,
    selection,
    topLevelKeys: selection.topLevelKeys,
    isForest: selection.isForest,
    nodeMap,
    nodes: Object.values(nodeMap),
    edges,
    lanes,
    stageWidth: Math.max(stageWidth, 980),
    stageHeight: Math.max(stageHeight, 600),
    warnings: layoutResult.warnings,
  };
}

function resolveLayout(
  layoutMode: GraphLayoutMode,
  layoutDag: Record<NodeKey, NormalizedDag[NodeKey] | undefined>,
  layoutRoots: NodeKey[],
  visualByKey: Map<NodeKey, { width: number }>,
  theme: GraphTheme,
) {
  if (layoutMode === "sugiyama") {
    return buildSugiyamaLayout(layoutDag, layoutRoots);
  }
  if (layoutMode === "dagre") {
    const nodeSizes = new Map<NodeKey, { width: number; height: number }>();
    visualByKey.forEach((visual, nodeKey) => {
      nodeSizes.set(nodeKey, { width: visual.width, height: theme.nodeHeight });
    });
    return buildDagreLayout(layoutDag, layoutRoots, nodeSizes);
  }
  return buildBfsLayout(layoutDag, layoutRoots);
}

function buildNodeVisualMap(
  dag: Record<NodeKey, NormalizedDag[NodeKey] | undefined>,
  nodeKeys: Set<NodeKey>,
  theme: GraphTheme,
): Map<NodeKey, ReturnType<typeof getNodeVisual>> {
  const visuals = new Map<NodeKey, ReturnType<typeof getNodeVisual>>();
  nodeKeys.forEach((nodeKey) => {
    const node = dag[nodeKey];
    if (!node) {
      return;
    }
    visuals.set(nodeKey, getNodeVisual(nodeKey, node, theme.minNodeWidth, theme.maxNodeWidth));
  });
  return visuals;
}

function collectReachableNodes(dag: Record<NodeKey, unknown>, root: NodeKey): Set<NodeKey> {
  return collectReachableFromRoots(dag, [root]);
}

function collectReachableFromRoots(dag: Record<NodeKey, unknown>, roots: NodeKey[]): Set<NodeKey> {
  const visited = new Set<NodeKey>();
  const stack = roots.slice();
  while (stack.length) {
    const nodeKey = stack.pop()!;
    const node = dag[nodeKey] as { children?: unknown } | undefined;
    if (visited.has(nodeKey) || !node) {
      continue;
    }
    visited.add(nodeKey);
    getRelationKeys(node.children).forEach((childKey) => stack.push(childKey));
  }
  return visited;
}

function buildIncomingMap(dag: Record<NodeKey, { children?: unknown }>, nodeKeys: NodeKey[]): Record<NodeKey, NodeKey[]> {
  const visibleKeys = new Set(nodeKeys);
  const incomingMap: Record<NodeKey, NodeKey[]> = {};
  nodeKeys.forEach((nodeKey) => {
    incomingMap[nodeKey] = [];
  });
  nodeKeys.forEach((sourceKey) => {
    getRelationKeys(dag[sourceKey]?.children).forEach((targetKey) => {
      if (visibleKeys.has(targetKey)) {
        incomingMap[targetKey].push(sourceKey);
      }
    });
  });
  return incomingMap;
}

function getBarycentricScore(nodeKey: NodeKey, incomingMap: Record<NodeKey, NodeKey[]>, nodeMap: Record<NodeKey, StageNode>): number {
  const parents = incomingMap[nodeKey] || [];
  if (!parents.length) {
    return nodeMap[nodeKey].order;
  }
  const total = parents.reduce((sum, parentKey) => sum + (nodeMap[parentKey] ? nodeMap[parentKey].order : 0), 0);
  return total / parents.length;
}

function measureStageInnerHeight(slotCountsByLayer: Map<number, number>, theme: GraphTheme): number {
  let maxHeight = 0;
  slotCountsByLayer.forEach((slotCount) => {
    const layerHeight = slotCount * theme.nodeHeight + Math.max(slotCount - 1, 0) * theme.rowGap;
    maxHeight = Math.max(maxHeight, layerHeight);
  });
  return Math.max(maxHeight, theme.nodeHeight * 3.4);
}

function applyAbsoluteLayoutGeometry(input: {
  nodeKeys: NodeKey[];
  nodeMap: Record<NodeKey, StageNode>;
  nodesByLayer: Map<number, StageNode[]>;
  sortedLayers: number[];
  nodePositions: Map<NodeKey, { x: number; y: number }>;
  theme: GraphTheme;
  selection: StageData["selection"];
}): {
  lanes: StageData["lanes"];
  laneCenters: Map<number, number>;
  slotCountsByLayer: Map<number, number>;
  stageInnerHeight: number;
  stageWidth: number;
  stageHeight: number;
  absoluteOffset: { x: number; y: number };
} {
  const { nodeKeys, nodeMap, nodesByLayer, sortedLayers, nodePositions, theme, selection } = input;
  let minLeft = Infinity;
  let maxRight = -Infinity;
  let minTop = Infinity;
  let maxBottom = -Infinity;

  nodeKeys.forEach((nodeKey) => {
    const node = nodeMap[nodeKey];
    const position = nodePositions.get(nodeKey);
    if (!node || !position) {
      return;
    }
    minLeft = Math.min(minLeft, position.x - node.width / 2);
    maxRight = Math.max(maxRight, position.x + node.width / 2);
    minTop = Math.min(minTop, position.y - node.height / 2);
    maxBottom = Math.max(maxBottom, position.y + node.height / 2);
  });

  if (!Number.isFinite(minLeft) || !Number.isFinite(minTop) || !Number.isFinite(maxRight) || !Number.isFinite(maxBottom)) {
    minLeft = 0;
    minTop = 0;
    maxRight = theme.minNodeWidth;
    maxBottom = theme.nodeHeight * 2;
  }

  const absoluteOffset = {
    x: theme.stagePaddingX - minLeft,
    y: theme.stagePaddingY - minTop,
  };

  nodeKeys.forEach((nodeKey) => {
    const node = nodeMap[nodeKey];
    const position = nodePositions.get(nodeKey);
    if (!node || !position) {
      return;
    }
    node.x = position.x + absoluteOffset.x;
    node.y = position.y + absoluteOffset.y;
  });

  const lanes: StageData["lanes"] = [];
  const laneCenters = new Map<number, number>();
  const slotCountsByLayer = new Map<number, number>();

  sortedLayers.forEach((layer) => {
    const layerNodes = nodesByLayer.get(layer) || [];
    slotCountsByLayer.set(layer, layerNodes.length);
    if (!layerNodes.length) {
      return;
    }

    const laneCenter = layerNodes.reduce((sum, node) => sum + node.x, 0) / layerNodes.length;
    laneCenters.set(layer, laneCenter);
    lanes.push({
      layer,
      label: layer === 0 ? (selection.isForest ? "Root" : "Focus") : `Tier ${layer}`,
      x: laneCenter,
      width: Math.max(...layerNodes.map((node) => node.width)),
    });
  });

  const stageWidth = maxRight - minLeft + theme.stagePaddingX * 2;
  const stageHeight = maxBottom - minTop + theme.stagePaddingY * 2;

  return {
    lanes,
    laneCenters,
    slotCountsByLayer,
    stageInnerHeight: Math.max(stageHeight - theme.stagePaddingY * 2, theme.nodeHeight * 3.4),
    stageWidth,
    stageHeight,
    absoluteOffset,
  };
}

function getRoutePointPosition(
  point: LayoutRoutePoint,
  laneCenters: Map<number, number>,
  slotCountsByLayer: Map<number, number>,
  stageInnerHeight: number,
  theme: GraphTheme,
  absoluteOffset?: { x: number; y: number },
): StageRoutePoint {
  if (typeof point.x === "number" && typeof point.y === "number") {
    return {
      layer: point.layer,
      order: point.order,
      x: point.x + (absoluteOffset?.x || 0),
      y: point.y + (absoluteOffset?.y || 0),
    };
  }

  const slotCount = slotCountsByLayer.get(point.layer) || 1;
  const layerHeight = slotCount * theme.nodeHeight + Math.max(slotCount - 1, 0) * theme.rowGap;
  const startY = theme.stagePaddingY + (stageInnerHeight - layerHeight) / 2;
  return {
    layer: point.layer,
    order: point.order,
    x: laneCenters.get(point.layer) || theme.stagePaddingX,
    y: startY + point.order * (theme.nodeHeight + theme.rowGap) + theme.nodeHeight / 2,
  };
}

function getEdgeLabel(weight: unknown): string {
  if (weight === undefined || weight === null || weight === "" || weight === 1) {
    return "";
  }
  return String(weight);
}

function buildTypeColorMap(dag: NormalizedDag): Map<string, StageNodeColorTokens> {
  const typeLabels = Array.from(new Set(
    Object.values(dag)
      .map((node) => normalizeTypeLabel(node.type))
      .filter((value): value is string => Boolean(value)),
  )).sort((left, right) => left.localeCompare(right));

  const colorMap = new Map<string, StageNodeColorTokens>();
  if (!typeLabels.length) {
    return colorMap;
  }

  const hueStep = 360 / typeLabels.length;
  typeLabels.forEach((typeLabel, index) => {
    const hue = (index * hueStep + 18) % 360;
    colorMap.set(typeLabel, createNodeColorTokens(hue));
  });
  return colorMap;
}

function normalizeTypeLabel(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function createNodeColorTokens(hue: number): StageNodeColorTokens {
  return {
    glow: hsla(hue, 74, 48, 0.12),
    fill: "rgba(252, 253, 255, 0.88)",
    rootFill: "rgba(252, 254, 255, 0.94)",
    activeFill: "rgba(251, 253, 255, 0.96)",
    border: hsla(hue, 34, 48, 0.26),
    borderStrong: hsla(hue, 42, 40, 0.38),
    activeBorder: hsla(hue, 56, 42, 0.5),
    pinFill: hsla(hue, 74, 50, 0.16),
    pinStroke: hsla(hue, 70, 44, 0.28),
    pinCore: hsla(hue, 72, 36, 0.82),
    affordanceBg: hsla(hue, 48, 93, 0.96),
    affordanceText: hsla(hue, 62, 32, 0.82),
  };
}

function hsla(hue: number, saturation: number, lightness: number, alpha: number): string {
  return `hsla(${Math.round(hue)} ${saturation}% ${lightness}% / ${alpha})`;
}
