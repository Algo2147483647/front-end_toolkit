import type { GraphLayoutMode, GraphMode, GraphSelection, NodeKey, NormalizedDag } from "../graph/types";

export interface EditTransaction {
  label: string;
  beforeDag: NormalizedDag;
  afterDag: NormalizedDag;
  beforeSelection: GraphSelection | null;
  afterSelection: GraphSelection | null;
  beforeNavigationHistory: GraphSelection[];
  afterNavigationHistory: GraphSelection[];
  revisionBefore: number;
  revisionAfter: number;
}

export interface GraphAppState {
  dag: NormalizedDag | null;
  source: {
    fileName: string;
    fileHandle: FileSystemFileHandle | null;
    dirty: boolean;
  };
  selection: GraphSelection | null;
  history: GraphSelection[];
  editHistory: {
    undoStack: EditTransaction[];
    redoStack: EditTransaction[];
    revision: number;
    savedRevision: number;
  };
  mode: GraphMode;
  layout: {
    mode: GraphLayoutMode;
  };
  zoom: {
    scale: number;
    minScale: number;
    maxScale: number;
  };
  ui: {
    status: string;
    settingsOpen: boolean;
    contextMenu: null | { x: number; y: number; nodeKey: NodeKey | null };
    relationEditor: null | { nodeKey: NodeKey; field: "parents" | "children" };
    nodeDetail: null | { nodeKey: NodeKey };
    saveDialogOpen: boolean;
  };
}

export const initialGraphAppState: GraphAppState = {
  dag: null,
  source: {
    fileName: "example.json",
    fileHandle: null,
    dirty: false,
  },
  selection: null,
  history: [],
  editHistory: {
    undoStack: [],
    redoStack: [],
    revision: 0,
    savedRevision: 0,
  },
  mode: "preview",
  layout: {
    mode: "bfs",
  },
  zoom: {
    scale: 1,
    minScale: 1,
    maxScale: 2,
  },
  ui: {
    status: "Loading example.json...",
    settingsOpen: false,
    contextMenu: null,
    relationEditor: null,
    nodeDetail: null,
    saveDialogOpen: false,
  },
};
