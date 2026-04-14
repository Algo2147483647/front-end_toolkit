import type { DagNode, NodeKey, NormalizedDag, RelationValue } from "./types";
import { ensureReferencedNodes, getRelationKeys, removeRelation, renameRelation, syncBidirectionalRelations } from "./relations";
import { structuredCloneValue } from "./serialize";

export type GraphCommand =
  | { type: "renameNode"; oldKey: NodeKey; newKey: NodeKey }
  | { type: "deleteNode"; key: NodeKey }
  | { type: "deleteSubtree"; rootKey: NodeKey }
  | { type: "addNode"; key: NodeKey; parentKey?: NodeKey }
  | { type: "updateNodeFields"; key: NodeKey; nextKey?: NodeKey; fields: Record<string, unknown> }
  | { type: "setParents"; key: NodeKey; parents: NodeKey[] }
  | { type: "setChildren"; key: NodeKey; children: NodeKey[] };

export interface CommandResult {
  dag: NormalizedDag;
  changedKeys: NodeKey[];
  deletedKeys?: NodeKey[];
  renamedKey?: { from: NodeKey; to: NodeKey };
  message?: string;
}

export function applyGraphCommand(sourceDag: NormalizedDag, command: GraphCommand): CommandResult {
  const dag = structuredCloneValue(sourceDag);

  switch (command.type) {
    case "renameNode":
      return renameNode(dag, command.oldKey, command.newKey);
    case "deleteNode":
      return deleteNodes(dag, [command.key], `Deleted node ${command.key}.`);
    case "deleteSubtree":
      return deleteNodes(dag, collectSubtreeNodeKeys(dag, command.rootKey), `Deleted subtree rooted at ${command.rootKey}.`);
    case "addNode":
      return addNode(dag, command.key, command.parentKey);
    case "setParents":
      syncBidirectionalRelations(dag, command.key, "parents", command.parents);
      ensureReferencedNodes(dag);
      return { dag, changedKeys: [command.key, ...command.parents], message: `Updated parents for ${command.key}.` };
    case "setChildren":
      syncBidirectionalRelations(dag, command.key, "children", command.children);
      ensureReferencedNodes(dag);
      return { dag, changedKeys: [command.key, ...command.children], message: `Updated children for ${command.key}.` };
    case "updateNodeFields":
      return updateNodeFields(dag, command.key, command.nextKey || command.key, command.fields);
  }
}

function renameNode(dag: NormalizedDag, oldKey: NodeKey, newKey: NodeKey): CommandResult {
  const sourceKey = oldKey.trim();
  const targetKey = newKey.trim();
  assertValidNewKey(dag, targetKey, sourceKey);
  const nodeValue = dag[sourceKey];
  if (!nodeValue) {
    throw new Error(`Node "${sourceKey}" does not exist.`);
  }

  delete dag[sourceKey];
  dag[targetKey] = { ...nodeValue, key: targetKey };
  Object.keys(dag).forEach((nodeKey) => {
    renameRelation(dag[nodeKey], "parents", sourceKey, targetKey);
    renameRelation(dag[nodeKey], "children", sourceKey, targetKey);
  });
  ensureReferencedNodes(dag);
  return {
    dag,
    changedKeys: [targetKey],
    renamedKey: { from: sourceKey, to: targetKey },
    message: `Renamed node key from ${sourceKey} to ${targetKey}.`,
  };
}

function deleteNodes(dag: NormalizedDag, nodeKeys: NodeKey[], message: string): CommandResult {
  const deleteSet = new Set(nodeKeys.filter((nodeKey) => Boolean(dag[nodeKey])));
  if (!deleteSet.size) {
    throw new Error("No matching nodes were found.");
  }
  if (deleteSet.size >= Object.keys(dag).length) {
    throw new Error("At least one node must remain in the graph.");
  }

  deleteSet.forEach((nodeKey) => {
    delete dag[nodeKey];
  });

  Object.keys(dag).forEach((otherKey) => {
    deleteSet.forEach((deletedKey) => {
      removeRelation(dag[otherKey], "parents", deletedKey);
      removeRelation(dag[otherKey], "children", deletedKey);
    });
  });
  ensureReferencedNodes(dag);
  return { dag, changedKeys: Object.keys(dag), deletedKeys: Array.from(deleteSet), message };
}

