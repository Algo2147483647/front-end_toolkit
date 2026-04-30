import type { NodeKey } from "../../graph/types";
import type { LayoutEdgeRoute, LayoutResult } from "../types";
import { buildVisibleGraph, getExistingRoots, type LayoutGraphNode, type VisibleGraph } from "./shared";

const CROSSING_REDUCTION_MAX_PASSES = 12;
const POSITION_COMPACTION_PASSES = 8;
const MIN_POSITION_GAP = 1;

interface LayoutEdge {
  source: NodeKey;
  target: NodeKey;
  originalSource: NodeKey;
  originalTarget: NodeKey;
  reversedForLayout: boolean;
}

interface LayoutItem {
  id: NodeKey;
  layer: number;
  order: number;
  realKey?: NodeKey;
  dummyFor?: string;
}

interface NormalizedRoute {
  edgeId: string;
  source: NodeKey;
  target: NodeKey;
  items: LayoutItem[];
  reversedForLayout: boolean;
}

interface LayerSegment {
  source: NodeKey;
  target: NodeKey;
}

interface CrossingIndex {
  incoming: Record<NodeKey, NodeKey[]>;
  outgoing: Record<NodeKey, NodeKey[]>;
  segmentsByUpperLayer: Map<number, LayerSegment[]>;
  itemById: Record<NodeKey, LayoutItem>;
}

export function buildSugiyamaLayout(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): LayoutResult {
  const graph = buildVisibleGraph(dag, roots);
  const rootSet = new Set(getExistingRoots(dag, roots));
  const stableOrderByKey = buildStableOrderByKey(dag, graph);
  const layoutEdges = buildLayoutEdges(graph);
  const cycleResult = breakCyclesForLayout(graph.nodeKeys, layoutEdges, stableOrderByKey);
  const topologicalOrder = buildTopologicalOrder(graph.nodeKeys, cycleResult.edges, stableOrderByKey);
  const layerByKey = assignBalancedLayers(graph.nodeKeys, topologicalOrder, cycleResult.edges, rootSet);
  const normalized = normalizeLongEdges(cycleResult.edges, layerByKey);
  const originalOrderById = buildOriginalOrderById(normalized.items, stableOrderByKey);
  const layers = buildLayers(normalized.items, originalOrderById);

  reduceCrossings(layers, normalized.segments, originalOrderById);

  const crossingIndex = buildCrossingIndex(layers, normalized.segments);
  const compactedPositions = compactLayerPositions(layers, crossingIndex);
  applyCompactedPositions(layers, compactedPositions);

  const coordinates: LayoutResult["coordinates"] = new Map();
  normalized.items.forEach((item) => {
    if (item.realKey) {
      coordinates.set(item.realKey, [item.layer, item.order]);
    }
  });

  const layerSlotCounts = new Map<number, number>();
  layers.forEach((items, layer) => {
    layerSlotCounts.set(layer, items.length);
  });

  const edgeRoutes = new Map<string, LayoutEdgeRoute>();
  normalized.routes.forEach((route) => {
    edgeRoutes.set(route.edgeId, {
      source: route.source,
      target: route.target,
      points: route.items.map((item) => ({ layer: item.layer, order: item.order })),
      reversedForLayout: route.reversedForLayout,
    });
  });

  return { coordinates, warnings: cycleResult.warnings, layerSlotCounts, edgeRoutes };
}

function buildLayoutEdges(graph: VisibleGraph): LayoutEdge[] {
  const edges: LayoutEdge[] = [];
  graph.nodeKeys.forEach((source) => {
    graph.outgoing[source].forEach((target) => {
      edges.push({ source, target, originalSource: source, originalTarget: target, reversedForLayout: false });
    });
  });
  return edges;
}

function breakCyclesForLayout(nodeKeys: NodeKey[], edges: LayoutEdge[], stableOrderByKey: Record<NodeKey, number>): { edges: LayoutEdge[]; warnings: string[] } {
  const order = buildGreedyAcyclicOrder(nodeKeys, edges, stableOrderByKey);
  const warnings: string[] = [];

  const nextEdges = edges.map((edge) => {
    if (order[edge.source] <= order[edge.target]) {
      return edge;
    }
    warnings.push(`Sugiyama layout reversed "${edge.source}" -> "${edge.target}" to break a visible cycle.`);
    return { ...edge, source: edge.target, target: edge.source, reversedForLayout: true };
  });

  return { edges: nextEdges, warnings };
}

