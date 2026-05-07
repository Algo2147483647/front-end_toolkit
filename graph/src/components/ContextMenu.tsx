import type { GraphMode, NodeKey } from "../graph/types";

export type ContextMenuAction = "view-node" | "copy-key" | "rename-node" | "delete-node" | "delete-subtree" | "edit-parents" | "edit-children" | "add-node" | "copy-node";

interface ContextMenuProps {
  menu: null | { x: number; y: number; nodeKey: NodeKey | null };
  mode: GraphMode;
  onAction: (action: ContextMenuAction, nodeKey: NodeKey | null) => void;
}

type ContextMenuEntry =
  | { type: "action"; action: ContextMenuAction; label: string; requiresNode?: boolean; requiresEdit?: boolean; tone?: "default" | "danger" }
  | { type: "divider" };

const entries: ContextMenuEntry[] = [
  { type: "action", action: "view-node", label: "View Node", requiresNode: true },
  { type: "action", action: "copy-key", label: "Copy Key", requiresNode: true },
  { type: "divider" },
  { type: "action", action: "copy-node", label: "Copy Node", requiresNode: true, requiresEdit: true },
  { type: "action", action: "add-node", label: "Add Child Node", requiresEdit: true },
  { type: "action", action: "edit-children", label: "Edit Children", requiresNode: true, requiresEdit: true },
  { type: "action", action: "edit-parents", label: "Edit Parents", requiresNode: true, requiresEdit: true },
  { type: "action", action: "rename-node", label: "Rename Node Key", requiresNode: true, requiresEdit: true },
  { type: "divider" },
  { type: "action", action: "delete-node", label: "Delete Node", requiresNode: true, requiresEdit: true, tone: "danger" },
  { type: "action", action: "delete-subtree", label: "Delete Subtree", requiresNode: true, requiresEdit: true, tone: "danger" },
];

export default function ContextMenu({ menu, mode, onAction }: ContextMenuProps) {
  const isVisible = Boolean(menu);
  const left = menu ? Math.max(8, menu.x) : 0;
  const top = menu ? Math.max(8, menu.y) : 0;

  return (
    <div id="node-context-menu" className={`node-context-menu${isVisible ? " is-visible" : ""}`} aria-hidden={!isVisible} style={{ left, top }}>
      {entries.map((item, index) => {
        if (item.type === "divider") {
          return <div key={`divider-${index}`} className="context-menu-divider" aria-hidden="true" />;
        }

        const disabled = (item.requiresNode && !menu?.nodeKey) || (item.requiresEdit && mode !== "edit");
        return (
          <button
            key={item.action}
            type="button"
            className={`context-menu-item${item.tone === "danger" ? " context-menu-item-danger" : ""}`}
            data-action={item.action}
            disabled={disabled}
            style={{ opacity: disabled ? 0.45 : 1 }}
            onClick={(event) => {
              event.stopPropagation();
              if (!disabled) {
                onAction(item.action, menu?.nodeKey || null);
              }
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
