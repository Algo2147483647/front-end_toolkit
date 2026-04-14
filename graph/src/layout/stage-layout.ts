import type { GraphLayoutMode, GraphSelection, GraphTheme, NodeKey, NormalizedDag, RelationValue } from "../graph/types";
import { DEFAULT_GRAPH_THEME } from "../graph/types";
import { getRelationKeys } from "../graph/relations";
import { structuredCloneValue } from "../graph/serialize";
import { getNodeVisual } from "./text";
import { resolveStageSelection, withSyntheticSelectionRoot } from "./selection";
import type { LayoutRoutePoint, StageData, StageNode, StageRoutePoint } from "./types";
import { buildBfsLayout } from "./algorithms/bfs";
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
  const layoutResult = layoutMode === "sugiyama"
    ? buildSugiyamaLayout(layoutDag, layoutRoots)
    : buildBfsLayout(layoutDag, layoutRoots);
  const coordinates = layoutResult.coordinates;

  const reachable = selection.isForest
    ? collectReachableFromRoots(layoutDag, selection.topLevelKeys)
    : collectReachableNodes(layoutDag, selection.rootKey);
  const nodeKeys = Array.from(reachable).filter((key) => layoutDag[key] && coordinates.has(key));
  const nodesByLayer = new Map<number, StageNode[]>();
  const nodeMap: Record<NodeKey, StageNode> = {};
  const edges: StageData["edges"] = [];
  const incomingMap = buildIncomingMap(layoutDag, nodeKeys);

  nodeKeys.forEach((nodeKey) => {
    const node = layoutDag[nodeKey];
    const coordinate = coordinates.get(nodeKey);
    if (!coordinate) {
      return;
    }

    const [layer, order] = coordinate;
    const visual = getNodeVisual(nodeKey, node, theme.minNodeWidth, theme.maxNodeWidth);
    const nodeData: StageNode = {
      key: nodeKey,
      layer,
      order,
      title: visual.title,
      detail: visual.detail,
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
  const slotCountsByLayer = layoutResult.layerSlotCounts || fallbackSlotCounts;
  const sortedLayers = Array.from(new Set([...nodesByLayer.keys(), ...slotCountsByLayer.keys()])).sort((a, b) => a - b);
  const stageInnerHeight = measureStageInnerHeight(slotCountsByLayer, theme);

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
  const lanes: StageData["lanes"] = [];
  const laneCenters = new Map<number, number>();

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
      const points = route?.points.map((point) => getRoutePointPosition(point, laneCenters, slotCountsByLayer, stageInnerHeight, theme));
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

  const stageWidth = cursorX - theme.columnGap + theme.stagePaddingX;
  const stageHeight = stageInnerHeight + theme.stagePaddingY * 2;

  return {
    dag: layoutDag,
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

function getRoutePointPosition(
  point: LayoutRoutePoint,
  laneCenters: Map<number, number>,
  slotCountsByLayer: Map<number, number>,
  stageInnerHeight: number,
  theme: GraphTheme,
): StageRoutePoint {
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
