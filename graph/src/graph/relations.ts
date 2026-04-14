import { DEFAULT_RELATION_VALUE, type DagNode, type NodeKey, type NormalizedDag, type RelationField, type RelationValue } from "./types";

export function uniqueKeys(keys: Iterable<unknown>): NodeKey[] {
  return Array.from(
    new Set(
      Array.from(keys)
        .map((item) => String(item ?? "").trim())
        .filter(Boolean),
    ),
  );
}

export function normalizeRelationField(value: unknown): RelationField {
  if (Array.isArray(value)) {
    return uniqueKeys(value);
  }

  if (value && typeof value === "object") {
    const relationMap: Record<NodeKey, RelationValue> = {};
    Object.entries(value as Record<string, unknown>).forEach(([rawKey, rawValue]) => {
      const key = String(rawKey ?? "").trim();
      if (key) {
        relationMap[key] = coerceRelationValue(rawValue);
      }
    });
    return relationMap;
  }

  return {};
}

export function coerceRelationValue(value: unknown): RelationValue {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }
  return value === undefined ? DEFAULT_RELATION_VALUE : String(value);
}

export function getRelationKeys(relationValue: unknown): NodeKey[] {
  if (Array.isArray(relationValue)) {
    return uniqueKeys(relationValue);
  }

  if (relationValue && typeof relationValue === "object") {
    return Object.keys(relationValue).map((key) => key.trim()).filter(Boolean);
  }

  return [];
}

export function hasRelationKey(relationValue: unknown, key: NodeKey): boolean {
  const targetKey = key.trim();
  if (!targetKey) {
    return false;
  }
  if (Array.isArray(relationValue)) {
    return relationValue.includes(targetKey);
  }
  return Boolean(relationValue && typeof relationValue === "object" && Object.prototype.hasOwnProperty.call(relationValue, targetKey));
}

export function addRelation(node: DagNode, fieldName: "parents" | "children", relationKey: NodeKey, relationValue: RelationValue = DEFAULT_RELATION_VALUE): void {
  const targetKey = relationKey.trim();
  if (!targetKey) {
    return;
  }

  const currentValue = node[fieldName];
  if (Array.isArray(currentValue)) {
    if (!currentValue.includes(targetKey)) {
      node[fieldName] = [...currentValue, targetKey];
    }
    return;
  }

  const relationMap = currentValue && typeof currentValue === "object" ? { ...currentValue } as Record<NodeKey, RelationValue> : {};
  if (!Object.prototype.hasOwnProperty.call(relationMap, targetKey)) {
    relationMap[targetKey] = relationValue;
  }
  node[fieldName] = relationMap;
}

export function removeRelation(node: DagNode, fieldName: "parents" | "children", relationKey: NodeKey): void {
  const targetKey = relationKey.trim();
  if (!targetKey) {
    return;
  }

  const currentValue = node[fieldName];
  if (Array.isArray(currentValue)) {
    node[fieldName] = currentValue.filter((item) => item !== targetKey);
    return;
  }

  if (currentValue && typeof currentValue === "object") {
    const relationMap = { ...currentValue } as Record<NodeKey, RelationValue>;
    delete relationMap[targetKey];
    node[fieldName] = relationMap;
  }
}

export function renameRelation(node: DagNode, fieldName: "parents" | "children", oldKey: NodeKey, newKey: NodeKey): void {
  const sourceKey = oldKey.trim();
  const targetKey = newKey.trim();
  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return;
  }

  const currentValue = node[fieldName];
  if (Array.isArray(currentValue)) {
    node[fieldName] = uniqueKeys(currentValue.map((item) => (item === sourceKey ? targetKey : item)));
    return;
  }

  if (currentValue && typeof currentValue === "object" && Object.prototype.hasOwnProperty.call(currentValue, sourceKey)) {
    const relationMap = { ...currentValue } as Record<NodeKey, RelationValue>;
    const relation = relationMap[sourceKey];
    delete relationMap[sourceKey];
    if (!Object.prototype.hasOwnProperty.call(relationMap, targetKey)) {
      relationMap[targetKey] = relation;
    }
    node[fieldName] = relationMap;
  }
}

export function setRelations(node: DagNode, fieldName: "parents" | "children", keys: NodeKey[], defaultRelationValue: RelationValue = DEFAULT_RELATION_VALUE): void {
  const normalizedKeys = uniqueKeys(keys);
  const currentValue = node[fieldName];

  if (Array.isArray(currentValue)) {
    node[fieldName] = normalizedKeys;
    return;
  }

  const currentMap = currentValue && typeof currentValue === "object" ? currentValue as Record<NodeKey, RelationValue> : {};
  const nextMap: Record<NodeKey, RelationValue> = {};
  normalizedKeys.forEach((key) => {
    nextMap[key] = Object.prototype.hasOwnProperty.call(currentMap, key) ? currentMap[key] : defaultRelationValue;
  });
  node[fieldName] = nextMap;
}

export function ensureNodeExists(dag: NormalizedDag, nodeKey: NodeKey): DagNode {
  const key = nodeKey.trim();
  if (!dag[key]) {
    dag[key] = { key, define: "", parents: {}, children: {} };
  }
  return dag[key];
}

export function ensureReferencedNodes(dag: NormalizedDag, defaultRelationValue: RelationValue = DEFAULT_RELATION_VALUE): NormalizedDag {
  Object.keys(dag).forEach((nodeKey) => {
    const node = dag[nodeKey];
    node.key = nodeKey;
    node.children = normalizeRelationField(node.children);
    node.parents = normalizeRelationField(node.parents);
  });

  Object.keys(dag).forEach((nodeKey) => {
    const node = dag[nodeKey];
    getRelationKeys(node.children).forEach((childKey) => {
      const child = ensureNodeExists(dag, childKey);
      addRelation(child, "parents", nodeKey, defaultRelationValue);
    });
    getRelationKeys(node.parents).forEach((parentKey) => {
      const parent = ensureNodeExists(dag, parentKey);
      addRelation(parent, "children", nodeKey, defaultRelationValue);
    });
  });

  return dag;
}

export function syncBidirectionalRelations(dag: NormalizedDag, nodeKey: NodeKey, fieldName: "parents" | "children", nextKeys: NodeKey[]): void {
  const node = ensureNodeExists(dag, nodeKey);
  const oppositeField = fieldName === "parents" ? "children" : "parents";
  const previousKeys = getRelationKeys(node[fieldName]);
  const normalizedNextKeys = uniqueKeys(nextKeys).filter((key) => key !== nodeKey);

  setRelations(node, fieldName, normalizedNextKeys);

  previousKeys.forEach((relatedKey) => {
    if (!normalizedNextKeys.includes(relatedKey) && dag[relatedKey]) {
      removeRelation(dag[relatedKey], oppositeField, nodeKey);
    }
  });

  normalizedNextKeys.forEach((relatedKey) => {
    const relatedNode = ensureNodeExists(dag, relatedKey);
    addRelation(relatedNode, oppositeField, nodeKey);
  });
}
