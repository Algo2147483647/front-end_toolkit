import type { NodeKey } from "../../graph/types";
import { getRelationKeys } from "../../graph/relations";

export interface LayoutGraphNode {
  children?: unknown;
}

export interface VisibleGraph {
  nodeKeys: NodeKey[];
  visibleSet: Set<NodeKey>;
  incoming: Record<NodeKey, NodeKey[]>;
  outgoing: Record<NodeKey, NodeKey[]>;
  orderByKey: Record<NodeKey, number>;
}

export function getExistingRoots(dag: Record<NodeKey, unknown>, roots: NodeKey[]): NodeKey[] {
  return Array.from(new Set(roots.filter((root) => Boolean(dag[root]))));
}

export function collectReachableFromRoots(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): Set<NodeKey> {
  return new Set(collectReachableInBfsOrder(dag, roots));
}

export function collectReachableInBfsOrder(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): NodeKey[] {
  const queue = getExistingRoots(dag, roots);
  const visited = new Set(queue);
  const nodeKeys: NodeKey[] = [];

  while (queue.length) {
    const key = queue.shift()!;
    const node = dag[key];
    if (!node) {
      continue;
    }
    nodeKeys.push(key);
    getRelationKeys(node.children).forEach((childKey) => {
      if (dag[childKey] && !visited.has(childKey)) {
        visited.add(childKey);
        queue.push(childKey);
      }
    });
  }

  return nodeKeys;
}

export function buildVisibleGraph(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): VisibleGraph {
  const nodeKeys = collectReachableInBfsOrder(dag, roots);
  const visibleSet = new Set(nodeKeys);
  const incoming: Record<NodeKey, NodeKey[]> = {};
  const outgoing: Record<NodeKey, NodeKey[]> = {};
  const orderByKey: Record<NodeKey, number> = {};

  nodeKeys.forEach((nodeKey, index) => {
    incoming[nodeKey] = [];
    outgoing[nodeKey] = [];
    orderByKey[nodeKey] = index;
  });

  nodeKeys.forEach((sourceKey) => {
    getRelationKeys(dag[sourceKey]?.children).forEach((targetKey) => {
      if (visibleSet.has(targetKey)) {
        outgoing[sourceKey].push(targetKey);
        incoming[targetKey].push(sourceKey);
      }
    });
  });

  return { nodeKeys, visibleSet, incoming, outgoing, orderByKey };
}