function buildGreedyAcyclicOrder(nodeKeys: NodeKey[], edges: LayoutEdge[], stableOrderByKey: Record<NodeKey, number>): Record<NodeKey, number> {
  const outgoing = new Map<NodeKey, NodeKey[]>();
  const incoming = new Map<NodeKey, NodeKey[]>();
  const outDegree = new Map<NodeKey, number>();
  const inDegree = new Map<NodeKey, number>();
  const remaining = new Set(nodeKeys);
  const left: NodeKey[] = [];
  const right: NodeKey[] = [];

  nodeKeys.forEach((key) => {
    outgoing.set(key, []);
    incoming.set(key, []);
    outDegree.set(key, 0);
    inDegree.set(key, 0);
  });

  edges.forEach((edge) => {
    outgoing.get(edge.source)?.push(edge.target);
    incoming.get(edge.target)?.push(edge.source);
    outDegree.set(edge.source, (outDegree.get(edge.source) || 0) + 1);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  });

  const byStableOrder = (leftKey: NodeKey, rightKey: NodeKey) => stableOrderByKey[leftKey] - stableOrderByKey[rightKey];

  const removeNode = (nodeKey: NodeKey, target: NodeKey[]) => {
    if (!remaining.has(nodeKey)) {
      return;
    }
    remaining.delete(nodeKey);
    target.push(nodeKey);
    (outgoing.get(nodeKey) || []).forEach((nextKey) => {
      if (remaining.has(nextKey)) {
        inDegree.set(nextKey, (inDegree.get(nextKey) || 0) - 1);
      }
    });
    (incoming.get(nodeKey) || []).forEach((previousKey) => {
      if (remaining.has(previousKey)) {
        outDegree.set(previousKey, (outDegree.get(previousKey) || 0) - 1);
      }
    });
  };

  while (remaining.size) {
    const sinks = Array.from(remaining).filter((nodeKey) => (outDegree.get(nodeKey) || 0) === 0).sort(byStableOrder);
    if (sinks.length) {
      sinks.forEach((nodeKey) => removeNode(nodeKey, right));
      continue;
    }

    const sources = Array.from(remaining).filter((nodeKey) => (inDegree.get(nodeKey) || 0) === 0).sort(byStableOrder);
    if (sources.length) {
      sources.forEach((nodeKey) => removeNode(nodeKey, left));
      continue;
    }

    const pivot = Array.from(remaining).sort((leftKey, rightKey) => {
      const leftScore = (outDegree.get(leftKey) || 0) - (inDegree.get(leftKey) || 0);
      const rightScore = (outDegree.get(rightKey) || 0) - (inDegree.get(rightKey) || 0);
      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }
      return byStableOrder(leftKey, rightKey);
    })[0];

    removeNode(pivot, left);
  }

  const order: Record<NodeKey, number> = {};
  [...left, ...right.reverse()].forEach((nodeKey, index) => {
    order[nodeKey] = index;
  });
  return order;
}

function buildTopologicalOrder(nodeKeys: NodeKey[], edges: LayoutEdge[], stableOrderByKey: Record<NodeKey, number>): NodeKey[] {
  const incomingCount = new Map<NodeKey, number>();
  const outgoing = new Map<NodeKey, NodeKey[]>();
  nodeKeys.forEach((nodeKey) => {
    incomingCount.set(nodeKey, 0);
    outgoing.set(nodeKey, []);
  });
  edges.forEach((edge) => {
    outgoing.get(edge.source)?.push(edge.target);
    incomingCount.set(edge.target, (incomingCount.get(edge.target) || 0) + 1);
  });

  const queue = nodeKeys
    .filter((nodeKey) => (incomingCount.get(nodeKey) || 0) === 0)
    .sort((leftKey, rightKey) => stableOrderByKey[leftKey] - stableOrderByKey[rightKey]);
  const order: NodeKey[] = [];

  while (queue.length) {
    const nodeKey = queue.shift()!;
    order.push(nodeKey);
    (outgoing.get(nodeKey) || []).forEach((targetKey) => {
      const nextCount = (incomingCount.get(targetKey) || 0) - 1;
      incomingCount.set(targetKey, nextCount);
      if (nextCount === 0) {
        queue.push(targetKey);
        queue.sort((leftKey, rightKey) => stableOrderByKey[leftKey] - stableOrderByKey[rightKey]);
      }
    });
  }

  return order.length === nodeKeys.length ? order : nodeKeys.slice().sort((leftKey, rightKey) => stableOrderByKey[leftKey] - stableOrderByKey[rightKey]);
}

