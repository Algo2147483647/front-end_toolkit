import type {
  BuildModelOptions,
  Margin,
  PointGeometry,
  RangeGeometry,
  StageMetrics,
  TimelineEdge,
  TimelineEvent,
  TimelineModel,
  TimelineNodeInput,
  TimelineSpaceNormalized,
  TimelineTimeNormalized,
  YearTick,
} from './types';
import {
  areTimelineValuesEqual,
  clamp,
  formatEventLocation,
  formatTimeRange,
  formatYearLabel,
  getAdaptiveYearInterval,
  getEventPalette,
  getEventTitle,
  normalizeSpaceInput,
  normalizeTimeInput,
  parseTimelineYear,
} from './utils';

const DEFAULT_MARGIN: Margin = { top: 84, right: 120, bottom: 84, left: 190 };

type NormalizedNode = TimelineNodeInput & {
  key: string;
  time: TimelineTimeNormalized;
  space: TimelineSpaceNormalized;
  data: Record<string, unknown>;
  parents: string[];
  kids: string[];
};

function normalizeList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const deduped = new Set<string>();
  values.forEach(value => {
    const normalized = String(value || '').trim();
    if (normalized) {
      deduped.add(normalized);
    }
  });

  return [...deduped];
}

function normalizeNode(node: TimelineNodeInput, index: number): NormalizedNode {
  const key = String(node.key || '').trim() || `event_${index + 1}`;
  const time = normalizeTimeInput(node.time);
  const space = normalizeSpaceInput(node.space);
  const data = node.data && typeof node.data === 'object' ? node.data : {};

  return {
    ...node,
    key,
    time,
    space,
    data,
    parents: normalizeList(node.parents),
    kids: normalizeList(node.kids),
  };
}

function createYearScale(minYear: number, maxYear: number, margin: Margin, innerHeight: number): (year: number) => number {
  return year => {
    if (maxYear === minYear) {
      return margin.top + innerHeight / 2;
    }

    return margin.top + ((year - minYear) / (maxYear - minYear)) * innerHeight;
  };
}

function processEvents(nodes: NormalizedNode[], yearScale: (year: number) => number): TimelineEvent[] {
  return nodes.map(node => {
    const startTime = parseTimelineYear(node.time.start, 'start');
    const endTime = parseTimelineYear(node.time.end, 'end');
    const isTimeRange = !areTimelineValuesEqual(node.time.start, node.time.end);

    return {
      ...node,
      time: node.time,
      space: node.space,
      data: node.data || {},
      parents: [...(node.parents || [])],
      kids: [...(node.kids || [])],
      isTimeRange,
      startTime,
      endTime,
      startY: yearScale(startTime),
      endY: yearScale(endTime),
      title: getEventTitle(node),
      timeLabel: formatTimeRange(node.time),
      locationLabel: formatEventLocation(node.space),
      width: 1,
      x: 0,
      branchRoots: [],
      primaryBranchIndex: Number.NaN,
      isSharedBranch: false,
    };
  });
}

export function getRoots(events: TimelineEvent[]): TimelineEvent[] {
  const roots = events.filter(event => event.parents.length === 0 || event.parents[0] === '');
  roots.sort((a, b) => a.startTime - b.startTime);
  return roots;
}

export function alignParentChildRelationships(events: TimelineEvent[]): void {
  const eventMap = new Map(events.map(event => [event.key, event]));

  events.forEach(event => {
    event.parents = normalizeList(event.parents);
    event.kids = normalizeList(event.kids);
  });

  events.forEach(event => {
    event.parents.forEach(parentKey => {
      const parent = eventMap.get(parentKey);
      if (parent && !parent.kids.includes(event.key)) {
        parent.kids.push(event.key);
      }
    });

    event.kids.forEach(kidKey => {
      const kid = eventMap.get(kidKey);
      if (kid && !kid.parents.includes(event.key)) {
        kid.parents.push(event.key);
      }
    });
  });

  events.forEach(event => {
    event.parents = normalizeList(event.parents);
    event.kids = normalizeList(event.kids);
  });
}

function isConflict(a: TimelineEvent, b: TimelineEvent): boolean {
  const yOverlap = a.endTime >= b.startTime && a.startTime <= b.endTime;
  const xOverlap = a.x + a.width - 1 >= b.x && a.x <= b.x + b.width - 1;
  return yOverlap && xOverlap;
}

function findNonConflictingXPositionForEvent(event: TimelineEvent, positionedEvents: TimelineEvent[]): void {
  event.x = 0;

  let hasConflict: boolean;
  do {
    hasConflict = false;

    for (const item of positionedEvents) {
      if (isConflict(event, item)) {
        event.x = item.x + item.width;
        hasConflict = true;
        break;
      }
    }
  } while (hasConflict);
}

