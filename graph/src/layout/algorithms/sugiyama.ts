import type { NodeKey } from "../../graph/types";
import type { LayoutResult } from "../types";
import { buildVisibleGraph, getExistingRoots, type LayoutGraphNode } from "./shared";

const CROSSING_REDUCTION_PASSES = 6;

export function buildSugiyamaLayout(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): LayoutResult {
  const graph = buildVisibleGraph(dag, roots);
  const rootSet = new Set(getExistingRoots(dag, roots));
  const warnings: string[] = [];
  const warnedCycles = new Set<NodeKey>();
  const layerByKey: Record<NodeKey, number> = {};
  const visiting = new Set<NodeKey>();

  const warnCycle = (nodeKey: NodeKey) => {
    if (!warnedCycles.has(nodeKey)) {
      warnedCycles.add(nodeKey);
      warnings.push(`Sugiyama layout ignored a cycle touching "${nodeKey}".`);
    }
  };

  const rankNode = (nodeKey: NodeKey): number => {
    if (layerByKey[nodeKey] !== undefined) {
      return layerByKey[nodeKey];
    }
    if (rootSet.has(nodeKey)) {
      layerByKey[nodeKey] = 0;
      return 0;
    }
    if (visiting.has(nodeKey)) {
      warnCycle(nodeKey);
      return 0;
    }

    visiting.add(nodeKey);
    const parents = graph.incoming[nodeKey] || [];
    let layer = 0;
    parents.forEach((parentKey) => {
      if (visiting.has(parentKey)) {
        warnCycle(parentKey);
        return;
      }
      layer = Math.max(layer, rankNode(parentKey) + 1);
    });
    visiting.delete(nodeKey);
    layerByKey[nodeKey] = layer;
    return layer;
  };

  graph.nodeKeys.forEach((nodeKey) => {
    rankNode(nodeKey);
  });

  const layers = new Map<number, NodeKey[]>();
  graph.nodeKeys.forEach((nodeKey) => {
    const layer = layerByKey[nodeKey] ?? 0;
    if (!layers.has(layer)) {
      layers.set(layer, []);
    }
    layers.get(layer)!.push(nodeKey);
  });

  layers.forEach((layerNodes) => {
    layerNodes.sort((a, b) => graph.orderByKey[a] - graph.orderByKey[b]);
  });

  reduceCrossings(layers, graph.incoming, graph.outgoing, graph.orderByKey);

  const coordinates: LayoutResult["coordinates"] = new Map();
  Array.from(layers.keys()).sort((a, b) => a - b).forEach((layer) => {
    layers.get(layer)!.forEach((nodeKey, order) => {
      coordinates.set(nodeKey, [layer, order]);
    });
  });

  return { coordinates, warnings };
}

function reduceCrossings(
  layers: Map<number, NodeKey[]>,
  incoming: Record<NodeKey, NodeKey[]>,
  outgoing: Record<NodeKey, NodeKey[]>,
  originalOrder: Record<NodeKey, number>,
): void {
  const sortedLayerIndexes = Array.from(layers.keys()).sort((a, b) => a - b);
  const orderByKey: Record<NodeKey, number> = {};
  refreshOrderByKey(layers, orderByKey);

  for (let pass = 0; pass < CROSSING_REDUCTION_PASSES; pass += 1) {
    sortedLayerIndexes.forEach((layer) => {
      if (layer === sortedLayerIndexes[0]) {
        return;
      }
      sortLayerByNeighbors(layers.get(layer)!, incoming, orderByKey, originalOrder);
      refreshLayerOrder(layers.get(layer)!, orderByKey);
    });

    [...sortedLayerIndexes].reverse().forEach((layer) => {
      if (layer === sortedLayerIndexes[sortedLayerIndexes.length - 1]) {
        return;
      }
      sortLayerByNeighbors(layers.get(layer)!, outgoing, orderByKey, originalOrder);
      refreshLayerOrder(layers.get(layer)!, orderByKey);
    });
  }
}

function sortLayerByNeighbors(
  layerNodes: NodeKey[],
  neighborMap: Record<NodeKey, NodeKey[]>,
  orderByKey: Record<NodeKey, number>,
  originalOrder: Record<NodeKey, number>,
): void {
  layerNodes.sort((a, b) => {
    const aScore = getNeighborScore(a, neighborMap, orderByKey);
    const bScore = getNeighborScore(b, neighborMap, orderByKey);
    if (aScore !== bScore) {
      return aScore - bScore;
    }
    return originalOrder[a] - originalOrder[b];
  });
}

function getNeighborScore(nodeKey: NodeKey, neighborMap: Record<NodeKey, NodeKey[]>, orderByKey: Record<NodeKey, number>): number {
  const neighbors = (neighborMap[nodeKey] || []).filter((neighborKey) => orderByKey[neighborKey] !== undefined);
  if (!neighbors.length) {
    return orderByKey[nodeKey] ?? 0;
  }
  const total = neighbors.reduce((sum, neighborKey) => sum + orderByKey[neighborKey], 0);
  return total / neighbors.length;
}

function refreshOrderByKey(layers: Map<number, NodeKey[]>, orderByKey: Record<NodeKey, number>): void {
  layers.forEach((layerNodes) => refreshLayerOrder(layerNodes, orderByKey));
}

function refreshLayerOrder(layerNodes: NodeKey[], orderByKey: Record<NodeKey, number>): void {
  layerNodes.forEach((nodeKey, order) => {
    orderByKey[nodeKey] = order;
  });
}
