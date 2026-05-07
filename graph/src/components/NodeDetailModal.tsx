import { useEffect, useState } from "react";
import type { DagNode, GraphMode, NodeKey } from "../graph/types";
import { getRelationKeys } from "../graph/relations";
import NodeFieldEditor, { buildEditableFields, formatEditorValue, parseNodeFieldValue, type EditableField } from "./NodeFieldEditor";
import { buildRawNodeEditorValue, parseRawNodeEditorValue } from "./nodeDetailRawJson";

interface NodeDetailModalProps {
  open: boolean;
  nodeKey: NodeKey | null;
  node: DagNode | null;
  mode: GraphMode;
  initialFocus?: "fields" | "raw";
  onSave: (nextKey: NodeKey, fields: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function NodeDetailModal({ open, nodeKey, node, mode, initialFocus = "fields", onSave, onClose }: NodeDetailModalProps) {
  const [fields, setFields] = useState<EditableField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [rawJsonValue, setRawJsonValue] = useState("");
  const [lastEdited, setLastEdited] = useState<"fields" | "raw">("fields");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open && node && nodeKey) {
      const nextFields = buildEditableFields(nodeKey, node);
      setFields(nextFields);
      setValues(Object.fromEntries(nextFields.map((field) => [field.name, formatEditorValue(field)])));
      setRawJsonValue(buildRawNodeEditorValue(nodeKey, node));
      setLastEdited("fields");
      setError("");
    }
  }, [node, nodeKey, open]);

  useEffect(() => {
    if (!open || initialFocus !== "raw") {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      document.getElementById("node-detail-json")?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialFocus, open, nodeKey]);

  if (!open || !node || !nodeKey) {
    return null;
  }

  const currentNodeKey = nodeKey;
  const draftKey = String(values.key || currentNodeKey).trim() || currentNodeKey;

  return (
    <div id="node-detail-modal" className="node-detail-modal is-visible" aria-hidden="false" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="node-detail-page" role="dialog" aria-modal="true" aria-labelledby="node-detail-title">
        <div className="node-detail-header">
          <div className="node-detail-header-main">
            <div>
              <p className="node-detail-eyebrow">Node Viewer</p>
              <h3 id="node-detail-title">{draftKey}</h3>
              <p id="node-detail-subtitle" className="node-detail-subtitle">
                {mode === "edit"
                  ? `Editing ${Math.max(fields.length - 1, 0)} key-value pairs in this node. Raw JSON edits can also add or remove fields.`
                  : `Generic field view for ${Math.max(fields.length - 1, 0)} key-value pairs in this node.`}
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
                    onChange={(value) => handleFieldChange(field.name, value)}
                  />
                </article>
              )) : <p className="node-detail-empty">No fields are available for this node.</p>}
              {error ? <p className="node-detail-error">{error}</p> : null}
            </div>
          </section>
          <section className="node-detail-section">
            <h4>Raw JSON</h4>
            {mode === "edit" ? (
              <div className="node-detail-editor-wrap">
                <textarea
                  id="node-detail-json"
                  className="node-detail-editor node-detail-editor--textarea node-detail-editor--json"
                  rows={16}
                  spellCheck={false}
                  value={rawJsonValue}
                  onChange={(event) => handleRawJsonChange(event.currentTarget.value)}
                />
                <p className="node-detail-editor-hint">Edit a wrapped single-node JSON object here. Save uses this raw payload when it is the latest thing you changed.</p>
              </div>
            ) : (
              <pre id="node-detail-json" className="node-detail-json">{rawJsonValue}</pre>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  function handleFieldChange(fieldName: string, value: string) {
    const nextValues = { ...values, [fieldName]: value };
    setValues(nextValues);
    setLastEdited("fields");
    setError("");

    const nextRawJson = tryBuildRawJsonFromFieldValues(fields, nextValues, currentNodeKey);
    if (nextRawJson) {
      setRawJsonValue(nextRawJson);
    }
  }

  function handleRawJsonChange(nextRawJson: string) {
    setRawJsonValue(nextRawJson);
    setLastEdited("raw");
    setError("");

    const parsed = parseRawNodeEditorValue(nextRawJson, currentNodeKey);
    if (!parsed.ok) {
      return;
    }

    const nextFields = buildEditableFields(parsed.nextKey, { ...parsed.fields, key: parsed.nextKey });
    setFields(nextFields);
    setValues(Object.fromEntries(nextFields.map((field) => [field.name, formatEditorValue(field)])));
  }

  function handleSave() {
    if (lastEdited === "raw") {
      const parsed = parseRawNodeEditorValue(rawJsonValue, currentNodeKey);
      if (!parsed.ok) {
        setError(parsed.message);
        return;
      }
      if (!validateNodeRelations(parsed.nextKey, parsed.fields)) {
        setError("A node cannot reference itself.");
        return;
      }
      onSave(parsed.nextKey, parsed.fields);
      return;
    }

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

    if (!validateNodeRelations(nextKey, patch)) {
      setError("A node cannot reference itself.");
      return;
    }
    onSave(nextKey, patch);
  }
}

function tryBuildRawJsonFromFieldValues(
  fields: EditableField[],
  values: Record<string, string>,
  fallbackKey: NodeKey,
): string | null {
  const nextKey = String(values.key ?? fallbackKey).trim();
  if (!nextKey || nextKey.includes("\n") || nextKey.includes(",")) {
    return null;
  }

  const patch: Record<string, unknown> = {};
  for (const field of fields) {
    if (field.name === "key") {
      continue;
    }
    const parsed = parseNodeFieldValue(field, values[field.name] ?? "");
    if (!parsed.ok) {
      return null;
    }
    patch[field.name] = parsed.value;
  }

  if (!validateNodeRelations(nextKey, patch)) {
    return null;
  }

  return buildRawNodeEditorValue(nextKey, patch);
}

function validateNodeRelations(nextKey: NodeKey, fields: Record<string, unknown>): boolean {
  const parentKeys = getRelationKeys(fields.parents);
  const childKeys = getRelationKeys(fields.children);
  return !parentKeys.includes(nextKey) && !childKeys.includes(nextKey);
}
