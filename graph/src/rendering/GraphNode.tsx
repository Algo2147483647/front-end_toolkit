import type { KeyboardEvent } from "react";
import type { StageNode } from "../layout/types";
import { truncate, wrapDetailText } from "../layout/text";

const DETAIL_MAX_LINE_LENGTH = 48;
const DETAIL_MAX_LINES = 2;
const DETAIL_LINE_HEIGHT = 10;

interface GraphNodeProps {
  node: StageNode;
  rootKey: string;
  interactiveKey: string | null;
  connectedKeys: Set<string>;
  onClick: (key: string) => void;
  onContextMenu: (event: React.MouseEvent<SVGGElement>, key: string) => void;
  onHoverChange: (key: string | null) => void;
  onFocusChange: (key: string | null) => void;
}

export default function GraphNode({ node, rootKey, interactiveKey, connectedKeys, onClick, onContextMenu, onHoverChange, onFocusChange }: GraphNodeProps) {
  const isCurrent = interactiveKey === node.key;
  const isConnected = !interactiveKey || connectedKeys.has(node.key);
  const className = [
    "graph-node",
    node.isRoot ? "is-root" : "",
    node.key === rootKey || isCurrent ? "is-active" : "",
    isCurrent ? "is-hovered" : "",
    !isConnected ? "is-dimmed" : "",
  ].filter(Boolean).join(" ");
  const detailLines = wrapDetailText(node.detail, DETAIL_MAX_LINE_LENGTH, DETAIL_MAX_LINES);

  function handleKeyDown(event: KeyboardEvent<SVGGElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick(node.key);
    }
  }

  return (
    <g
      className={className}
      data-node-key={node.key}
      transform={`translate(${node.x - node.width / 2}, ${node.y - node.height / 2})`}
      tabIndex={0}
      role="button"
      aria-label={`${node.title}. ${node.detail}. ${node.isRoot ? "Current focus." : "Activate to focus this branch."}`}
      onClick={() => onClick(node.key)}
      onContextMenu={(event) => onContextMenu(event, node.key)}
      onMouseEnter={() => onHoverChange(node.key)}
      onMouseLeave={() => onHoverChange(null)}
      onFocus={() => onFocusChange(node.key)}
      onBlur={() => onFocusChange(null)}
      onKeyDown={handleKeyDown}
    >
      <ellipse className="graph-node__glow" cx={node.width / 2} cy={node.height / 2} rx={node.width / 2 + 16} ry={node.height / 2 + 10} />
      <rect className="graph-node__shape" width={node.width} height={node.height} rx={24} ry={24} />
      <circle className="graph-node__pin" cx={26} cy={node.height / 2} r={11} />
      <circle className="graph-node__pin-core" cx={26} cy={node.height / 2} r={4} />
      <text className="graph-node__title" x={48} y={29}>
        {truncate(node.title, 24)}
      </text>
      <text className="graph-node__detail" x={48} y={45}>
        {detailLines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={48} dy={index === 0 ? 0 : DETAIL_LINE_HEIGHT}>
            {line}
          </tspan>
        ))}
      </text>
      <g className="graph-node__affordance">
        <rect className="graph-node__affordance-bg" x={node.width - 90} y={node.height - 21} width={74} height={14} rx={7} ry={7} />
        <text className="graph-node__affordance-text" x={node.width - 53} y={node.height - 10} textAnchor="middle">
          {node.isRoot ? "Focused" : "Refocus"}
        </text>
      </g>
    </g>
  );
}
