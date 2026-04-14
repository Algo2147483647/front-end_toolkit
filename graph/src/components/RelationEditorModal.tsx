import { useEffect, useState } from "react";
import type { DagNode, NodeKey } from "../graph/types";
import { getRelationKeys, uniqueKeys } from "../graph/relations";

interface RelationEditorModalProps {
  open: boolean;
  nodeKey: NodeKey | null;
  field: "parents" | "children" | null;
  node: DagNode | null;
  onSave: (keys: NodeKey[]) => void;
  onClose: () => void;
}

export default function RelationEditorModal({ open, nodeKey, field, node, onSave, onClose }: RelationEditorModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && node && field) {
      setValue(getRelationKeys(node[field]).join("\n"));
      setError("");
    }
  }, [field, node, open]);

  if (!open || !nodeKey || !field) {
    return null;
  }

  return (
    <div id="relation-editor-modal" className="relation-editor-modal is-visible" aria-hidden="false" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="relation-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="relation-editor-title">
        <h3 id="relation-editor-title">{field === "parents" ? "Edit Parents" : "Edit Children"}</h3>
        <p id="relation-editor-description" className="relation-editor-description">Editing {field} for node {nodeKey}.</p>
        <textarea id="relation-editor-input" rows={10} spellCheck={false} value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
        <p className="relation-editor-hint">Enter one key per line, or separate keys with commas.</p>
        {error ? <p className="relation-editor-error">{error}</p> : null}
        <div className="relation-editor-actions">
          <button id="relation-editor-cancel" className="ghost-btn" type="button" onClick={onClose}>Cancel</button>
          <button
            id="relation-editor-save"
            className="primary-btn"
            type="button"
            onClick={() => {
              const keys = parseRelationInput(value);
              if (keys.includes(nodeKey)) {
                setError("A node cannot reference itself.");
                return;
              }
              onSave(keys);
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

export function parseRelationInput(rawText: string): NodeKey[] {
  return uniqueKeys(String(rawText || "").split(/[\n,]/));
}
