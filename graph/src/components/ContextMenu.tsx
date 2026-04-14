import type { GraphMode, NodeKey } from "../graph/types";

export type ContextMenuAction = "view-node" | "rename-node" | "delete-node" | "delete-subtree" | "edit-parents" | "edit-children" | "add-node";

interface ContextMenuProps {
  menu: null | { x: number; y: number; nodeKey: NodeKey | null };
  mode: GraphMode;
  onAction: (action: ContextMenuAction, nodeKey: NodeKey | null) => void;
}

const actions: Array<{ action: ContextMenuAction; label: string; requiresNode?: boolean; requiresEdit?: boolean }> = [
  { action: "view-node", label: "View Node", requiresNode: true },
  { action: "rename-node", label: "Rename Node Key", requiresNode: true, requiresEdit: true },
  { action: "delete-node", label: "Delete Node", requiresNode: true, requiresEdit: true },
  { action: "delete-subtree", label: "Delete Subtree", requiresNode: true, requiresEdit: true },
  { action: "edit-parents", label: "Edit Parents", requiresNode: true, requiresEdit: true },
  { action: "edit-children", label: "Edit Children", requiresNode: true, requiresEdit: true },
  { action: "add-node", label: "Add Node", requiresEdit: true },
];

export default function ContextMenu({ menu, mode, onAction }: ContextMenuProps) {
  const isVisible = Boolean(menu);
  const left = menu ? Math.max(8, menu.x) : 0;
  const top = menu ? Math.max(8, menu.y) : 0;

  return (
    <div id="node-context-menu" className={`node-context-menu${isVisible ? " is-visible" : ""}`} aria-hidden={!isVisible} style={{ left, top }}>
      {actions.map((item) => {
        const disabled = (item.requiresNode && !menu?.nodeKey) || (item.requiresEdit && mode !== "edit");
        return (
          <button
            key={item.action}
            type="button"
            className="context-menu-item"
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
