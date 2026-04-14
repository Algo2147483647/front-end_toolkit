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
  const routePoints = edge.points || [];
  const d = buildRoutedPath(startX, startY, routePoints, endX, endY);
  const labelPosition = getLabelPosition(startX, startY, routePoints, endX, endY);
  const isConnected = interactiveKey ? edge.source === interactiveKey || edge.target === interactiveKey : false;
  const className = ["graph-edge", interactiveKey && !isConnected ? "is-dimmed" : "", isConnected ? "is-active" : ""].filter(Boolean).join(" ");

  return (
    <g className="graph-edge-group">
      <path className={className} d={d} data-source={edge.source} data-target={edge.target} markerEnd="url(#arrowhead)" />
      {edge.label ? <EdgeLabel label={edge.label} x={labelPosition.x} y={labelPosition.y} /> : null}
    </g>
  );
}

function buildRoutedPath(startX: number, startY: number, points: { x: number; y: number }[], endX: number, endY: number): string {
  if (!points.length) {
    const horizontalSpan = Math.max(endX - startX, 24);
    const verticalSpan = Math.abs(endY - startY);
    const bendBase = Math.max(horizontalSpan * 0.58, Math.min(verticalSpan * 0.22, 96), 64);
    const bend = Math.min(bendBase, horizontalSpan - 12);
    return [`M ${startX} ${startY}`, `C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`].join(" ");
  }

  const route = [{ x: startX, y: startY }, ...points, { x: endX, y: endY }];
  const commands = [`M ${route[0].x} ${route[0].y}`];

  for (let index = 1; index < route.length; index += 1) {
    const previous = route[index - 1];
    const current = route[index];
    const span = current.x - previous.x;
    const bend = Math.max(Math.abs(span) * 0.5, 42);
    const direction = span >= 0 ? 1 : -1;
    const controlA = {
      x: previous.x + bend * direction,
      y: previous.y,
    };
    const controlB = {
      x: current.x - bend * direction,
      y: current.y,
    };
    commands.push(`C ${controlA.x} ${controlA.y}, ${controlB.x} ${controlB.y}, ${current.x} ${current.y}`);
  }

  return commands.join(" ");
}

function getLabelPosition(startX: number, startY: number, points: { x: number; y: number }[], endX: number, endY: number): { x: number; y: number } {
  if (!points.length) {
    return { x: (startX + endX) / 2, y: (startY + endY) / 2 - 9 };
  }

  const route = [{ x: startX, y: startY }, ...points, { x: endX, y: endY }];
  const midpoint = route[Math.floor(route.length / 2)];
  return { x: midpoint.x, y: midpoint.y - 9 };
}

function EdgeLabel({ label, x, y }: { label: string; x: number; y: number }) {
  const labelWidth = Math.max(18, label.length * 7 + 10);

  return (
    <>
      <rect className="graph-edge-label-bg" x={x - labelWidth / 2} y={y - 10} width={labelWidth} height={16} rx={8} ry={8} />
      <text className="graph-edge-label" x={x} y={y + 1} textAnchor="middle">
        {label}
      </text>
    </>
  );
}
