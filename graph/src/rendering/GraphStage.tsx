import { useMemo } from "react";
import type { StageData } from "../layout/types";
import GraphBackdrop from "./GraphBackdrop";
import GraphDefs from "./GraphDefs";
import GraphEdge from "./GraphEdge";
import GraphNode from "./GraphNode";

interface GraphStageProps {
  stage: StageData;
  hoveredKey: string | null;
  focusedKey: string | null;
  svgRef: React.RefObject<SVGSVGElement>;
  onNodeClick: (key: string) => void;
  onNodeContextMenu: (event: React.MouseEvent<SVGGElement>, key: string) => void;
  onHoverChange: (key: string | null) => void;
  onFocusChange: (key: string | null) => void;
}

export default function GraphStage({ stage, hoveredKey, focusedKey, svgRef, onNodeClick, onNodeContextMenu, onHoverChange, onFocusChange }: GraphStageProps) {
  const interactiveKey = hoveredKey || focusedKey;
  const connectedKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!interactiveKey) {
      return keys;
    }
    keys.add(interactiveKey);
    stage.edges.forEach((edge) => {
      if (edge.source === interactiveKey || edge.target === interactiveKey) {
        keys.add(edge.source);
        keys.add(edge.target);
      }
    });
    return keys;
  }, [interactiveKey, stage.edges]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${stage.stageWidth} ${stage.stageHeight}`}
      width={stage.stageWidth}
      height={stage.stageHeight}
      role="img"
      aria-label={`DAG view focused on ${stage.selection.label}`}
    >
      <GraphDefs />
      <GraphBackdrop stage={stage} />
      <g className="graph-edge-layer">
        {stage.edges.map((edge) => (
          <GraphEdge key={edge.id} stage={stage} edge={edge} interactiveKey={interactiveKey} />
        ))}
      </g>
      <g className="graph-node-layer">
        {stage.nodes.map((node) => (
          <GraphNode
            key={node.key}
            node={node}
            rootKey={stage.root}
            interactiveKey={interactiveKey}
            connectedKeys={connectedKeys}
            onClick={onNodeClick}
            onContextMenu={onNodeContextMenu}
            onHoverChange={onHoverChange}
            onFocusChange={onFocusChange}
          />
        ))}
      </g>
    </svg>
  );
}
