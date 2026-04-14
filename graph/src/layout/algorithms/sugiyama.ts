import type { NodeKey } from "../../graph/types";
import type { LayoutEdgeRoute, LayoutResult } from "../types";
import { buildVisibleGraph, getExistingRoots, type LayoutGraphNode, type VisibleGraph } from "./shared";

const CROSSING_REDUCTION_PASSES = 6;

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

export function buildSugiyamaLayout(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): LayoutResult {
  const graph = buildVisibleGraph(dag, roots);
  const rootSet = new Set(getExistingRoots(dag, roots));
  const stableOrderByKey = buildStableOrderByKey(dag, graph);
  const layoutEdges = buildLayoutEdges(graph);
  const cycleResult = breakCyclesForLayout(graph.nodeKeys, layoutEdges);
  const layerByKey = assignLayers(graph.nodeKeys, cycleResult.edges, rootSet);
  const normalized = normalizeLongEdges(cycleResult.edges, layerByKey);
  const originalOrderById = buildOriginalOrderById(normalized.items, stableOrderByKey);
  const layers = buildLayers(normalized.items, originalOrderById);

  reduceCrossings(layers, normalized.segments, originalOrderById);
  refreshItemOrders(layers);

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

function breakCyclesForLayout(nodeKeys: NodeKey[], edges: LayoutEdge[]): { edges: LayoutEdge[]; warnings: string[] } {
  const outgoing = new Map<NodeKey, LayoutEdge[]>();
  nodeKeys.forEach((key) => outgoing.set(key, []));
  edges.forEach((edge) => outgoing.get(edge.source)?.push(edge));

  const visiting = new Set<NodeKey>();
  const visited = new Set<NodeKey>();
  const reversed = new Set<LayoutEdge>();
  const warnings: string[] = [];

  const visit = (nodeKey: NodeKey) => {
    visiting.add(nodeKey);
    for (const edge of outgoing.get(nodeKey) || []) {
      if (visiting.has(edge.target)) {
        reversed.add(edge);
        warnings.push(`Sugiyama layout reversed "${edge.source}" -> "${edge.target}" to break a visible cycle.`);
        continue;
      }
      if (!visited.has(edge.target)) {
        visit(edge.target);
      }
    }
    visiting.delete(nodeKey);
    visited.add(nodeKey);
  };

  nodeKeys.forEach((nodeKey) => {
    if (!visited.has(nodeKey)) {
      visit(nodeKey);
    }
  });

  const nextEdges = edges.map((edge) => {
    if (!reversed.has(edge)) {
      return edge;
    }
    return { ...edge, source: edge.target, target: edge.source, reversedForLayout: true };
  });

  return { edges: nextEdges, warnings };
}

function assignLayers(nodeKeys: NodeKey[], edges: LayoutEdge[], rootSet: Set<NodeKey>): Record<NodeKey, number> {
  const incoming = new Map<NodeKey, LayoutEdge[]>();
  nodeKeys.forEach((nodeKey) => incoming.set(nodeKey, []));
  edges.forEach((edge) => incoming.get(edge.target)?.push(edge));

  const layerByKey: Record<NodeKey, number> = {};
  const visiting = new Set<NodeKey>();

  const rankNode = (nodeKey: NodeKey): number => {
    if (layerByKey[nodeKey] !== undefined) {
      return layerByKey[nodeKey];
    }
    if (rootSet.has(nodeKey)) {
      layerByKey[nodeKey] = 0;
      return 0;
    }
    if (visiting.has(nodeKey)) {
      return 0;
    }

    visiting.add(nodeKey);
    let layer = 0;
    (incoming.get(nodeKey) || []).forEach((edge) => {
      layer = Math.max(layer, rankNode(edge.source) + 1);
    });
    visiting.delete(nodeKey);
    layerByKey[nodeKey] = layer;
    return layer;
  };

  nodeKeys.forEach((nodeKey) => {
    rankNode(nodeKey);
  });

  return layerByKey;
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
    layerItems.sort((a, b) => originalOrderById[a.id] - originalOrderById[b.id]);
  });
  refreshItemOrders(layers);
  return layers;
}

function reduceCrossings(layers: Map<number, LayoutItem[]>, segments: LayoutEdge[], originalOrder: Record<NodeKey, number>): void {
  const sortedLayerIndexes = Array.from(layers.keys()).sort((a, b) => a - b);
  if (sortedLayerIndexes.length < 2) {
    return;
  }

  const incoming = buildNeighborMap(segments, "incoming");
  const outgoing = buildNeighborMap(segments, "outgoing");
  let bestCrossings = countTotalCrossings(layers, segments);

  for (let pass = 0; pass < CROSSING_REDUCTION_PASSES; pass += 1) {
    [...sortedLayerIndexes].reverse().forEach((layer) => {
      if (layer === sortedLayerIndexes[sortedLayerIndexes.length - 1]) {
        return;
      }
      sortLayerByNeighbors(layers.get(layer)!, outgoing, getOrderById(layers), originalOrder);
      refreshItemOrders(layers);
      transposeLayer(layers, layer, segments);
    });

    sortedLayerIndexes.forEach((layer) => {
      if (layer === sortedLayerIndexes[0]) {
        return;
      }
      sortLayerByNeighbors(layers.get(layer)!, incoming, getOrderById(layers), originalOrder);
      refreshItemOrders(layers);
      transposeLayer(layers, layer, segments);
    });

    const nextCrossings = countTotalCrossings(layers, segments);
    if (nextCrossings >= bestCrossings) {
      if (nextCrossings === bestCrossings) {
        bestCrossings = nextCrossings;
      }
      break;
    }
    bestCrossings = nextCrossings;
  }
}

