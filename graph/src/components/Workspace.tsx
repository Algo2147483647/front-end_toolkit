import GraphStage from "../rendering/GraphStage";
import type { StageData } from "../layout/types";
import EmptyState from "./EmptyState";

interface WorkspaceProps {
  containerRef: React.RefObject<HTMLDivElement>;
  svgRef: React.RefObject<SVGSVGElement>;
  stage: StageData | null;
  status: string;
  sidebar: React.ReactNode;
  sidebarOpen: boolean;
  sidebarWidth: number;
  onInitializeCanvas: () => void;
  hoveredKey: string | null;
  focusedKey: string | null;
  onNodeClick: (key: string) => void;
  onNodeContextMenu: (event: React.MouseEvent<SVGGElement>, key: string) => void;
  onHoverChange: (key: string | null) => void;
  onFocusChange: (key: string | null) => void;
  onScroll: () => void;
  onSidebarResizeStart: (event: React.PointerEvent<HTMLDivElement>) => void;
}

export default function Workspace({
  containerRef,
  svgRef,
  stage,
  status,
  sidebar,
  sidebarOpen,
  sidebarWidth,
  onInitializeCanvas,
  hoveredKey,
  focusedKey,
  onNodeClick,
  onNodeContextMenu,
  onHoverChange,
  onFocusChange,
  onScroll,
  onSidebarResizeStart,
}: WorkspaceProps) {
  return (
    <main id="workspace" className={`workspace${sidebarOpen ? " workspace--split" : ""}`}>
      <div className="workspace-split-shell">
        {sidebarOpen ? (
          <>
            <aside className="workspace-sidebar-shell" style={{ width: sidebarWidth }}>
              {sidebar}
            </aside>
            <div
              className="workspace-sidebar-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize console sidebar"
              onPointerDown={onSidebarResizeStart}
            />
          </>
        ) : null}
        <div className="workspace-stage-shell">
          <EmptyState message={status || "Loading graph data..."} hidden={Boolean(stage)} actionLabel="Initialize Canvas" onAction={onInitializeCanvas} />
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
        </div>
      </div>
    </main>
  );
}