function assignBalancedLayers(nodeKeys: NodeKey[], topologicalOrder: NodeKey[], edges: LayoutEdge[], rootSet: Set<NodeKey>): Record<NodeKey, number> {
  const incoming = new Map<NodeKey, NodeKey[]>();
  const outgoing = new Map<NodeKey, NodeKey[]>();
  nodeKeys.forEach((nodeKey) => {
    incoming.set(nodeKey, []);
    outgoing.set(nodeKey, []);
  });
  edges.forEach((edge) => {
    incoming.get(edge.target)?.push(edge.source);
    outgoing.get(edge.source)?.push(edge.target);
  });

  const lowerBound: Record<NodeKey, number> = {};
  topologicalOrder.forEach((nodeKey) => {
    if (rootSet.has(nodeKey)) {
      lowerBound[nodeKey] = 0;
      return;
    }
    let layer = 0;
    (incoming.get(nodeKey) || []).forEach((parentKey) => {
      layer = Math.max(layer, (lowerBound[parentKey] ?? 0) + 1);
    });
    lowerBound[nodeKey] = layer;
  });

  const maxLayer = topologicalOrder.reduce((currentMax, nodeKey) => Math.max(currentMax, lowerBound[nodeKey] ?? 0), 0);
  const upperBound: Record<NodeKey, number> = {};
  [...topologicalOrder].reverse().forEach((nodeKey) => {
    if (rootSet.has(nodeKey)) {
      upperBound[nodeKey] = 0;
      return;
    }
    const childKeys = outgoing.get(nodeKey) || [];
    if (!childKeys.length) {
      upperBound[nodeKey] = maxLayer;
      return;
    }
    upperBound[nodeKey] = childKeys.reduce((minimum, childKey) => Math.min(minimum, (upperBound[childKey] ?? maxLayer) - 1), maxLayer);
    if (upperBound[nodeKey] < lowerBound[nodeKey]) {
      upperBound[nodeKey] = lowerBound[nodeKey];
    }
  });

  const layerByKey: Record<NodeKey, number> = { ...lowerBound };
  const reverseOrder = [...topologicalOrder].reverse();

  for (let pass = 0; pass < 6; pass += 1) {
    topologicalOrder.forEach((nodeKey) => {
      if (rootSet.has(nodeKey)) {
        layerByKey[nodeKey] = 0;
        return;
      }
      layerByKey[nodeKey] = chooseBalancedLayer(nodeKey, incoming, outgoing, layerByKey, lowerBound, upperBound);
    });
    reverseOrder.forEach((nodeKey) => {
      if (rootSet.has(nodeKey)) {
        layerByKey[nodeKey] = 0;
        return;
      }
      layerByKey[nodeKey] = chooseBalancedLayer(nodeKey, incoming, outgoing, layerByKey, lowerBound, upperBound);
    });
  }

  return layerByKey;
}

function chooseBalancedLayer(
  nodeKey: NodeKey,
  incoming: Map<NodeKey, NodeKey[]>,
  outgoing: Map<NodeKey, NodeKey[]>,
  layerByKey: Record<NodeKey, number>,
  lowerBound: Record<NodeKey, number>,
  upperBound: Record<NodeKey, number>,
): number {
  const desiredLayers = [
    ...(incoming.get(nodeKey) || []).map((parentKey) => (layerByKey[parentKey] ?? lowerBound[parentKey] ?? 0) + 1),
    ...(outgoing.get(nodeKey) || []).map((childKey) => (layerByKey[childKey] ?? upperBound[childKey] ?? upperBound[nodeKey]) - 1),
  ].sort((leftValue, rightValue) => leftValue - rightValue);

  if (!desiredLayers.length) {
    return lowerBound[nodeKey];
  }

  const middle = Math.floor(desiredLayers.length / 2);
  const median = desiredLayers.length % 2 === 0
    ? (desiredLayers[middle - 1] + desiredLayers[middle]) / 2
    : desiredLayers[middle];

  return clamp(Math.round(median), lowerBound[nodeKey], upperBound[nodeKey]);
}

