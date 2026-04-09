import type { TimelineEvent } from './types';

export interface ConnectedState {
  connectedNodes: Set<string>;
}

export function collectConnectedState(nodeKey: string, eventMap: Map<string, TimelineEvent>): ConnectedState {
  const connectedNodes = new Set<string>([nodeKey]);
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
      connectedNodes.add(parentKey);
      queue.push(parentKey);
    });

    (currentEvent.kids || []).forEach(kidKey => {
      connectedNodes.add(kidKey);
      queue.push(kidKey);
    });
  }

  return { connectedNodes };
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
