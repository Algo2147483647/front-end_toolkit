import GraphStage from "../rendering/GraphStage";
import type { StageData } from "../layout/types";
import EmptyState from "./EmptyState";

interface WorkspaceProps {
  containerRef: React.RefObject<HTMLDivElement>;
  svgRef: React.RefObject<SVGSVGElement>;
  stage: StageData | null;
  status: string;
  hoveredKey: string | null;
  focusedKey: string | null;
  onNodeClick: (key: string) => void;
  onNodeContextMenu: (event: React.MouseEvent<SVGGElement>, key: string) => void;
  onHoverChange: (key: string | null) => void;
  onFocusChange: (key: string | null) => void;
  onScroll: () => void;
}

export default function Workspace({ containerRef, svgRef, stage, status, hoveredKey, focusedKey, onNodeClick, onNodeContextMenu, onHoverChange, onFocusChange, onScroll }: WorkspaceProps) {
  return (
    <main id="workspace" className="workspace">
      <EmptyState message={status || "Loading graph data..."} hidden={Boolean(stage)} />
      <div id="main-content" ref={containerRef} className={stage ? "is-ready" : ""} aria-live="polite" onScroll={onScroll}>
        {stage ? (
          <GraphStage
            stage={stage}
            hoveredKey={hoveredKey}
            focusedKey={focusedKey}
            svgRef={svgRef}
            onNodeClick={onNodeClick}
            onNodeContextMenu={onNodeContextMenu}
            onHoverChange={onHoverChange}
            onFocusChange={onFocusChange}
          />
        ) : null}
      </div>
    </main>
  );
}
