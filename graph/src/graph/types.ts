export type NodeKey = string;

export type RelationValue = string | number | boolean | null;

export type RelationField = NodeKey[] | Record<NodeKey, RelationValue>;

export interface RawGraphNode {
  key?: NodeKey;
  label?: string;
  title?: string;
  name?: string;
  define?: string;
  parents?: RelationField;
  children?: RelationField;
  [field: string]: unknown;
}

export type RawGraphInput =
  | Record<NodeKey, RawGraphNode>
  | RawGraphNode[]
  | { nodes: RawGraphNode[] };

export interface DagNode extends RawGraphNode {
  key: NodeKey;
  parents: RelationField;
  children: RelationField;
}

export type NormalizedDag = Record<NodeKey, DagNode>;

export type GraphSelection =
  | { type: "node"; key: NodeKey }
  | { type: "full" }
  | { type: "forest"; keys: NodeKey[]; label: string };

export type GraphMode = "preview" | "edit";

export type GraphLayoutMode = "bfs" | "sugiyama";

export interface GraphTheme {
  stagePaddingX: number;
  stagePaddingY: number;
  columnGap: number;
  rowGap: number;
  nodeHeight: number;
  minNodeWidth: number;
  maxNodeWidth: number;
}

export const DEFAULT_GRAPH_THEME: GraphTheme = {
  stagePaddingX: 108,
  stagePaddingY: 88,
  columnGap: 116,
  rowGap: 22,
  nodeHeight: 74,
  minNodeWidth: 188,
  maxNodeWidth: 280,
};

export const DEFAULT_RELATION_VALUE: RelationValue = "related_to";
