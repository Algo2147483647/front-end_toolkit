import type { NodeKey } from "../../graph/types";
import { getRelationKeys } from "../../graph/relations";
import type { LayoutResult } from "../types";
import { getExistingRoots, type LayoutGraphNode } from "./shared";

export function buildBfsLayout(dag: Record<NodeKey, LayoutGraphNode | undefined>, roots: NodeKey[]): LayoutResult {
  const coordinates: LayoutResult["coordinates"] = new Map();
  const queue = getExistingRoots(dag, roots);
  const visited = new Set(queue);
  let level = -1;

  while (queue.length) {
    const levelCount = queue.length;
    level += 1;
    for (let index = 0; index < levelCount; index += 1) {
      const key = queue.shift()!;
      const node = dag[key];
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

  return { coordinates, warnings: [] };
}
