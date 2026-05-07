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
  canUndo: boolean;
  canRedo: boolean;
  zoomPercent: number;
  canZoomOut: boolean;
  canZoomIn: boolean;
  settingsOpen: boolean;
  consoleSidebarOpen: boolean;
  onBack: () => void;
  onUp: () => void;
  onAll: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onZoomFit: () => void;
  onZoomPercentCommit: (percent: number) => void;
  onSettingsToggle: () => void;
  onConsoleSidebarToggle: () => void;
  onModeChange: (mode: GraphMode) => void;
  onLayoutModeChange: (mode: GraphLayoutMode) => void;
  onFileInputClick: (event: React.MouseEvent<HTMLInputElement>) => void;
  onFileInputChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onInitializeCanvas: () => void;
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
  canUndo,
  canRedo,
  zoomPercent,
  canZoomOut,
  canZoomIn,
  settingsOpen,
  consoleSidebarOpen,
  onBack,
  onUp,
  onAll,
  onUndo,
  onRedo,
  onZoomOut,
  onZoomIn,
  onZoomFit,
  onZoomPercentCommit,
  onSettingsToggle,
  onConsoleSidebarToggle,
  onModeChange,
  onLayoutModeChange,
  onFileInputClick,
  onFileInputChange,
  onInitializeCanvas,
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
          <IconButton id="back-btn" label="Back" disabled={!canBack} onClick={onBack} icon={<ArrowLeftIcon />} />
          <IconButton id="up-btn" label="Up" disabled={!canUp} onClick={onUp} icon={<ArrowUpIcon />} />
          <IconButton id="all-btn" label="Show all roots" disabled={!hasGraph} onClick={onAll} icon={<GraphRootsIcon />} />
        </div>
        {mode === "edit" ? (
          <div className="topbar-group edit-controls" aria-label="Graph edit controls">
            <IconButton id="undo-btn" label="Undo" disabled={!canUndo} onClick={onUndo} icon={<UndoIcon />} />
            <IconButton id="redo-btn" label="Redo" disabled={!canRedo} onClick={onRedo} icon={<RedoIcon />} />
          </div>
        ) : null}
        <div className="topbar-group zoom-controls" aria-label="Graph zoom controls">
          <IconButton id="zoom-out-btn" label="Zoom out" disabled={!canZoomOut} onClick={onZoomOut} icon={<MinusIcon />} />
          <IconButton id="zoom-in-btn" label="Zoom in" disabled={!canZoomIn} onClick={onZoomIn} icon={<PlusIcon />} />
          <ZoomInput value={zoomPercent} disabled={!hasGraph} onCommit={onZoomPercentCommit} />
          <IconButton id="zoom-fit-btn" label="Fit graph to viewport" disabled={!hasGraph} onClick={onZoomFit} icon={<FitIcon />} />
        </div>
        <div className="topbar-group file-controls" aria-label="Graph file controls">
          <IconButton id="save-json-btn" label="Save JSON" disabled={!hasGraph} onClick={onSaveJson} icon={<SaveIcon />} className="ghost-btn topbar-icon-btn topbar-save-btn" />
          <div id="floating-controls" className="control-dock">
            <IconButton
              id="settings-btn"
              label="Open controls"
              icon={<SlidersIcon />}
              ariaExpanded={settingsOpen}
              ariaControls="settings-panel"
              onClick={onSettingsToggle}
              className="settings-toggle-btn topbar-icon-btn"
            />
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
                  <option value="dagre">Dagre layered</option>
                </select>
              </label>

              <p className="control-label">Workspace</p>
              {mode === "edit" ? (
                <button
                  id="console-sidebar-toggle-btn"
                  className={`ghost-btn settings-action-btn${consoleSidebarOpen ? " settings-action-btn-active" : ""}`}
                  type="button"
                  aria-pressed={consoleSidebarOpen}
                  onClick={onConsoleSidebarToggle}
                >
                  {consoleSidebarOpen ? "Hide Console Sidebar" : "Show Console Sidebar"}
                </button>
              ) : null}
              <label htmlFor="fileInput" className="file-input-label">
                <span className="file-input-text">{truncateFileName(fileName)}</span>
                <input type="file" id="fileInput" accept=".json" onClick={onFileInputClick} onChange={onFileInputChange} />
              </label>
              <button id="init-canvas-btn" className="ghost-btn settings-action-btn" type="button" onClick={onInitializeCanvas}>Initialize Canvas</button>
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

interface IconButtonProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  ariaControls?: string;
  ariaExpanded?: boolean;
  className?: string;
}

function IconButton({ id, label, icon, disabled, onClick, ariaControls, ariaExpanded, className = "ghost-btn topbar-icon-btn" }: IconButtonProps) {
  return (
    <button
      id={id}
      className={className}
      type="button"
      title={label}
      aria-label={label}
      aria-controls={ariaControls}
      aria-expanded={ariaExpanded}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="topbar-icon" aria-hidden="true">{icon}</span>
    </button>
  );
}

function IconShell({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="topbar-icon-svg" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <IconShell>
      <path d="M19 12H5" />
      <path d="M11 18L5 12L11 6" />
    </IconShell>
  );
}

function ArrowUpIcon() {
  return (
    <IconShell>
      <path d="M12 19V5" />
      <path d="M6 11L12 5L18 11" />
    </IconShell>
  );
}

function GraphRootsIcon() {
  return (
    <IconShell>
      <circle cx="6" cy="7" r="2.2" />
      <circle cx="18" cy="7" r="2.2" />
      <circle cx="12" cy="17" r="2.2" />
      <path d="M7.8 8.6L10.4 14.2" />
      <path d="M16.2 8.6L13.6 14.2" />
    </IconShell>
  );
}

function UndoIcon() {
  return (
    <IconShell>
      <path d="M9 9H5V5" />
      <path d="M5 9C6.8 6.4 9.8 5 13 5C18 5 21 8.3 21 12.9C21 17.4 17.7 20 13.5 20" />
    </IconShell>
  );
}

function RedoIcon() {
  return (
    <IconShell>
      <path d="M15 9H19V5" />
      <path d="M19 9C17.2 6.4 14.2 5 11 5C6 5 3 8.3 3 12.9C3 17.4 6.3 20 10.5 20" />
    </IconShell>
  );
}

function MinusIcon() {
  return (
    <IconShell>
      <path d="M6 12H18" />
    </IconShell>
  );
}

function PlusIcon() {
  return (
    <IconShell>
      <path d="M12 6V18" />
      <path d="M6 12H18" />
    </IconShell>
  );
}

function FitIcon() {
  return (
    <IconShell>
      <path d="M8 4H4V8" />
      <path d="M16 4H20V8" />
      <path d="M8 20H4V16" />
      <path d="M16 20H20V16" />
      <path d="M9 9L4 4" />
      <path d="M15 9L20 4" />
      <path d="M9 15L4 20" />
      <path d="M15 15L20 20" />
    </IconShell>
  );
}

function SaveIcon() {
  return (
    <IconShell>
      <path d="M5 5H16L19 8V19H5Z" />
      <path d="M8 5V10H15V5" />
      <path d="M8 19V14H16V19" />
    </IconShell>
  );
}

function SlidersIcon() {
  return (
    <IconShell>
      <path d="M5 6H19" />
      <path d="M5 12H19" />
      <path d="M5 18H19" />
      <circle cx="9" cy="6" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="11" cy="18" r="1.8" fill="currentColor" stroke="none" />
    </IconShell>
  );
}

function truncateFileName(fileName: string): string {
  return fileName.length > 26 ? `${fileName.slice(0, 23)}...` : fileName;
}
