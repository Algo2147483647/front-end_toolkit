import type { StageData, StageEdge } from "../layout/types";

const SOURCE_EDGE_GAP = 4;
const TARGET_EDGE_GAP = 0;

interface GraphEdgeProps {
  stage: StageData;
  edge: StageEdge;
  interactiveKey: string | null;
}

export default function GraphEdge({ stage, edge, interactiveKey }: GraphEdgeProps) {
  const sourceNode = stage.nodeMap[edge.source];
  const targetNode = stage.nodeMap[edge.target];
  if (!sourceNode || !targetNode) {
    return null;
  }

  const startX = sourceNode.x + sourceNode.width / 2 + SOURCE_EDGE_GAP;
  const startY = sourceNode.y;
  const endX = targetNode.x - targetNode.width / 2 - TARGET_EDGE_GAP;
  const endY = targetNode.y;
  const horizontalSpan = Math.max(endX - startX, 24);
  const verticalSpan = Math.abs(endY - startY);
  const bendBase = Math.max(horizontalSpan * 0.58, Math.min(verticalSpan * 0.22, 96), 64);
  const bend = Math.min(bendBase, horizontalSpan - 12);
  const d = [`M ${startX} ${startY}`, `C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`].join(" ");
  const isConnected = interactiveKey ? edge.source === interactiveKey || edge.target === interactiveKey : false;
  const className = ["graph-edge", interactiveKey && !isConnected ? "is-dimmed" : "", isConnected ? "is-active" : ""].filter(Boolean).join(" ");

  return (
    <g className="graph-edge-group">
      <path className={className} d={d} data-source={edge.source} data-target={edge.target} markerEnd="url(#arrowhead)" />
      {edge.label ? <EdgeLabel label={edge.label} startX={startX} startY={startY} endX={endX} endY={endY} /> : null}
    </g>
  );
}

function EdgeLabel({ label, startX, startY, endX, endY }: { label: string; startX: number; startY: number; endX: number; endY: number }) {
  const labelX = (startX + endX) / 2;
  const labelY = (startY + endY) / 2 - 9;
  const labelWidth = Math.max(18, label.length * 7 + 10);

  return (
    <>
      <rect className="graph-edge-label-bg" x={labelX - labelWidth / 2} y={labelY - 10} width={labelWidth} height={16} rx={8} ry={8} />
      <text className="graph-edge-label" x={labelX} y={labelY + 1} textAnchor="middle">
        {label}
      </text>
    </>
  );
}
