function clearSVG() {
  svgElement.innerHTML = '';
}

function buildSvgDefs() {
  const defs = createSvgElement('defs');

  const marker = createSvgElement('marker', {
    id: 'timeline-arrowhead',
    orient: 'auto',
    markerWidth: 8,
    markerHeight: 8,
    refX: 7,
    refY: 4,
  });
  const markerPath = createSvgElement('path', {
    d: 'M 0 0 L 8 4 L 0 8 z',
    fill: '#7f94bd',
    'fill-opacity': 0.4,
  });
  marker.appendChild(markerPath);
  defs.appendChild(marker);

  const filter = createSvgElement('filter', {
    id: 'timeline-soft-glow',
    x: '-50%',
    y: '-50%',
    width: '200%',
    height: '200%',
  });
  const blur = createSvgElement('feGaussianBlur', { stdDeviation: 12 });
  filter.appendChild(blur);
  defs.appendChild(filter);

  return defs;
}

function drawStageBackdrop(stageMetrics) {
  const group = createSvgElement('g');

  const panel = createSvgElement('rect', {
    class: 'timeline-stage__panel',
    x: 28,
    y: 28,
    width: stageMetrics.stageWidth - 56,
    height: stageMetrics.stageHeight - 56,
    rx: 32,
    ry: 32,
  });
  group.appendChild(panel);

  const focus = createSvgElement('rect', {
    class: 'timeline-stage__focus',
    x: stageMetrics.contentLeft - 18,
    y: stageMetrics.margin.top - 24,
    width: stageMetrics.columnWidth * Math.max(stageMetrics.depthCount * 0.75, 3),
    height: stageMetrics.stageHeight - stageMetrics.margin.top - stageMetrics.margin.bottom + 48,
    rx: 26,
    ry: 26,
    filter: 'url(#timeline-soft-glow)',
  });
  group.appendChild(focus);

  stageMetrics.depthGuides.forEach((x, index) => {
    const guide = createSvgElement('line', {
      class: 'timeline-stage__depth-line',
      x1: x,
      y1: stageMetrics.margin.top - 14,
      x2: x,
      y2: stageMetrics.stageHeight - stageMetrics.margin.bottom + 14,
    });
    group.appendChild(guide);

    if (index < stageMetrics.depthGuides.length - 1) {
      const label = createSvgElement('text', {
        class: 'timeline-stage__depth-label',
        x: x + stageMetrics.columnWidth / 2,
        y: stageMetrics.margin.top - 28,
        'text-anchor': 'middle',
      });
      label.textContent = index === 0 ? 'ROOT' : `DEPTH ${index}`;
      group.appendChild(label);
    }
  });

  svgElement.appendChild(group);
}

function drawDagEdges(events, stageMetrics) {
  const eventMap = new Map(events.map(event => [event.key, event]));
  const edgeLayer = createSvgElement('g');

  events.forEach(sourceEvent => {
    (sourceEvent.kids || []).forEach(targetKey => {
      const targetEvent = eventMap.get(targetKey);
      if (!targetEvent) {
        return;
      }

      edgeLayer.appendChild(buildDagEdge(sourceEvent, targetEvent, stageMetrics));
    });
  });

  svgElement.appendChild(edgeLayer);
}

function buildDagEdge(sourceEvent, targetEvent, stageMetrics) {
  const group = createSvgElement('g', {
    class: 'timeline-edge-group',
    'data-edge-id': `${sourceEvent.key}-->${targetEvent.key}`,
  });

  const palette = getEventPalette(targetEvent);
  const sourceAnchor = getEventOutputAnchor(sourceEvent, targetEvent.startY, stageMetrics);
  const targetAnchor = getEventInputAnchor(targetEvent, sourceAnchor.y, stageMetrics);
  const bend = clamp((targetAnchor.x - sourceAnchor.x) * 0.45, 36, 96);
  const pathData = [
    `M ${sourceAnchor.x} ${sourceAnchor.y}`,
    `C ${sourceAnchor.x + bend} ${sourceAnchor.y}, ${targetAnchor.x - bend} ${targetAnchor.y}, ${targetAnchor.x} ${targetAnchor.y}`,
  ].join(' ');

  const glow = createSvgElement('path', {
    class: 'timeline-edge-glow',
    d: pathData,
  });
  group.appendChild(glow);

  const path = createSvgElement('path', {
    class: 'timeline-edge',
    d: pathData,
    'data-source': sourceEvent.key,
    'data-target': targetEvent.key,
    'marker-end': 'url(#timeline-arrowhead)',
    stroke: palette.connector,
  });
  group.appendChild(path);

  return group;
}

function drawTimeRanges(timeRanges, stageMetrics) {
  const layer = createSvgElement('g');
  timeRanges.forEach(event => {
    layer.appendChild(buildRangeEvent(event, stageMetrics));
  });
  svgElement.appendChild(layer);
}

function drawSinglePoints(singlePoints, stageMetrics) {
  const layer = createSvgElement('g');
  singlePoints.forEach(event => {
    layer.appendChild(buildPointEvent(event, stageMetrics));
  });
  svgElement.appendChild(layer);
}

