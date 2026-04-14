import type { GraphLayoutMode, GraphMode } from "../graph/types";

interface TopbarProps {
  topbarRef: React.RefObject<HTMLElement>;
  mode: GraphMode;
  layoutMode: GraphLayoutMode;
  status: string;
  fileName: string;
  hasGraph: boolean;
  canBack: boolean;
  canUp: boolean;
  zoomPercent: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  settingsOpen: boolean;
  onBack: () => void;
  onUp: () => void;
  onAll: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
  onZoomPercentCommit: (percent: number) => void;
  onSettingsToggle: () => void;
  onModeChange: (mode: GraphMode) => void;
  onLayoutModeChange: (mode: GraphLayoutMode) => void;
  onFileInputClick: (event: React.MouseEvent<HTMLInputElement>) => void;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onExport: () => void;
  onSaveJson: () => void;
}

export default function Topbar({
  topbarRef,
  mode,
  layoutMode,
  status,
  fileName,
  hasGraph,
  canBack,
  canUp,
  zoomPercent,
  canZoomOut,
  canZoomIn,
  settingsOpen,
  onBack,
  onUp,
  onAll,
  onZoomOut,
  onZoomIn,
  onZoomFit,
  onZoomPercentCommit,
  onSettingsToggle,
  onModeChange,
  onLayoutModeChange,
  onFileInputClick,
  onFileInputChange,
  onExport,
  onSaveJson,
}: TopbarProps) {
  return (
    <header ref={topbarRef} className="topbar">
      <div className="topbar-brand">
        <h1>DAG Studio</h1>
      </div>
      <div className="topbar-actions">
        <div className="topbar-group nav-controls" aria-label="Graph navigation controls">
          <button id="back-btn" className="ghost-btn" type="button" disabled={!canBack} onClick={onBack}>Back</button>
          <button id="up-btn" className="ghost-btn" type="button" disabled={!canUp} onClick={onUp}>Up</button>
          <button id="all-btn" className="ghost-btn" type="button" disabled={!hasGraph} onClick={onAll}>All</button>
        </div>
        <div className="topbar-group zoom-controls" aria-label="Graph zoom controls">
          <button id="zoom-out-btn" className="ghost-btn zoom-btn" type="button" disabled={!canZoomOut} aria-label="Zoom out" onClick={onZoomOut}>-</button>
          <button id="zoom-fit-btn" className="ghost-btn zoom-fit-btn" type="button" disabled={!hasGraph} onClick={onZoomFit}>Fit</button>
          <ZoomInput value={zoomPercent} disabled={!hasGraph} onCommit={onZoomPercentCommit} />
          <button id="zoom-in-btn" className="ghost-btn zoom-btn" type="button" disabled={!canZoomIn} aria-label="Zoom in" onClick={onZoomIn}>+</button>
        </div>
        <div className="topbar-group file-controls" aria-label="Graph file controls">
          <button id="save-json-btn" className="primary-btn topbar-save-btn" type="button" disabled={!hasGraph} onClick={onSaveJson}>Save JSON</button>
          <div id="floating-controls" className="control-dock">
            <button
              id="settings-btn"
              className="settings-toggle-btn"
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="settings-panel"
              onClick={onSettingsToggle}
            >
              Controls
            </button>
            <div id="settings-panel" className={`settings-panel${settingsOpen ? " settings-panel-visible" : ""}`}>
              <p className="control-label">Mode</p>
              <div className="mode-toggle" role="group" aria-label="Graph mode">
                <button id="mode-preview-btn" className={`mode-toggle-btn${mode === "preview" ? " is-active" : ""}`} type="button" data-mode="preview" aria-pressed={mode === "preview"} onClick={() => onModeChange("preview")}>Preview</button>
                <button id="mode-edit-btn" className={`mode-toggle-btn${mode === "edit" ? " is-active" : ""}`} type="button" data-mode="edit" aria-pressed={mode === "edit"} onClick={() => onModeChange("edit")}>Edit</button>
              </div>

              <label className="layout-select-label" htmlFor="layout-mode-select">
                <span className="control-label">Layout</span>
                <select
                  id="layout-mode-select"
                  className="layout-select"
                  value={layoutMode}
                  onChange={(event) => onLayoutModeChange(event.currentTarget.value as GraphLayoutMode)}
                >
                  <option value="bfs">BFS</option>
                  <option value="sugiyama">Sugiyama layered</option>
                </select>
              </label>

              <p className="control-label">Workspace</p>
              <label htmlFor="fileInput" className="file-input-label">
                <span className="file-input-text">{truncateFileName(fileName)}</span>
                <input type="file" id="fileInput" accept=".json" onClick={onFileInputClick} onChange={onFileInputChange} />
              </label>
              <button id="export-btn" className="primary-btn" type="button" disabled={!hasGraph} onClick={onExport}>Export SVG</button>
              <p id="graph-summary" className="graph-summary">{status}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ZoomInput({ value, disabled, onCommit }: { value: number; disabled: boolean; onCommit: (percent: number) => void }) {
  const handleCommit = (event: React.FocusEvent<HTMLInputElement> | React.ChangeEvent<HTMLInputElement>) => {
    onCommit(Number(event.currentTarget.value));
  };

  return (
    <label className="zoom-pill zoom-input-pill" htmlFor="zoom-value-input">
      <input
        id="zoom-value-input"
        className="zoom-value-input"
        type="number"
        min={5}
        max={200}
        step={1}
        value={value}
        disabled={disabled}
        aria-label="Zoom percentage"
        onChange={handleCommit}
        onBlur={handleCommit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            onCommit(Number(event.currentTarget.value));
            event.currentTarget.blur();
          }
        }}
      />
      <span className="zoom-unit">%</span>
    </label>
  );
}

function truncateFileName(fileName: string): string {
  return fileName.length > 26 ? `${fileName.slice(0, 23)}...` : fileName;
}
