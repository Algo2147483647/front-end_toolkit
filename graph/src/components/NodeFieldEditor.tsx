import type { NodeKey } from "../graph/types";
import { getRelationKeys, normalizeRelationField } from "../graph/relations";
import { parseRelationInput } from "./RelationEditorModal";

export type FieldEditorKind = "plainText" | "multilineText" | "json" | "relation";

export interface EditableField {
  name: string;
  value: unknown;
  editorKind: FieldEditorKind;
  locked?: boolean;
}

interface NodeFieldEditorProps {
  field: EditableField;
  mode: "preview" | "edit";
  value: string;
  onChange: (value: string) => void;
}

export default function NodeFieldEditor({ field, mode, value, onChange }: NodeFieldEditorProps) {
  if (mode === "preview") {
    return <FieldPreview name={field.name} value={field.value} />;
  }

  if (field.name === "key") {
    return <input className="node-detail-editor node-detail-editor--input" type="text" spellCheck={false} value={value} onChange={(event) => onChange(event.target.value)} />;
  }

  return (
    <div className="node-detail-editor-wrap">
      <textarea
        className="node-detail-editor node-detail-editor--textarea"
        rows={getEditorRows(field)}
        spellCheck={false}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {getEditorHint(field) ? <p className="node-detail-editor-hint">{getEditorHint(field)}</p> : null}
    </div>
  );
}

function FieldPreview({ name, value }: { name: string; value: unknown }) {
  if (name === "parents" || name === "children") {
    const relationKeys = getRelationKeys(value);
    if (!relationKeys.length) {
      return <p className="node-detail-empty">No {name} linked.</p>;
    }
    return (
      <div className="node-detail-chip-list">
        {relationKeys.map((relationKey) => <span key={relationKey} className="node-detail-chip">{relationKey}</span>)}
      </div>
    );
  }

  if (name === "define") {
    return <p className="node-detail-text node-detail-text--define">{String(value || "").trim() || "(empty string)"}</p>;
  }

  if (value === null || value === undefined) {
    return <p className="node-detail-empty">(empty)</p>;
  }

  if (typeof value === "string") {
    return <p className="node-detail-text">{value.trim() || "(empty string)"}</p>;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return <p className="node-detail-text">{String(value)}</p>;
  }

  if (Array.isArray(value) && value.every((item) => ["string", "number", "boolean"].includes(typeof item))) {
    return (
      <div className="node-detail-chip-list">
        {value.length ? value.map((item, index) => <span key={`${String(item)}-${index}`} className="node-detail-chip">{String(item)}</span>) : <span className="node-detail-chip">(empty)</span>}
      </div>
    );
  }

  return <pre className="node-detail-pre">{JSON.stringify(value, null, 2)}</pre>;
}

export function buildEditableFields(nodeKey: NodeKey, node: Record<string, unknown>): EditableField[] {
  const clonedNode = { ...node };
  if (clonedNode.key === nodeKey) {
    delete clonedNode.key;
  }
  return [
    { name: "key", value: nodeKey, editorKind: "plainText" },
    ...Object.entries(clonedNode).map(([name, value]) => ({
      name,
      value,
      editorKind: inferEditorKind(name, value),
    })),
  ];
}

export function formatEditorValue(field: EditableField): string {
  if (field.name === "parents" || field.name === "children") {
    return JSON.stringify(normalizeRelationField(field.value), null, 2);
  }
  if (typeof field.value === "string") {
    return field.value;
  }
  if (typeof field.value === "number" || typeof field.value === "boolean") {
    return String(field.value);
  }
  return JSON.stringify(field.value, null, 2);
}

export function parseNodeFieldValue(field: EditableField, rawValue: string): { ok: true; value: unknown } | { ok: false; message: string } {
  const text = String(rawValue || "");
  const trimmed = text.trim();

  if (field.name === "parents" || field.name === "children") {
    if (!trimmed) {
      return { ok: true, value: {} };
    }
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return parseJsonEditorValue(field.name, trimmed);
    }
    return { ok: true, value: parseRelationInput(trimmed) };
  }

  if (field.editorKind === "plainText" || field.editorKind === "multilineText") {
    return { ok: true, value: text };
  }

  if (typeof field.value === "number") {
    const nextNumber = Number(trimmed);
    if (!trimmed || !Number.isFinite(nextNumber)) {
      return { ok: false, message: `Field "${field.name}" must be a valid number.` };
    }
    return { ok: true, value: nextNumber };
  }

  if (typeof field.value === "boolean") {
    if (/^true$/i.test(trimmed)) {
      return { ok: true, value: true };
    }
    if (/^false$/i.test(trimmed)) {
      return { ok: true, value: false };
    }
    return { ok: false, message: `Field "${field.name}" must be true or false.` };
  }

  return parseJsonEditorValue(field.name, trimmed || "null");
}

function parseJsonEditorValue(fieldName: string, rawJson: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(rawJson) };
  } catch {
    return { ok: false, message: `Field "${fieldName}" contains invalid JSON.` };
  }
}

function inferEditorKind(name: string, value: unknown): FieldEditorKind {
  if (name === "parents" || name === "children") {
    return "relation";
  }
  if (name === "define" || typeof value === "string" && value.length > 80) {
    return "multilineText";
  }
  if (typeof value === "string") {
    return "plainText";
  }
  return "json";
}

function getEditorRows(field: EditableField): number {
  if (field.name === "define") {
    return 8;
  }
  if (field.name === "parents" || field.name === "children") {
    return 5;
  }
  if (field.editorKind === "json") {
    return 6;
  }
  return 3;
}

function getEditorHint(field: EditableField): string {
  if (field.name === "parents" || field.name === "children") {
    return "Use a JSON object, a JSON array, or one key per line.";
  }
  if (field.editorKind === "json") {
    return "Enter valid JSON.";
  }
  if (typeof field.value === "boolean") {
    return "Use true or false.";
  }
  return "";
}
