export type TimelineTimeValue = string | number;
export type TimelineTimeType = 'year' | 'year_month' | 'date' | 'datetime' | 'text';
export type TimelineSpaceType = 'latitude_and_longitude' | 'named_place' | 'bounding_box' | 'polygon' | 'multi_location';

export interface TimelineTimeInput {
  type?: TimelineTimeType | string;
  start?: TimelineTimeValue;
  end?: TimelineTimeValue;
}

export interface TimelineTimeNormalized {
  type: TimelineTimeType;
  start: TimelineTimeValue;
  end: TimelineTimeValue;
}

export interface TimelineSpaceInput {
  type?: TimelineSpaceType | string;
  named_place?: string;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  radius_km?: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  city?: string;
  site?: string;
  north?: number;
  south?: number;
  east?: number;
  west?: number;
  coordinates?: [number, number][];
  locations?: unknown[];
  location?: string;
}

export interface TimelineSpaceNormalized extends Omit<TimelineSpaceInput, 'type' | 'locations'> {
  type: TimelineSpaceType;
  locations?: TimelineSpaceNormalized[];
}

export type TimelineTimeValueInput = TimelineTimeInput | TimelineTimeValue[];
export type TimelineSpaceValueInput = TimelineSpaceInput | string[];

export interface TimelineNodeInput {
  key: string;
  time?: TimelineTimeValueInput;
  space?: TimelineSpaceValueInput;
  data?: Record<string, unknown>;
  parents?: string[];
  children?: string[];
  label?: string;
}

export interface TimelineEvent extends TimelineNodeInput {
  time: TimelineTimeNormalized;
  space: TimelineSpaceNormalized;
  data: Record<string, unknown>;
  parents: string[];
  children: string[];
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

export interface TimelinePalette {
  fill: string;
  stroke: string;
  accent: string;
  glow: string;
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
  scaleMode: TimeScaleMode;
}

export type TimeScaleMode = 'linear' | 'elastic';
