import type { GraphSelection, GraphTheme, NodeKey, NormalizedDag, RelationValue } from "../graph/types";
import { DEFAULT_GRAPH_THEME } from "../graph/types";
import { getRelationKeys } from "../graph/relations";
import { structuredCloneValue } from "../graph/serialize";
import { getNodeVisual } from "./text";
import { resolveStageSelection, withSyntheticSelectionRoot } from "./selection";
import type { StageData, StageNode } from "./types";

type CoordinateMap = Map<NodeKey, [number, number]>;

export function buildStageData(input: {
  dag: NormalizedDag;
  selection: GraphSelection | null;
  theme?: GraphTheme;
}): StageData | null {
  const { dag: sourceDag, selection: requestedSelection, theme = DEFAULT_GRAPH_THEME } = input;
  if (!sourceDag || Object.keys(sourceDag).length === 0) {
    return null;
  }

  const dag = structuredCloneValue(sourceDag);
  const selection = resolveStageSelection(dag, requestedSelection);
  const layoutDag = withSyntheticSelectionRoot(dag, selection);
  const forestTopLevelSet = new Set(selection.topLevelKeys);
  const coordinates = selection.isForest
    ? buildCoordinatesFromRoots(layoutDag, selection.topLevelKeys)
    : buildCoordinates(layoutDag, selection.rootKey);

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

  const sortedLayers = Array.from(nodesByLayer.keys()).sort((a, b) => a - b);
  const stageInnerHeight = measureStageInnerHeight(nodesByLayer, theme);

  sortedLayers.forEach((layer) => {
    const layerNodes = nodesByLayer.get(layer)!.sort((a, b) => a.order - b.order);
    if (layer > 0) {
      layerNodes.sort((a, b) => {
        const aScore = getBarycentricScore(a.key, incomingMap, nodeMap);
        const bScore = getBarycentricScore(b.key, incomingMap, nodeMap);
        return aScore === bScore ? a.order - b.order : aScore - bScore;
      });
    }

    layerNodes.forEach((nodeData, index) => {
      nodeData.order = index;
    });

    const layerHeight = layerNodes.length * theme.nodeHeight + Math.max(layerNodes.length - 1, 0) * theme.rowGap;
    const startY = theme.stagePaddingY + (stageInnerHeight - layerHeight) / 2;
    layerNodes.forEach((nodeData, index) => {
      nodeData.y = startY + index * (theme.nodeHeight + theme.rowGap) + theme.nodeHeight / 2;
    });
  });

  const columnWidths = sortedLayers.map((layer) => Math.max(...nodesByLayer.get(layer)!.map((node) => node.width)));
  let cursorX = theme.stagePaddingX;
  const lanes: StageData["lanes"] = [];

  sortedLayers.forEach((layer, index) => {
    const layerWidth = columnWidths[index];
    const layerNodes = nodesByLayer.get(layer)!;
    const laneCenter = cursorX + layerWidth / 2;
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
      edges.push({
        id: `${sourceKey}-->${targetKey}`,
        source: sourceKey,
        target: targetKey,
        weight,
        label: getEdgeLabel(weight),
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
    warnings: [],
  };
}

function buildCoordinates(dag: Record<NodeKey, unknown>, root: NodeKey): CoordinateMap {
  return buildCoordinatesFromRoots(dag, [root]);
}

function buildCoordinatesFromRoots(dag: Record<NodeKey, unknown>, roots: NodeKey[]): CoordinateMap {
  const coordinates: CoordinateMap = new Map();
  const queue = roots.slice();
  const visited = new Set(queue);
  let level = -1;

  while (queue.length) {
    const levelCount = queue.length;
    level += 1;
    for (let index = 0; index < levelCount; index += 1) {
      const key = queue.shift()!;
      const node = dag[key] as { children?: unknown } | undefined;
      if (!node) {
        continue;
      }
      coordinates.set(key, [level, index]);
      getRelationKeys(node.children).forEach((childKey) => {
        if (dag[childKey] && !visited.has(childKey)) {
          visited.add(childKey);
          queue.push(childKey);
        }
      });
    }
  }

  return coordinates;
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

function measureStageInnerHeight(nodesByLayer: Map<number, StageNode[]>, theme: GraphTheme): number {
  let maxHeight = 0;
  nodesByLayer.forEach((layerNodes) => {
    const layerHeight = layerNodes.length * theme.nodeHeight + Math.max(layerNodes.length - 1, 0) * theme.rowGap;
    maxHeight = Math.max(maxHeight, layerHeight);
  });
  return Math.max(maxHeight, theme.nodeHeight * 3.4);
}

function getEdgeLabel(weight: unknown): string {
  if (weight === undefined || weight === null || weight === "" || weight === 1) {
    return "";
  }
  return String(weight);
}
