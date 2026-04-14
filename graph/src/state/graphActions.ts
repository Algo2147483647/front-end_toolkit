import type { CommandResult } from "../graph/commands";
import type { GraphMode, GraphSelection, NormalizedDag, NodeKey } from "../graph/types";

export type GraphAction =
  | { type: "graphLoaded"; dag: NormalizedDag; fileName: string; fileHandle?: FileSystemFileHandle | null; selection: GraphSelection; status: string }
  | { type: "graphLoadFailed"; status: string }
  | { type: "graphCommandCommitted"; result: CommandResult; selection: GraphSelection | null; history: GraphSelection[]; status?: string }
  | { type: "selectionChanged"; selection: GraphSelection; pushHistory?: boolean }
  | { type: "navigateBack" }
  | { type: "modeChanged"; mode: GraphMode }
  | { type: "zoomChanged"; scale: number; minScale?: number }
  | { type: "settingsToggled"; open?: boolean }
  | { type: "contextMenuOpened"; x: number; y: number; nodeKey: NodeKey | null }
  | { type: "contextMenuClosed" }
  | { type: "relationEditorOpened"; nodeKey: NodeKey; field: "parents" | "children" }
  | { type: "nodeDetailOpened"; nodeKey: NodeKey }
  | { type: "modalClosed" }
  | { type: "saveDialogOpened" }
  | { type: "saveDialogClosed" }
  | { type: "saved"; status: string }
  | { type: "statusChanged"; status: string };