function normalizeLongEdges(edges: LayoutEdge[], layerByKey: Record<NodeKey, number>): {
  items: LayoutItem[];
  segments: LayoutEdge[];
  routes: NormalizedRoute[];
} {
  const items: LayoutItem[] = Object.entries(layerByKey).map(([key, layer]) => ({ id: key, realKey: key, layer, order: 0 }));
  const segments: LayoutEdge[] = [];
  const routes: NormalizedRoute[] = [];

  edges.forEach((edge, edgeIndex) => {
    const sourceLayer = layerByKey[edge.source];
    const targetLayer = layerByKey[edge.target];
    const span = targetLayer - sourceLayer;
    const routeItems: LayoutItem[] = [];

    if (span <= 1) {
      segments.push(edge);
      routes.push({
        edgeId: `${edge.originalSource}-->${edge.originalTarget}`,
        source: edge.originalSource,
        target: edge.originalTarget,
        items: routeItems,
        reversedForLayout: edge.reversedForLayout,
      });
      return;
    }

    let previous = edge.source;
    for (let layer = sourceLayer + 1; layer < targetLayer; layer += 1) {
      const dummyId = `__sugiyama_dummy_${edgeIndex}_${layer}__`;
      const dummy: LayoutItem = { id: dummyId, layer, order: 0, dummyFor: `${edge.originalSource}-->${edge.originalTarget}` };
      items.push(dummy);
      routeItems.push(dummy);
      segments.push({ ...edge, source: previous, target: dummyId });
      previous = dummyId;
    }

    segments.push({ ...edge, source: previous, target: edge.target });
    routes.push({
      edgeId: `${edge.originalSource}-->${edge.originalTarget}`,
      source: edge.originalSource,
      target: edge.originalTarget,
      items: routeItems,
      reversedForLayout: edge.reversedForLayout,
    });
  });

  return { items, segments, routes };
}

function buildStableOrderByKey(dag: Record<NodeKey, unknown>, graph: VisibleGraph): Record<NodeKey, number> {
  const orderByKey: Record<NodeKey, number> = {};
  const visibleSet = graph.visibleSet;
  let index = 0;

  Object.keys(dag).forEach((key) => {
    if (visibleSet.has(key)) {
      orderByKey[key] = index;
      index += 1;
    }
  });

  graph.nodeKeys.forEach((key) => {
    if (orderByKey[key] === undefined) {
      orderByKey[key] = index;
      index += 1;
    }
  });

  return orderByKey;
}

function buildOriginalOrderById(items: LayoutItem[], stableOrderByKey: Record<NodeKey, number>): Record<NodeKey, number> {
  const originalOrderById: Record<NodeKey, number> = {};
  const fallbackOffset = Object.keys(stableOrderByKey).length;
  items.forEach((item, index) => {
    originalOrderById[item.id] = item.realKey ? stableOrderByKey[item.realKey] : fallbackOffset + index;
  });
  return originalOrderById;
}

function buildLayers(items: LayoutItem[], originalOrderById: Record<NodeKey, number>): Map<number, LayoutItem[]> {
  const layers = new Map<number, LayoutItem[]>();
  items.forEach((item) => {
    if (!layers.has(item.layer)) {
      layers.set(item.layer, []);
    }
    layers.get(item.layer)!.push(item);
  });

  layers.forEach((layerItems) => {
    layerItems.sort((leftItem, rightItem) => originalOrderById[leftItem.id] - originalOrderById[rightItem.id]);
  });
  refreshItemOrders(layers);
  return layers;
}

