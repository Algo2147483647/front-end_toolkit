import type { DagNode, GraphSelection, NodeKey, RelationValue } from "../graph/types";

export interface StageNode {
  key: NodeKey;
  layer: number;
  order: number;
  title: string;
  detail: string;
  width: number;
  height: number;
  isRoot: boolean;
  x: number;
  y: number;
}

export interface StageEdge {
  id: string;
  source: NodeKey;
  target: NodeKey;
  weight: RelationValue | 1 | undefined;
  label: string;
}

export interface StageLane {
  layer: number;
  label: string;
  x: number;
  width: number;
}

export type LayoutCoordinate = [number, number];

export type LayoutCoordinateMap = Map<NodeKey, LayoutCoordinate>;

export interface LayoutResult {
  coordinates: LayoutCoordinateMap;
  warnings: string[];
}

export interface ResolvedStageSelection {
  rootKey: NodeKey;
  topLevelKeys: NodeKey[];
  isForest: boolean;
  label: string;
  appSelection: GraphSelection;
}

export interface StageData {
  dag: Record<NodeKey, DagNode & { synthetic?: boolean }>;
  root: NodeKey;
  selection: ResolvedStageSelection;
  topLevelKeys: NodeKey[];
  isForest: boolean;
  nodeMap: Record<NodeKey, StageNode>;
  nodes: StageNode[];
  edges: StageEdge[];
  lanes: StageLane[];
  stageWidth: number;
  stageHeight: number;
  warnings: string[];
}