export function collectSubtreeNodeKeys(dag: NormalizedDag, rootKey: NodeKey): NodeKey[] {
  if (!dag[rootKey]) {
    return [];
  }

  const visited = new Set<NodeKey>();
  const stack = [rootKey];
  while (stack.length) {
    const currentKey = stack.pop()!;
    if (visited.has(currentKey) || !dag[currentKey]) {
      continue;
    }
    visited.add(currentKey);
    getRelationKeys(dag[currentKey].children).forEach((childKey) => stack.push(childKey));
  }
  return Array.from(visited);
}

function addNode(dag: NormalizedDag, key: NodeKey, parentKey?: NodeKey): CommandResult {
  const nextKey = key.trim();
  assertValidNewKey(dag, nextKey);
  dag[nextKey] = { key: nextKey, define: "", parents: {}, children: {} };
  if (parentKey && dag[parentKey]) {
    syncBidirectionalRelations(dag, parentKey, "children", [...getRelationKeys(dag[parentKey].children), nextKey]);
  }
  ensureReferencedNodes(dag);
  return { dag, changedKeys: parentKey ? [nextKey, parentKey] : [nextKey], message: `Added node ${nextKey}.` };
}

function updateNodeFields(dag: NormalizedDag, oldKey: NodeKey, nextKey: NodeKey, fields: Record<string, unknown>): CommandResult {
  const sourceKey = oldKey.trim();
  const targetKey = nextKey.trim();
  assertValidNewKey(dag, targetKey, sourceKey);
  if (!dag[sourceKey]) {
    throw new Error(`Node "${sourceKey}" does not exist.`);
  }

  const nextNode = { ...fields, key: targetKey } as DagNode;
  nextNode.parents = normalizePatchRelation(nextNode.parents);
  nextNode.children = normalizePatchRelation(nextNode.children);
  if (getRelationKeys(nextNode.parents).includes(targetKey) || getRelationKeys(nextNode.children).includes(targetKey)) {
    throw new Error("A node cannot reference itself.");
  }

  const previousParentKeys = getRelationKeys(dag[sourceKey].parents);
  const previousChildKeys = getRelationKeys(dag[sourceKey].children);

  if (sourceKey !== targetKey) {
    delete dag[sourceKey];
    Object.keys(dag).forEach((nodeKey) => {
      renameRelation(dag[nodeKey], "parents", sourceKey, targetKey);
      renameRelation(dag[nodeKey], "children", sourceKey, targetKey);
    });
  }

  dag[targetKey] = nextNode;
  syncEditedNodeRelations(dag, targetKey, previousParentKeys, previousChildKeys, getRelationKeys(nextNode.parents), getRelationKeys(nextNode.children));
  ensureReferencedNodes(dag);

  return {
    dag,
    changedKeys: [targetKey],
    renamedKey: sourceKey === targetKey ? undefined : { from: sourceKey, to: targetKey },
    message: `Saved node ${targetKey}.`,
  };
}

function normalizePatchRelation(value: unknown): Record<NodeKey, RelationValue> | NodeKey[] {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)));
  }
  if (value && typeof value === "object") {
    const map: Record<NodeKey, RelationValue> = {};
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
      const key = rawKey.trim();
      if (key) {
        map[key] = typeof rawValue === "string" || typeof rawValue === "number" || typeof rawValue === "boolean" || rawValue === null ? rawValue : String(rawValue);
      }
    });
    return map;
  }
  return {};
}

function syncEditedNodeRelations(
  dag: NormalizedDag,
  nodeKey: NodeKey,
  previousParentKeys: NodeKey[],
  previousChildKeys: NodeKey[],
  nextParentKeys: NodeKey[],
  nextChildKeys: NodeKey[],
): void {
  previousParentKeys.forEach((parentKey) => {
    if (!nextParentKeys.includes(parentKey) && dag[parentKey]) {
      removeRelation(dag[parentKey], "children", nodeKey);
    }
  });
  previousChildKeys.forEach((childKey) => {
    if (!nextChildKeys.includes(childKey) && dag[childKey]) {
      removeRelation(dag[childKey], "parents", nodeKey);
    }
  });
  syncBidirectionalRelations(dag, nodeKey, "parents", nextParentKeys);
  syncBidirectionalRelations(dag, nodeKey, "children", nextChildKeys);
}

function assertValidNewKey(dag: NormalizedDag, key: NodeKey, currentKey?: NodeKey): void {
  if (!key) {
    throw new Error("Node key cannot be empty.");
  }
  if (key.includes("\n") || key.includes(",")) {
    throw new Error("Node key cannot contain commas or line breaks.");
  }
  if (key !== currentKey && Object.prototype.hasOwnProperty.call(dag, key)) {
    throw new Error(`Node key "${key}" already exists.`);
  }
}
