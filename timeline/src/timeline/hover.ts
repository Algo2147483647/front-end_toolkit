import type { TimelineEvent } from './types';

export interface ConnectedState {
  connectedNodes: Set<string>;
  activeEdges: Set<string>;
}

export function collectConnectedState(nodeKey: string, eventMap: Map<string, TimelineEvent>): ConnectedState {
  const connectedNodes = new Set<string>([nodeKey]);
  const activeEdges = new Set<string>();
  const queue = [nodeKey];
  const visited = new Set<string>();

  while (queue.length) {
    const currentKey = queue.shift();
    if (!currentKey || visited.has(currentKey)) {
      continue;
    }

    visited.add(currentKey);
    const currentEvent = eventMap.get(currentKey);
    if (!currentEvent) {
      continue;
    }

    (currentEvent.parents || []).forEach(parentKey => {
      activeEdges.add(`${parentKey}-->${currentKey}`);
      connectedNodes.add(parentKey);
      queue.push(parentKey);
    });

    (currentEvent.kids || []).forEach(kidKey => {
      activeEdges.add(`${currentKey}-->${kidKey}`);
      connectedNodes.add(kidKey);
      queue.push(kidKey);
    });
  }

  return { connectedNodes, activeEdges };
}

export function getNodeStateClass(
  nodeKey: string,
  hoveredKey: string | null,
  connectedNodes: Set<string> | null,
): string {
  if (!hoveredKey || !connectedNodes) {
    return '';
  }

  const isCurrent = nodeKey === hoveredKey;
  const isConnected = connectedNodes.has(nodeKey);

  if (isCurrent) {
    return 'is-hovered is-active';
  }

  if (isConnected) {
    return 'is-linked';
  }

  return 'is-dimmed';
}

export function getEdgeStateClass(
  source: string,
  target: string,
  hoveredKey: string | null,
  connectedNodes: Set<string> | null,
  activeEdges: Set<string> | null,
): string {
  if (!hoveredKey || !connectedNodes || !activeEdges) {
    return '';
  }

  const edgeId = `${source}-->${target}`;
  const isActive = activeEdges.has(edgeId);
  const isLinked = connectedNodes.has(source) && connectedNodes.has(target);

  if (isActive) {
    return 'is-active';
  }

  if (isLinked) {
    return 'is-linked';
  }

  return 'is-dimmed';
}