function reduceCrossings(layers: Map<number, LayoutItem[]>, segments: LayoutEdge[], originalOrder: Record<NodeKey, number>): void {
  const sortedLayerIndexes = Array.from(layers.keys()).sort((a, b) => a - b);
  if (sortedLayerIndexes.length < 2) {
    return;
  }

  const crossingIndex = buildCrossingIndex(layers, segments);
  let bestSnapshot = snapshotLayerOrdering(layers);
  let bestCrossings = countTotalCrossings(layers, crossingIndex);

  for (let pass = 0; pass < CROSSING_REDUCTION_MAX_PASSES; pass += 1) {
    let changed = false;

    sortedLayerIndexes.forEach((layer) => {
      if (layer === sortedLayerIndexes[0]) {
        return;
      }
      const layerItems = layers.get(layer);
      if (!layerItems) {
        return;
      }
      changed = sortLayerByNeighbors(layerItems, crossingIndex.incoming, crossingIndex, originalOrder) || changed;
      refreshItemOrders(layers);
      changed = transposeLayer(layers, layer, crossingIndex) || changed;
    });

    [...sortedLayerIndexes].reverse().forEach((layer) => {
      if (layer === sortedLayerIndexes[sortedLayerIndexes.length - 1]) {
        return;
      }
      const layerItems = layers.get(layer);
      if (!layerItems) {
        return;
      }
      changed = sortLayerByNeighbors(layerItems, crossingIndex.outgoing, crossingIndex, originalOrder) || changed;
      refreshItemOrders(layers);
      changed = transposeLayer(layers, layer, crossingIndex) || changed;
    });

    const nextCrossings = countTotalCrossings(layers, crossingIndex);
    if (nextCrossings < bestCrossings) {
      bestCrossings = nextCrossings;
      bestSnapshot = snapshotLayerOrdering(layers);
    }
    if (!changed) {
      break;
    }
  }

  restoreLayerOrdering(layers, bestSnapshot);
  refreshItemOrders(layers);
}

function buildCrossingIndex(layers: Map<number, LayoutItem[]>, segments: LayoutEdge[]): CrossingIndex {
  const layerById: Record<NodeKey, number> = {};
  const itemById: Record<NodeKey, LayoutItem> = {};
  layers.forEach((layerItems, layer) => {
    layerItems.forEach((item) => {
      layerById[item.id] = layer;
      itemById[item.id] = item;
    });
  });

  const incoming: Record<NodeKey, NodeKey[]> = {};
  const outgoing: Record<NodeKey, NodeKey[]> = {};
  const segmentsByUpperLayer = new Map<number, LayerSegment[]>();

  segments.forEach((edge) => {
    const sourceLayer = layerById[edge.source];
    const targetLayer = layerById[edge.target];
    if (sourceLayer === undefined || targetLayer === undefined || targetLayer !== sourceLayer + 1) {
      return;
    }

    if (!incoming[edge.target]) {
      incoming[edge.target] = [];
    }
    if (!outgoing[edge.source]) {
      outgoing[edge.source] = [];
    }
    incoming[edge.target].push(edge.source);
    outgoing[edge.source].push(edge.target);

    if (!segmentsByUpperLayer.has(sourceLayer)) {
      segmentsByUpperLayer.set(sourceLayer, []);
    }
    segmentsByUpperLayer.get(sourceLayer)!.push({ source: edge.source, target: edge.target });
  });

  return { incoming, outgoing, segmentsByUpperLayer, itemById };
}

function sortLayerByNeighbors(
  layerItems: LayoutItem[],
  neighborMap: Record<NodeKey, NodeKey[]>,
  crossingIndex: CrossingIndex,
  originalOrder: Record<NodeKey, number>,
): boolean {
  const previousOrder = layerItems.map((item) => item.id);
  layerItems.sort((leftItem, rightItem) => {
    const leftScore = getNeighborScore(leftItem.id, neighborMap, crossingIndex);
    const rightScore = getNeighborScore(rightItem.id, neighborMap, crossingIndex);
    if (leftScore.median !== rightScore.median) {
      return leftScore.median - rightScore.median;
    }
    if (leftScore.average !== rightScore.average) {
      return leftScore.average - rightScore.average;
    }
    return originalOrder[leftItem.id] - originalOrder[rightItem.id];
  });
  return previousOrder.some((itemId, index) => itemId !== layerItems[index].id);
}

function getNeighborScore(
  itemId: NodeKey,
  neighborMap: Record<NodeKey, NodeKey[]>,
  crossingIndex: CrossingIndex,
): { median: number; average: number } {
  const orders = (neighborMap[itemId] || []).map((neighborKey) => getItemOrder(neighborKey, crossingIndex)).sort((leftValue, rightValue) => leftValue - rightValue);
  if (!orders.length) {
    const ownOrder = getItemOrder(itemId, crossingIndex);
    return { median: ownOrder, average: ownOrder };
  }

  const middle = Math.floor(orders.length / 2);
  const median = orders.length % 2 === 0 ? (orders[middle - 1] + orders[middle]) / 2 : orders[middle];
  const average = orders.reduce((sum, order) => sum + order, 0) / orders.length;
  return { median, average };
}

