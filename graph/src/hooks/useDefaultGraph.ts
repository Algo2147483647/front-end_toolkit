import { useEffect } from "react";
import { normalizeDagInput } from "../graph/normalize";
import { getInitialSelection } from "../graph/selectors";
import { loadDefaultSample } from "../adapters/sampleLoader";
import type { GraphAction } from "../state/graphActions";

export function useDefaultGraph(dispatch: React.Dispatch<GraphAction>): void {
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await loadDefaultSample("example.json");
        if (cancelled) {
          return;
        }
        const dag = normalizeDagInput(payload);
        const selection = getInitialSelection(dag);
        dispatch({
          type: "graphLoaded",
          dag,
          fileName: "example.json",
          fileHandle: null,
          selection,
          status: `${Object.keys(dag).length} nodes loaded from example.json.`,
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        console.error(error);
        dispatch({ type: "graphLoadFailed", status: "Unable to load example.json automatically. Please choose a JSON file." });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);
}
