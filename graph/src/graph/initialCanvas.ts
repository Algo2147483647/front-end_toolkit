import { normalizeDagInput } from "./normalize";

export const INITIAL_CANVAS_NODE_KEY = "Initial_Node";
export const INITIAL_CANVAS_FILE_NAME = "untitled-graph.json";

export function createInitialCanvasDag() {
  return normalizeDagInput({
    [INITIAL_CANVAS_NODE_KEY]: {
      label: "Initial Node",
      define: "Start building your graph from this root node.",
      parents: {},
      children: {},
    },
  });
}