function transposeLayer(layers: Map<number, LayoutItem[]>, layer: number, crossingIndex: CrossingIndex): boolean {
  const layerItems = layers.get(layer);
  if (!layerItems || layerItems.length < 2) {
    return false;
  }

  let changed = false;
  let improved = true;
  while (improved) {
    improved = false;
    for (let index = 0; index < layerItems.length - 1; index += 1) {
      const first = layerItems[index];
      const second = layerItems[index + 1];
      const delta = countAdjacentSwapCrossingDelta(first.id, second.id, crossingIndex);
      if (delta < 0) {
        layerItems[index] = second;
        layerItems[index + 1] = first;
        second.order = index;
        first.order = index + 1;
        changed = true;
        improved = true;
      }
    }
  }
  return changed;
}

function countAdjacentSwapCrossingDelta(firstId: NodeKey, secondId: NodeKey, crossingIndex: CrossingIndex): number {
  return (
    countNeighborSwapDelta(crossingIndex.incoming[firstId] || [], crossingIndex.incoming[secondId] || [], crossingIndex) +
    countNeighborSwapDelta(crossingIndex.outgoing[firstId] || [], crossingIndex.outgoing[secondId] || [], crossingIndex)
  );
}

function countNeighborSwapDelta(firstNeighbors: NodeKey[], secondNeighbors: NodeKey[], crossingIndex: CrossingIndex): number {
  let before = 0;
  let after = 0;
  firstNeighbors.forEach((firstNeighbor) => {
    secondNeighbors.forEach((secondNeighbor) => {
      const difference = getItemOrder(firstNeighbor, crossingIndex) - getItemOrder(secondNeighbor, crossingIndex);
      if (difference > 0) {
        before += 1;
      } else if (difference < 0) {
        after += 1;
      }
    });
  });
  return after - before;
}

function countTotalCrossings(layers: Map<number, LayoutItem[]>, crossingIndex: CrossingIndex): number {
  const sortedLayerIndexes = Array.from(layers.keys()).sort((a, b) => a - b);
  let crossings = 0;
  for (let index = 0; index < sortedLayerIndexes.length - 1; index += 1) {
    crossings += countCrossingsBetweenLayerSegments(crossingIndex.segmentsByUpperLayer.get(sortedLayerIndexes[index]) || [], crossingIndex);
  }
  return crossings;
}

function countCrossingsBetweenLayerSegments(segments: LayerSegment[], crossingIndex: CrossingIndex): number {
  if (segments.length < 2) {
    return 0;
  }

  const orderedSegments = segments
    .map((edge) => ({ sourceOrder: getItemOrder(edge.source, crossingIndex), targetOrder: getItemOrder(edge.target, crossingIndex) }))
    .sort((leftEdge, rightEdge) => (leftEdge.sourceOrder === rightEdge.sourceOrder ? leftEdge.targetOrder - rightEdge.targetOrder : leftEdge.sourceOrder - rightEdge.sourceOrder));

  const maxTargetOrder = orderedSegments.reduce((maxOrder, edge) => Math.max(maxOrder, edge.targetOrder), 0);
  const tree = new FenwickTree(maxTargetOrder + 2);
  let crossings = 0;
  let processed = 0;

  for (let index = 0; index < orderedSegments.length;) {
    const sourceOrder = orderedSegments[index].sourceOrder;
    let nextIndex = index;
    while (nextIndex < orderedSegments.length && orderedSegments[nextIndex].sourceOrder === sourceOrder) {
      nextIndex += 1;
    }

    for (let groupIndex = index; groupIndex < nextIndex; groupIndex += 1) {
      const targetOrder = orderedSegments[groupIndex].targetOrder;
      crossings += processed - tree.sum(targetOrder + 1);
    }
    for (let groupIndex = index; groupIndex < nextIndex; groupIndex += 1) {
      tree.add(orderedSegments[groupIndex].targetOrder + 1, 1);
      processed += 1;
    }

    index = nextIndex;
  }

  return crossings;
}