function buildRangeEvent(event, stageMetrics) {
  const geometry = getRangeGeometry(event, stageMetrics);
  const palette = getEventPalette(event);
  const group = createSvgElement('g', {
    class: `timeline-event timeline-event--range${event.parents.length === 0 ? ' is-root' : ''}`,
    'data-node-key': event.key,
  });

  const glow = createSvgElement('rect', {
    class: 'timeline-event__glow',
    x: geometry.x - 10,
    y: geometry.y - 8,
    width: geometry.width + 20,
    height: geometry.height + 16,
    rx: 18,
    ry: 18,
    fill: palette.glow,
  });
  group.appendChild(glow);

  const shape = createSvgElement('rect', {
    class: 'timeline-event__shape',
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rx: 16,
    ry: 16,
    fill: palette.fill,
    stroke: palette.stroke,
    'stroke-width': 1.4,
  });
  group.appendChild(shape);

  const badgeWidth = Math.min(Math.max(event.branchRoots.length > 1 ? 78 : 62, event.timeLabel.length * 5 + 22), geometry.width - 18);
  const badge = createSvgElement('rect', {
    class: 'timeline-event__badge',
    x: geometry.x + 10,
    y: geometry.y + 10,
    width: badgeWidth,
    height: 18,
    rx: 9,
    ry: 9,
    fill: palette.badge,
    stroke: palette.stroke,
    'stroke-width': 0.7,
  });
  group.appendChild(badge);

  const badgeText = createSvgElement('text', {
    class: 'timeline-event__badge-text',
    x: geometry.x + 16,
    y: geometry.y + 22.5,
  });
  badgeText.textContent = event.branchRoots.length > 1 ? 'Shared branch' : truncateText(event.timeLabel, 14);
  group.appendChild(badgeText);

  const eyebrow = createSvgElement('text', {
    class: 'timeline-event__eyebrow',
    x: geometry.x + 12,
    y: geometry.y + 42,
  });
  eyebrow.textContent = truncateText(event.locationLabel, Math.max(Math.floor((geometry.width - 24) / 7), 14));
  group.appendChild(eyebrow);

  const title = createSvgElement('text', {
    class: 'timeline-event__title',
    x: geometry.x + 12,
    y: geometry.y + 60,
  });
  title.textContent = truncateText(event.title, Math.max(Math.floor((geometry.width - 24) / 6.2), 16));
  group.appendChild(title);

  if (geometry.height > 88) {
    const meta = createSvgElement('text', {
      class: 'timeline-event__meta',
      x: geometry.x + 12,
      y: geometry.y + 78,
    });
    meta.textContent = truncateText(`${event.parents.length} upstream / ${(event.kids || []).length} downstream`, Math.max(Math.floor((geometry.width - 24) / 6.8), 16));
    group.appendChild(meta);
  }

  attachEventInteractions(group, event);
  return group;
}

function buildPointEvent(event, stageMetrics) {
  const geometry = getPointGeometry(event, stageMetrics);
  const palette = getEventPalette(event);
  const titleWidth = Math.max(92, Math.min(250, event.title.length * 6.7 + 42));
  const pillWidth = Math.min(titleWidth, stageMetrics.stageWidth - geometry.labelX - stageMetrics.margin.right / 2);

  const group = createSvgElement('g', {
    class: `timeline-event timeline-event--point${event.parents.length === 0 ? ' is-root' : ''}`,
    'data-node-key': event.key,
  });

  const connector = createSvgElement('path', {
    class: 'timeline-axis__connector',
    d: `M ${stageMetrics.axisX + 8} ${geometry.dotY} C ${stageMetrics.axisX + 24} ${geometry.dotY}, ${geometry.dotX - 34} ${geometry.dotY}, ${geometry.dotX - 14} ${geometry.dotY}`,
    stroke: palette.connector,
  });
  group.appendChild(connector);

  const glow = createSvgElement('ellipse', {
    class: 'timeline-event__glow',
    cx: geometry.labelX + pillWidth / 2 - 8,
    cy: geometry.dotY,
    rx: pillWidth / 2 + 22,
    ry: 22,
    fill: palette.glow,
  });
  group.appendChild(glow);

  const pill = createSvgElement('rect', {
    class: 'timeline-event__pill',
    x: geometry.labelX,
    y: geometry.dotY - 18,
    width: pillWidth,
    height: 36,
    rx: 18,
    ry: 18,
    fill: palette.badge,
    stroke: palette.stroke,
    'stroke-width': 1.2,
  });
  group.appendChild(pill);

  const dot = createSvgElement('circle', {
    class: 'timeline-event__dot',
    cx: geometry.dotX,
    cy: geometry.dotY,
    r: 10,
    fill: '#ffffff',
    stroke: palette.stroke,
    'stroke-width': 1.4,
  });
  group.appendChild(dot);

  const dotCore = createSvgElement('circle', {
    class: 'timeline-event__dot-core',
    cx: geometry.dotX,
    cy: geometry.dotY,
    r: 4,
    fill: palette.accent,
  });
  group.appendChild(dotCore);

  const label = createSvgElement('text', {
    class: 'timeline-event__point-label',
    x: geometry.labelX + 14,
    y: geometry.dotY - 1,
  });
  label.textContent = truncateText(event.title, Math.max(Math.floor((pillWidth - 28) / 6.5), 12));
  group.appendChild(label);

  const meta = createSvgElement('text', {
    class: 'timeline-event__point-meta',
    x: geometry.labelX + 14,
    y: geometry.dotY + 13,
  });
  meta.textContent = truncateText(event.timeLabel, Math.max(Math.floor((pillWidth - 28) / 7), 12));
  group.appendChild(meta);

  attachEventInteractions(group, event);
  return group;
}

