import type { StageData } from "../layout/types";

interface GraphBackdropProps {
  stage: StageData;
}

export default function GraphBackdrop({ stage }: GraphBackdropProps) {
  const rootNode = stage.nodeMap[stage.root];

  return (
    <g className="graph-stage">
      <rect className="graph-stage__halo" x={24} y={24} width={stage.stageWidth - 48} height={stage.stageHeight - 48} rx={28} ry={28} />
      {stage.lanes.map((lane) => (
        <g key={lane.layer}>
          <line className="graph-stage__lane" x1={lane.x} y1={54} x2={lane.x} y2={stage.stageHeight - 54} />
          <text className="graph-stage__lane-label" x={lane.x} y={42} textAnchor="middle">
            {lane.label}
          </text>
        </g>
      ))}
      {rootNode ? (
        <ellipse
          className="graph-stage__focus"
          cx={rootNode.x}
          cy={rootNode.y}
          rx={rootNode.width * 0.9}
          ry={92}
          filter="url(#soft-glow)"
        />
      ) : null}
    </g>
  );
}