function processEventDFS(
  event: Pick<TimelineEvent, 'kids' | 'startTime' | 'endTime' | 'width' | 'x' | 'key'>,
  allEventsMap: Map<string, TimelineEvent>,
  positionedEvents: TimelineEvent[],
): void {
  const kids = [...(event.kids || [])];
  if (!kids.length) {
    const targetEvent = allEventsMap.get(event.key);
    if (targetEvent) {
      targetEvent.width = 1;
      findNonConflictingXPositionForEvent(targetEvent, positionedEvents);
      positionedEvents.push(targetEvent);
    }
    return;
  }

  kids.sort((a, b) => {
    const aEvent = allEventsMap.get(a);
    const bEvent = allEventsMap.get(b);
    return (aEvent?.startTime ?? Number.POSITIVE_INFINITY) - (bEvent?.startTime ?? Number.POSITIVE_INFINITY);
  });

  const positionedChildren: TimelineEvent[] = [];
  kids.forEach(kid => {
    const kidEvent = allEventsMap.get(kid);
    if (kidEvent) {
      processEventDFS(kidEvent, allEventsMap, positionedChildren);
    }
  });

  let width = 0;
  for (const child of positionedChildren) {
    if (child.x + child.width - 1 > width) {
      width = child.x + child.width - 1;
    }
  }

  const currentEvent = allEventsMap.get(event.key);
  if (!currentEvent) {
    return;
  }

  currentEvent.width = width + 2;
  findNonConflictingXPositionForEvent(currentEvent, positionedEvents);
  for (const child of positionedChildren) {
    child.x = child.x + currentEvent.x + 1;
  }

  positionedEvents.push(currentEvent);
  positionedEvents.push(...positionedChildren);
}

export function calculateHorizontalPositions(events: TimelineEvent[]): void {
  const allEventsMap = new Map(events.map(event => [event.key, event]));

  const virtualRoot = {
    key: 'virtualRoot',
    kids: getRoots(events).map(root => root.key),
    startTime: Number.NEGATIVE_INFINITY,
    endTime: Number.POSITIVE_INFINITY,
    width: 1,
    x: 0,
  };

  processEventDFS(virtualRoot, allEventsMap, []);
}

export function assignBranchMetadata(events: TimelineEvent[]): TimelineEvent[] {
  const eventMap = new Map<string, TimelineEvent>();
  events.forEach(event => {
    event.branchRoots = [];
    event.primaryBranchIndex = Number.NaN;
    eventMap.set(event.key, event);
  });

  const roots = getRoots(events);

  roots.forEach((root, rootIndex) => {
    const stack = [root.key];
    const visited = new Set<string>();

    while (stack.length) {
      const key = stack.pop();
      if (!key || visited.has(key)) {
        continue;
      }

      visited.add(key);
      const event = eventMap.get(key);
      if (!event) {
        continue;
      }

      if (!event.branchRoots.includes(root.key)) {
        event.branchRoots.push(root.key);
      }

      if (!Number.isFinite(event.primaryBranchIndex)) {
        event.primaryBranchIndex = rootIndex;
      }

      (event.kids || []).forEach(kidKey => {
        stack.push(kidKey);
      });
    }
  });

  events.forEach(event => {
    if (!Number.isFinite(event.primaryBranchIndex)) {
      event.primaryBranchIndex = 0;
    }

    event.isSharedBranch = event.branchRoots.length > 1;
  });

  return roots;
}

export function calculateStageMetrics(events: TimelineEvent[], margin: Margin, height: number, horizontalScale: number): StageMetrics {
  const gridUnits = events.reduce((maxUnits, event) => Math.max(maxUnits, event.x + event.width), 0);
  const depthCount = Math.max(gridUnits, 1);
  const columnWidth = horizontalScale;
  const axisX = margin.left;
  const contentLeft = axisX + 40;
  const contentRight = 280;
  const stageWidth = Math.max(1320, contentLeft + depthCount * columnWidth + contentRight + margin.right);
  const stageHeight = height;
  const depthGuides = Array.from({ length: depthCount + 1 }, (_, index) => contentLeft + index * columnWidth);

  return {
    axisX,
    columnWidth,
    contentLeft,
    depthCount,
    depthGuides,
    stageWidth,
    stageHeight,
    margin,
  };
}

export function getRangeGeometry(event: TimelineEvent, stage: StageMetrics): RangeGeometry {
  const x = stage.contentLeft + event.x * stage.columnWidth;
  const y = Math.min(event.startY, event.endY);
  const width = Math.max(event.width * stage.columnWidth - 8, 64);
  const height = Math.max(Math.abs(event.endY - event.startY), 42);

  return { x, y, width, height };
}

export function getPointGeometry(event: TimelineEvent, stage: StageMetrics): PointGeometry {
  const dotX = stage.contentLeft + event.x * stage.columnWidth + 18;
  return {
    dotX,
    dotY: event.startY,
    labelX: dotX + 18,
  };
}

function getEventOutputAnchor(event: TimelineEvent, referenceY: number, stage: StageMetrics): { x: number; y: number } {
  if (event.isTimeRange) {
    const geometry = getRangeGeometry(event, stage);
    return {
      x: geometry.x + geometry.width - 6,
      y: clamp(referenceY, geometry.y + 14, geometry.y + geometry.height - 14),
    };
  }

  const geometry = getPointGeometry(event, stage);
  return {
    x: geometry.dotX + 10,
    y: geometry.dotY,
  };
}