function compactLayerPositions(layers: Map<number, LayoutItem[]>, crossingIndex: CrossingIndex): Map<NodeKey, number> {
  const positions = new Map<NodeKey, number>();
  layers.forEach((layerItems) => {
    layerItems.forEach((item, index) => {
      positions.set(item.id, index);
    });
  });

  let bestPositions = new Map(positions);
  let bestCost = measurePositionCost(crossingIndex, bestPositions);
  const sortedLayers = Array.from(layers.keys()).sort((a, b) => a - b);

  for (let pass = 0; pass < POSITION_COMPACTION_PASSES; pass += 1) {
    sortedLayers.forEach((layer) => {
      if (layer === sortedLayers[0]) {
        return;
      }
      const layerItems = layers.get(layer);
      if (!layerItems) {
        return;
      }
      adjustLayerPositions(layerItems, crossingIndex.incoming, positions);
    });

    [...sortedLayers].reverse().forEach((layer) => {
      if (layer === sortedLayers[sortedLayers.length - 1]) {
        return;
      }
      const layerItems = layers.get(layer);
      if (!layerItems) {
        return;
      }
      adjustLayerPositions(layerItems, crossingIndex.outgoing, positions);
    });

    const nextCost = measurePositionCost(crossingIndex, positions);
    if (nextCost < bestCost) {
      bestCost = nextCost;
      bestPositions = new Map(positions);
    }
  }

  return bestPositions;
}

function adjustLayerPositions(
  layerItems: LayoutItem[],
  neighborMap: Record<NodeKey, NodeKey[]>,
  positions: Map<NodeKey, number>,
): void {
  const desired = layerItems.map((item, index) => {
    const neighborPositions = (neighborMap[item.id] || []).map((neighborKey) => positions.get(neighborKey) ?? index).sort((leftValue, rightValue) => leftValue - rightValue);
    if (!neighborPositions.length) {
      return positions.get(item.id) ?? index;
    }
    const middle = Math.floor(neighborPositions.length / 2);
    return neighborPositions.length % 2 === 0
      ? (neighborPositions[middle - 1] + neighborPositions[middle]) / 2
      : neighborPositions[middle];
  });

  const resolved: number[] = [];
  desired.forEach((targetPosition, index) => {
    if (index === 0) {
      resolved.push(targetPosition);
      return;
    }
    resolved.push(Math.max(targetPosition, resolved[index - 1] + MIN_POSITION_GAP));
  });

  const first = resolved[0] ?? 0;
  resolved.forEach((position, index) => {
    positions.set(layerItems[index].id, position - first);
  });
}

function measurePositionCost(crossingIndex: CrossingIndex, positions: Map<NodeKey, number>): number {
  let total = 0;
  crossingIndex.segmentsByUpperLayer.forEach((segments) => {
    segments.forEach((segment) => {
      total += Math.abs((positions.get(segment.source) ?? 0) - (positions.get(segment.target) ?? 0));
    });
  });
  return total;
}

function applyCompactedPositions(layers: Map<number, LayoutItem[]>, positions: Map<NodeKey, number>): void {
  layers.forEach((layerItems) => {
    layerItems.forEach((item) => {
      item.order = positions.get(item.id) ?? item.order;
    });
  });
}

function snapshotLayerOrdering(layers: Map<number, LayoutItem[]>): Map<number, NodeKey[]> {
  const snapshot = new Map<number, NodeKey[]>();
  layers.forEach((layerItems, layer) => {
    snapshot.set(layer, layerItems.map((item) => item.id));
  });
  return snapshot;
}

function restoreLayerOrdering(layers: Map<number, LayoutItem[]>, snapshot: Map<number, NodeKey[]>): void {
  layers.forEach((layerItems, layer) => {
    const ids = snapshot.get(layer);
    if (!ids) {
      return;
    }
    const itemById = new Map(layerItems.map((item) => [item.id, item]));
    layers.set(layer, ids.map((itemId) => itemById.get(itemId)!).filter(Boolean));
  });
}

function refreshItemOrders(layers: Map<number, LayoutItem[]>): void {
  layers.forEach((layerItems) => refreshLayerOrder(layerItems));
}

function refreshLayerOrder(layerItems: LayoutItem[]): void {
  layerItems.forEach((item, order) => {
    item.order = order;
  });
}

function getItemOrder(itemId: NodeKey, crossingIndex: CrossingIndex): number {
  return crossingIndex.itemById[itemId]?.order ?? 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

class FenwickTree {
  private readonly values: number[];

  constructor(size: number) {
    this.values = new Array(size + 1).fill(0);
  }

  add(index: number, value: number): void {
    for (let cursor = index; cursor < this.values.length; cursor += cursor & -cursor) {
      this.values[cursor] += value;
    }
  }

  sum(index: number): number {
    let total = 0;
    for (let cursor = index; cursor > 0; cursor -= cursor & -cursor) {
      total += this.values[cursor];
    }
    return total;
  }
}
