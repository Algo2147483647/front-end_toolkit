export type TimelineTimeValue = string | number;

export interface TimelineNodeInput {
  key: string;
  time?: TimelineTimeValue[];
  space?: string[];
  data?: Record<string, unknown>;
  parents?: string[];
  kids?: string[];
  label?: string;
}

export interface TimelineEvent extends TimelineNodeInput {
  time: TimelineTimeValue[];
  space: string[];
  data: Record<string, unknown>;
  parents: string[];
  kids: string[];
  isTimeRange: boolean;
  startTime: number;
  endTime: number;
  startY: number;
  endY: number;
  title: string;
  timeLabel: string;
  locationLabel: string;
  width: number;
  x: number;
  branchRoots: string[];
  primaryBranchIndex: number;
  isSharedBranch: boolean;
}

export interface Margin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface StageMetrics {
  axisX: number;
  columnWidth: number;
  contentLeft: number;
  depthCount: number;
  depthGuides: number[];
  stageWidth: number;
  stageHeight: number;
  margin: Margin;
}

export interface YearTick {
  year: number;
  y: number;
  isMajor: boolean;
}

export interface TimelineEdge {
  id: string;
  source: string;
  target: string;
  path: string;
  stroke: string;
}

export interface TimelinePalette {
  fill: string;
  stroke: string;
  accent: string;
  glow: string;
  connector: string;
  badge: string;
}

export interface TimelineModel {
  events: TimelineEvent[];
  eventMap: Map<string, TimelineEvent>;
  roots: TimelineEvent[];
  minYear: number;
  maxYear: number;
  summary: string;
  stage: StageMetrics;
  yearTicks: YearTick[];
  edges: TimelineEdge[];
  timeRanges: TimelineEvent[];
  singlePoints: TimelineEvent[];
}

export interface PointGeometry {
  dotX: number;
  dotY: number;
  labelX: number;
}

export interface RangeGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BuildModelOptions {
  horizontalScale: number;
  verticalScale: number;
  sourceLabel: string;
}