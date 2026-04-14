import { useEffect, useMemo, useState } from "react";
import type { DagNode, GraphMode, NodeKey } from "../graph/types";
import { getRelationKeys } from "../graph/relations";
import NodeFieldEditor, { buildEditableFields, formatEditorValue, parseNodeFieldValue } from "./NodeFieldEditor";

interface NodeDetailModalProps {
  open: boolean;
  nodeKey: NodeKey | null;
  node: DagNode | null;
  mode: GraphMode;
  onSave: (nextKey: NodeKey, fields: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function NodeDetailModal({ open, nodeKey, node, mode, onSave, onClose }: NodeDetailModalProps) {
  const fields = useMemo(() => node && nodeKey ? buildEditableFields(nodeKey, node) : [], [node, nodeKey]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValues(Object.fromEntries(fields.map((field) => [field.name, formatEditorValue(field)])));
      setError("");
    }
  }, [fields, open]);

  if (!open || !node || !nodeKey) {
    return null;
  }

  const rawJson = JSON.stringify({ [nodeKey]: buildSerializableNode(nodeKey, node) }, null, 2);

  return (
    <div id="node-detail-modal" className="node-detail-modal is-visible" aria-hidden="false" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="node-detail-page" role="dialog" aria-modal="true" aria-labelledby="node-detail-title">
        <div className="node-detail-header">
          <div className="node-detail-header-main">
            <div>
              <p className="node-detail-eyebrow">Node Viewer</p>
              <h3 id="node-detail-title">{nodeKey}</h3>
              <p id="node-detail-subtitle" className="node-detail-subtitle">
                {mode === "edit" ? `Editing ${fields.length} key-value pairs in this node.` : `Generic field view for ${fields.length} key-value pairs in this node.`}
              </p>
            </div>
          </div>
          <div className="node-detail-actions">
            {mode === "edit" ? <button id="node-detail-save" className="primary-btn node-detail-save-btn" type="button" onClick={handleSave}>Save</button> : null}
            <button id="node-detail-close" className="ghost-btn" type="button" onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="node-detail-body">
          <section className="node-detail-section">
            <h4>Node Fields</h4>
            <div id="node-detail-fields" className="node-detail-fields">
              {fields.length ? fields.map((field) => (
                <article key={field.name} className="node-detail-field">
                  <p className="node-detail-field__label">{field.name}</p>
                  <NodeFieldEditor
                    field={field}
                    mode={mode}
                    value={values[field.name] ?? ""}
                    onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))}
                  />
                </article>
              )) : <p className="node-detail-empty">No fields are available for this node.</p>}
              {error ? <p className="node-detail-error">{error}</p> : null}
            </div>
          </section>
          <section className="node-detail-section">
            <h4>Raw JSON</h4>
            <pre id="node-detail-json" className="node-detail-json">{rawJson}</pre>
          </section>
        </div>
      </div>
    </div>
  );

  function handleSave() {
    const nextKey = String(values.key || "").trim();
    if (!nextKey) {
      setError("Node key cannot be empty.");
      return;
    }
    if (nextKey.includes("\n") || nextKey.includes(",")) {
      setError("Node key cannot contain commas or line breaks.");
      return;
    }

    const patch: Record<string, unknown> = {};
    for (const field of fields) {
      if (field.name === "key") {
        continue;
      }
      const parsed = parseNodeFieldValue(field, values[field.name] ?? "");
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      patch[field.name] = parsed.value;
    }

    const nextParentKeys = getRelationKeys(patch.parents);
    const nextChildKeys = getRelationKeys(patch.children);
    if (nextParentKeys.includes(nextKey) || nextChildKeys.includes(nextKey)) {
      setError("A node cannot reference itself.");
      return;
    }
    onSave(nextKey, patch);
  }
}

function buildSerializableNode(nodeKey: NodeKey, node: DagNode): Record<string, unknown> {
  const clonedNode: Record<string, unknown> = { ...node };
  if (clonedNode.key === nodeKey) {
    delete clonedNode.key;
  }
  return clonedNode;
}