function buildNeighborMap(segments: LayoutEdge[], direction: "incoming" | "outgoing"): Record<NodeKey, NodeKey[]> {
  const neighbors: Record<NodeKey, NodeKey[]> = {};
  segments.forEach((edge) => {
    const key = direction === "incoming" ? edge.target : edge.source;
    const neighbor = direction === "incoming" ? edge.source : edge.target;
    if (!neighbors[key]) {
      neighbors[key] = [];
    }
    neighbors[key].push(neighbor);
  });
  return neighbors;
}

function sortLayerByNeighbors(
  layerItems: LayoutItem[],
  neighborMap: Record<NodeKey, NodeKey[]>,
  orderById: Record<NodeKey, number>,
  originalOrder: Record<NodeKey, number>,
): void {
  layerItems.sort((a, b) => {
    const aScore = getNeighborScore(a.id, neighborMap, orderById);
    const bScore = getNeighborScore(b.id, neighborMap, orderById);
    if (aScore.median !== bScore.median) {
      return aScore.median - bScore.median;
    }
    if (aScore.average !== bScore.average) {
      return aScore.average - bScore.average;
    }
    return originalOrder[a.id] - originalOrder[b.id];
  });
}

function getNeighborScore(
  itemId: NodeKey,
  neighborMap: Record<NodeKey, NodeKey[]>,
  orderById: Record<NodeKey, number>,
): { median: number; average: number } {
  const orders = (neighborMap[itemId] || []).map((neighborKey) => orderById[neighborKey]).filter((order) => order !== undefined).sort((a, b) => a - b);
  if (!orders.length) {
    const ownOrder = orderById[itemId] ?? 0;
    return { median: ownOrder, average: ownOrder };
  }

  const middle = Math.floor(orders.length / 2);
  const median = orders.length % 2 === 0 ? (orders[middle - 1] + orders[middle]) / 2 : orders[middle];
  const average = orders.reduce((sum, order) => sum + order, 0) / orders.length;
  return { median, average };
}

function transposeLayer(layers: Map<number, LayoutItem[]>, layer: number, segments: LayoutEdge[]): void {
  const layerItems = layers.get(layer);
  if (!layerItems || layerItems.length < 2) {
    return;
  }

  let improved = true;
  while (improved) {
    improved = false;
    for (let index = 0; index < layerItems.length - 1; index += 1) {
      const before = countCrossingsAroundLayer(layers, layer, segments);
      [layerItems[index], layerItems[index + 1]] = [layerItems[index + 1], layerItems[index]];
      refreshLayerOrder(layerItems);
      const after = countCrossingsAroundLayer(layers, layer, segments);
      if (after < before) {
        improved = true;
      } else {
        [layerItems[index], layerItems[index + 1]] = [layerItems[index + 1], layerItems[index]];
        refreshLayerOrder(layerItems);
      }
    }
  }
}

function countCrossingsAroundLayer(layers: Map<number, LayoutItem[]>, layer: number, segments: LayoutEdge[]): number {
  const previous = layers.get(layer - 1);
  const current = layers.get(layer);
  const next = layers.get(layer + 1);
  let crossings = 0;

  if (previous && current) {
    crossings += countCrossingsBetweenLayers(previous, current, segments);
  }
  if (current && next) {
    crossings += countCrossingsBetweenLayers(current, next, segments);
  }
  return crossings;
}

function countTotalCrossings(layers: Map<number, LayoutItem[]>, segments: LayoutEdge[]): number {
  const sortedLayerIndexes = Array.from(layers.keys()).sort((a, b) => a - b);
  let crossings = 0;
  for (let index = 0; index < sortedLayerIndexes.length - 1; index += 1) {
    const upper = layers.get(sortedLayerIndexes[index])!;
    const lower = layers.get(sortedLayerIndexes[index + 1])!;
    crossings += countCrossingsBetweenLayers(upper, lower, segments);
  }
  return crossings;
}

function countCrossingsBetweenLayers(upper: LayoutItem[], lower: LayoutItem[], segments: LayoutEdge[]): number {
  const upperOrder = Object.fromEntries(upper.map((item, index) => [item.id, index]));
  const lowerOrder = Object.fromEntries(lower.map((item, index) => [item.id, index]));
  const layerEdges = segments
    .filter((edge) => upperOrder[edge.source] !== undefined && lowerOrder[edge.target] !== undefined)
    .map((edge) => ({ sourceOrder: upperOrder[edge.source], targetOrder: lowerOrder[edge.target] }));

  let crossings = 0;
  for (let i = 0; i < layerEdges.length; i += 1) {
    for (let j = i + 1; j < layerEdges.length; j += 1) {
      const a = layerEdges[i];
      const b = layerEdges[j];
      if ((a.sourceOrder - b.sourceOrder) * (a.targetOrder - b.targetOrder) < 0) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

function refreshItemOrders(layers: Map<number, LayoutItem[]>): void {
  layers.forEach((layerItems) => refreshLayerOrder(layerItems));
}

function refreshLayerOrder(layerItems: LayoutItem[]): void {
  layerItems.forEach((item, order) => {
    item.order = order;
  });
}

function getOrderById(layers: Map<number, LayoutItem[]>): Record<NodeKey, number> {
  const orderById: Record<NodeKey, number> = {};
  layers.forEach((layerItems) => {
    layerItems.forEach((item) => {
      orderById[item.id] = item.order;
    });
  });
  return orderById;
}