function getRangeGeometry(event, stageMetrics) {
  const x = stageMetrics.contentLeft + event.x * stageMetrics.columnWidth;
  const y = Math.min(event.startY, event.endY);
  const width = Math.max(event.width * stageMetrics.columnWidth - 8, 64);
  const height = Math.max(Math.abs(event.endY - event.startY), 42);

  return { x, y, width, height };
}

function getPointGeometry(event, stageMetrics) {
  const dotX = stageMetrics.contentLeft + event.x * stageMetrics.columnWidth + 18;
  return {
    dotX,
    dotY: event.startY,
    labelX: dotX + 18,
  };
}

function getEventOutputAnchor(event, referenceY, stageMetrics) {
  if (event.isTimeRange) {
    const geometry = getRangeGeometry(event, stageMetrics);
    return {
      x: geometry.x + geometry.width - 6,
      y: clamp(referenceY, geometry.y + 14, geometry.y + geometry.height - 14),
    };
  }

  const geometry = getPointGeometry(event, stageMetrics);
  return {
    x: geometry.dotX + 10,
    y: geometry.dotY,
  };
}

function getEventInputAnchor(event, referenceY, stageMetrics) {
  if (event.isTimeRange) {
    const geometry = getRangeGeometry(event, stageMetrics);
    return {
      x: geometry.x + 4,
      y: clamp(referenceY, geometry.y + 14, geometry.y + geometry.height - 14),
    };
  }

  const geometry = getPointGeometry(event, stageMetrics);
  return {
    x: geometry.dotX - 10,
    y: geometry.dotY,
  };
}

function attachEventInteractions(group, event) {
  group.addEventListener('mouseenter', domEvent => {
    window.TIMELINE_STATE.hoveredKey = event.key;
    ApplyHoverState(event.key);
    showEventCard(event, domEvent.clientX, domEvent.clientY);
  });

  group.addEventListener('mouseleave', () => {
    window.TIMELINE_STATE.hoveredKey = null;
    ApplyHoverState(null);
    hideEventCard();
  });

  group.addEventListener('mousemove', domEvent => {
    updateEventCardPosition(domEvent.clientX, domEvent.clientY);
  });
}

function collectConnectedState(nodeKey) {
  const eventMap = window.TIMELINE_STATE.eventMap || new Map();
  const connectedNodes = new Set([nodeKey]);
  const activeEdges = new Set();
  const queue = [nodeKey];
  const visited = new Set();

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

function ApplyHoverState(nodeKey) {
  const allNodes = document.querySelectorAll('.timeline-event');
  const allEdges = document.querySelectorAll('.timeline-edge');

  if (!nodeKey) {
    allNodes.forEach(node => {
      node.classList.remove('is-hovered', 'is-linked', 'is-active', 'is-dimmed');
    });
    allEdges.forEach(edge => {
      edge.classList.remove('is-linked', 'is-active', 'is-dimmed');
    });

    updateTimelineSummary(window.TIMELINE_STATE.baseSummary || 'Hover an event to trace its lineage.');
    return;
  }

  const { connectedNodes, activeEdges } = collectConnectedState(nodeKey);
  const event = window.TIMELINE_STATE.eventMap ? window.TIMELINE_STATE.eventMap.get(nodeKey) : null;

  allNodes.forEach(node => {
    const key = node.dataset.nodeKey;
    const isCurrent = key === nodeKey;
    const isConnected = connectedNodes.has(key);

    node.classList.toggle('is-hovered', isCurrent);
    node.classList.toggle('is-active', isCurrent);
    node.classList.toggle('is-linked', !isCurrent && isConnected);
    node.classList.toggle('is-dimmed', !isConnected);
  });

  allEdges.forEach(edge => {
    const edgeId = `${edge.dataset.source}-->${edge.dataset.target}`;
    const isActive = activeEdges.has(edgeId);
    const isLinked = connectedNodes.has(edge.dataset.source) && connectedNodes.has(edge.dataset.target);

    edge.classList.toggle('is-active', isActive);
    edge.classList.toggle('is-linked', !isActive && isLinked);
    edge.classList.toggle('is-dimmed', !isLinked);
  });

  if (event) {
    updateTimelineSummary(`${event.title} · ${event.timeLabel}. ${event.parents.length} upstream and ${(event.kids || []).length} downstream links are highlighted.`);
  }
}