function getEventInputAnchor(event: TimelineEvent, referenceY: number, stage: StageMetrics): { x: number; y: number } {
  if (event.isTimeRange) {
    const geometry = getRangeGeometry(event, stage);
    return {
      x: geometry.x + 4,
      y: clamp(referenceY, geometry.y + 14, geometry.y + geometry.height - 14),
    };
  }

  const geometry = getPointGeometry(event, stage);
  return {
    x: geometry.dotX - 10,
    y: geometry.dotY,
  };
}

function buildDagEdges(events: TimelineEvent[], stage: StageMetrics): TimelineEdge[] {
  const eventMap = new Map(events.map(event => [event.key, event]));
  const edges: TimelineEdge[] = [];

  events.forEach(sourceEvent => {
    (sourceEvent.kids || []).forEach(targetKey => {
      const targetEvent = eventMap.get(targetKey);
      if (!targetEvent) {
        return;
      }

      const palette = getEventPalette(targetEvent);
      const sourceAnchor = getEventOutputAnchor(sourceEvent, targetEvent.startY, stage);
      const targetAnchor = getEventInputAnchor(targetEvent, sourceAnchor.y, stage);
      const bend = clamp((targetAnchor.x - sourceAnchor.x) * 0.45, 36, 96);
      const path = [
        `M ${sourceAnchor.x} ${sourceAnchor.y}`,
        `C ${sourceAnchor.x + bend} ${sourceAnchor.y}, ${targetAnchor.x - bend} ${targetAnchor.y}, ${targetAnchor.x} ${targetAnchor.y}`,
      ].join(' ');

      edges.push({
        id: `${sourceEvent.key}-->${targetEvent.key}`,
        source: sourceEvent.key,
        target: targetEvent.key,
        path,
        stroke: palette.connector,
      });
    });
  });

  return edges;
}

function separateEvents(events: TimelineEvent[]): { timeRanges: TimelineEvent[]; singlePoints: TimelineEvent[] } {
  const timeRanges = events.filter(event => event.isTimeRange);
  const singlePoints = events.filter(event => !event.isTimeRange);
  return { timeRanges, singlePoints };
}

function buildTimelineSummary(events: TimelineEvent[], roots: TimelineEvent[], minYear: number, maxYear: number, sourceLabel: string): string {
  const rangeCount = events.filter(event => event.isTimeRange).length;
  const pointCount = events.length - rangeCount;

  return `${sourceLabel}: ${events.length} events across ${roots.length} root branches, spanning ${formatYearLabel(minYear)} to ${formatYearLabel(maxYear)}. ${rangeCount} ranges and ${pointCount} milestone points are visible in this atlas.`;
}

function buildYearTicks(minYear: number, maxYear: number, yearScale: (year: number) => number): YearTick[] {
  const ticks: YearTick[] = [];
  const interval = getAdaptiveYearInterval(maxYear - minYear);
  let firstYear = Math.ceil(minYear / interval) * interval;
  if (firstYear > maxYear) {
    firstYear = Math.floor(minYear / interval) * interval;
  }

  for (let year = firstYear; year <= maxYear; year += interval) {
    const isMajor = year === 0 || year === firstYear || year + interval > maxYear;
    ticks.push({
      year,
      y: yearScale(year),
      isMajor,
    });
  }

  return ticks;
}

export function buildTimelineModel(nodes: TimelineNodeInput[], options: BuildModelOptions): TimelineModel | null {
  const normalized: NormalizedNode[] = nodes.map((node, index) => normalizeNode(node, index));
  if (!normalized.length) {
    return null;
  }

  const years = normalized.flatMap(event => {
    const start = parseTimelineYear(event.time.start, 'start');
    const end = parseTimelineYear(event.time.end, 'end');
    return [start, end];
  });

  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const yearRange = Math.max(maxYear - minYear, 1);
  const innerHeight = Math.max(yearRange * options.verticalScale, 120);
  const height = innerHeight + DEFAULT_MARGIN.top + DEFAULT_MARGIN.bottom;
  const yearScale = createYearScale(minYear, maxYear, DEFAULT_MARGIN, innerHeight);

  const events = processEvents(normalized, yearScale);
  alignParentChildRelationships(events);
  calculateHorizontalPositions(events);
  const roots = assignBranchMetadata(events);
  const stage = calculateStageMetrics(events, DEFAULT_MARGIN, height, options.horizontalScale);
  const yearTicks = buildYearTicks(minYear, maxYear, yearScale);
  const edges = buildDagEdges(events, stage);
  const { timeRanges, singlePoints } = separateEvents(events);

  return {
    events,
    eventMap: new Map(events.map(event => [event.key, event])),
    roots,
    minYear,
    maxYear,
    summary: buildTimelineSummary(events, roots, minYear, maxYear, options.sourceLabel || 'timeline data'),
    stage,
    yearTicks,
    edges,
    timeRanges,
    singlePoints,
  };
}
