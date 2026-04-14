import { buildTimestampFileName, ensureJsonExtension } from "../adapters/download";

interface SaveJsonModalProps {
  open: boolean;
  sourceFileName: string;
  canOverwrite: boolean;
  onOverwrite: () => void;
  onSaveNew: () => void;
  onClose: () => void;
}

export default function SaveJsonModal({ open, sourceFileName, canOverwrite, onOverwrite, onSaveNew, onClose }: SaveJsonModalProps) {
  if (!open) {
    return null;
  }

  const normalizedFileName = ensureJsonExtension(sourceFileName || "graph.json");
  const newFileName = buildTimestampFileName(normalizedFileName);

  return (
    <div id="save-json-modal" className="save-json-modal is-visible" aria-hidden="false" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="save-json-dialog" role="dialog" aria-modal="true" aria-labelledby="save-json-title">
        <h3 id="save-json-title">Save Graph JSON</h3>
        <p id="save-json-description" className="save-json-description">
          {canOverwrite
            ? `Overwrite "${normalizedFileName}" on disk, or save a new copy named "${newFileName}".`
            : `Direct overwrite is unavailable for "${normalizedFileName}". Reopen the JSON with file access, or save a new copy named "${newFileName}".`}
        </p>
        <div className="save-json-actions">
          <button id="save-json-overwrite" className="primary-btn" type="button" disabled={!canOverwrite} title={canOverwrite ? `Overwrite ${normalizedFileName}` : "Open the JSON with file access to enable direct overwrite."} onClick={onOverwrite}>Overwrite Original</button>
          <button id="save-json-new" className="ghost-btn" type="button" onClick={onSaveNew}>Save New Copy</button>
          <button id="save-json-cancel" className="ghost-btn" type="button" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
