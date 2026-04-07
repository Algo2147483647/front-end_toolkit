import type { ReactNode } from "react";

import type { SvgStudioBindings, SvgStudioDomRefs } from "../hooks/useSvgStudio";

interface ShellProps {
  refs: SvgStudioDomRefs;
  workspaceSurfaceProps?: SvgStudioBindings["workspaceSurfaceProps"];
}

function ToolButtonLabel({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <>
      <span className="tool-icon" aria-hidden="true">{icon}</span>
      <span className="tool-label">{label}</span>
    </>
  );
}

function InsertIconRect() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="12" y="15" width="40" height="34" rx="12" fill="currentColor" opacity="0.14"></rect>
      <rect x="16" y="19" width="32" height="26" rx="8" fill="none" stroke="currentColor" strokeWidth="4"></rect>
    </svg>
  );
}

function InsertIconCircle() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="20" fill="currentColor" opacity="0.14"></circle>
      <circle cx="32" cy="32" r="16" fill="none" stroke="currentColor" strokeWidth="4"></circle>
    </svg>
  );
}

function InsertIconEllipse() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="22" ry="16" fill="currentColor" opacity="0.14"></ellipse>
      <ellipse cx="32" cy="32" rx="18" ry="12" fill="none" stroke="currentColor" strokeWidth="4"></ellipse>
    </svg>
  );
}

function InsertIconLine() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <line x1="17" y1="44" x2="47" y2="20" stroke="currentColor" strokeWidth="5" strokeLinecap="round"></line>
      <circle cx="17" cy="44" r="5" fill="currentColor"></circle>
      <circle cx="47" cy="20" r="5" fill="currentColor"></circle>
    </svg>
  );
}

function InsertIconText() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M18 18h28" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"></path>
      <path d="M32 18v28" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"></path>
      <path d="M22 46h20" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity="0.6"></path>
    </svg>
  );
}

function InsertIconPolyline() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <polyline points="12 42 24 28 34 36 52 16" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"></polyline>
      <circle cx="12" cy="42" r="4" fill="currentColor"></circle>
      <circle cx="24" cy="28" r="4" fill="currentColor" opacity="0.8"></circle>
      <circle cx="34" cy="36" r="4" fill="currentColor" opacity="0.65"></circle>
    </svg>
  );
}

function InsertIconPolygon() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <polygon points="32 12 50 24 42 48 22 48 14 24" fill="currentColor" opacity="0.14"></polygon>
      <polygon points="32 16 46 26 40 44 24 44 18 26" fill="none" stroke="currentColor" strokeWidth="4" strokeLinejoin="round"></polygon>
    </svg>
  );
}

function InsertIconPath() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <path d="M12 42 C18 16, 32 16, 36 34 S50 50, 52 22" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round"></path>
    </svg>
  );
}

function InsertIconImage() {
  return (
    <svg className="insert-icon" viewBox="0 0 64 64" aria-hidden="true">
      <rect x="14" y="16" width="36" height="30" rx="8" fill="none" stroke="currentColor" strokeWidth="4"></rect>
      <circle cx="24" cy="25" r="4" fill="currentColor"></circle>
      <path d="M18 40 28 31 35 37 42 28 50 40" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"></path>
    </svg>
  );
}

function Topbar({ refs }: ShellProps) {
  return (
    <header className="topbar" id="topbar" ref={refs.topbarRef}>
      <div className="brand-block">
        <div className="brand-row">
          <h1 className="brand-title">SVG Studio</h1>
          <span className="status-pill" id="statusPill" ref={refs.statusPillRef}>No selection</span>
        </div>
      </div>

      <div className="toolbar">
        <div className="toolbar-group">
          <button className="tool-button" id="newDocumentButton" type="button" title="New document" aria-label="New document" ref={refs.newDocumentButtonRef}>
            <ToolButtonLabel icon="+" label="New" />
          </button>
          <button className="tool-button" id="importButton" type="button" title="Import SVG" aria-label="Import SVG" ref={refs.importButtonRef}>
            <ToolButtonLabel icon="↑" label="Import" />
          </button>
          <input id="fileInput" type="file" accept=".svg,image/svg+xml" hidden ref={refs.fileInputRef} />
          <button className="tool-button" id="saveButton" type="button" title="Save over original file" aria-label="Save over original file" ref={refs.saveButtonRef}>
            <ToolButtonLabel icon="S" label="Save" />
          </button>
          <button className="tool-button" id="exportButton" type="button" title="Export SVG" aria-label="Export SVG" ref={refs.exportButtonRef}>
            <ToolButtonLabel icon="↓" label="Export" />
          </button>
        </div>

        <div className="toolbar-group">
          <button className="tool-button" id="undoButton" type="button" title="Undo" aria-label="Undo" ref={refs.undoButtonRef}>
            <ToolButtonLabel icon="↶" label="Undo" />
          </button>
          <button className="tool-button" id="redoButton" type="button" title="Redo" aria-label="Redo" ref={refs.redoButtonRef}>
            <ToolButtonLabel icon="↷" label="Redo" />
          </button>
          <button className="tool-button" id="duplicateButton" type="button" title="Duplicate" aria-label="Duplicate" ref={refs.duplicateButtonRef}>
            <ToolButtonLabel icon="⎘" label="Copy" />
          </button>
          <button className="tool-button" id="deleteButton" type="button" title="Delete" aria-label="Delete" ref={refs.deleteButtonRef}>
            <ToolButtonLabel icon="×" label="Delete" />
          </button>
        </div>

        <div className="toolbar-group">
          <button className="tool-button" id="gridSnapButton" type="button" title="Enable grid snap" aria-label="Enable grid snap" aria-pressed="false" ref={refs.gridSnapButtonRef}>
            <ToolButtonLabel icon="#" label="Snap" />
          </button>
          <div className="tool-input-group" id="gridSnapSizeGroup" ref={refs.gridSnapSizeGroupRef}>
            <input className="tool-input" id="gridSnapSizeInput" type="number" min="1" step="1" aria-label="Grid size" title="Grid size (px)" ref={refs.gridSnapSizeInputRef} />
            <select className="tool-select" id="gridSnapSizeSelect" aria-label="Quick grid size presets" title="Quick grid size presets" ref={refs.gridSnapSizeSelectRef}>
              <option value=""></option>
            </select>
          </div>
          <button className="tool-button" id="sourceToggleButton" type="button" title="Show source" aria-label="Show source" aria-expanded="false" ref={refs.sourceToggleButtonRef}>
            <ToolButtonLabel icon="</>" label="Code" />
          </button>
        </div>
      </div>

      <div className="zoom-controls">
        <button className="tool-button compact" id="zoomOutButton" type="button" title="Zoom out" aria-label="Zoom out" ref={refs.zoomOutButtonRef}>-</button>
        <span id="zoomLabel" ref={refs.zoomLabelRef}>100%</span>
        <button className="tool-button compact" id="zoomInButton" type="button" title="Zoom in" aria-label="Zoom in" ref={refs.zoomInButtonRef}>+</button>
        <button className="tool-button" id="zoomResetButton" type="button" title="Fit to view" aria-label="Fit to view" ref={refs.zoomResetButtonRef}>
          <ToolButtonLabel icon="⤢" label="Fit" />
        </button>
        <button className="tool-button" id="collapseTopbarButton" type="button" title="Hide toolbar" aria-label="Hide toolbar" ref={refs.collapseTopbarButtonRef}>
          <ToolButtonLabel icon="▴" label="Hide" />
        </button>
      </div>
    </header>
  );
}

function FloatingDock({ refs }: ShellProps) {
  return (
    <div className="floating-dock" id="floatingDock">
      <button className="dock-button hidden" id="showTopbarButton" type="button" ref={refs.showTopbarButtonRef}>Toolbar</button>
      <button className="dock-button" id="floatingLeftButton" type="button" ref={refs.floatingLeftButtonRef}>Left</button>
      <button className="dock-button" id="floatingRightButton" type="button" ref={refs.floatingRightButtonRef}>Right</button>
    </div>
  );
}

function LeftPanel({ refs }: ShellProps) {
  return (
    <aside className="panel left-panel" id="leftPanel" ref={refs.leftPanelRef}>
      <div className="floating-panel-header">
        <div>
          <h2>Library</h2>
          <div className="panel-segment-toggle" role="tablist" aria-label="Library sections">
            <button className="panel-segment-button is-active" id="leftPanelInsertTab" type="button" role="tab" aria-selected="true" aria-controls="leftPanelInsertSection" ref={refs.leftPanelInsertTabRef}>Insert</button>
            <button className="panel-segment-button" id="leftPanelLayersTab" type="button" role="tab" aria-selected="false" aria-controls="leftPanelLayersSection" ref={refs.leftPanelLayersTabRef}>Layers</button>
          </div>
        </div>
        <button className="tool-button compact" id="hideLeftPanelButton" type="button" title="Hide left panel" aria-label="Hide left panel" ref={refs.hideLeftPanelButtonRef}>×</button>
      </div>

      <section className="panel-section left-panel-view" id="leftPanelInsertSection" ref={refs.leftPanelInsertSectionRef}>
        <div className="panel-heading">
          <h2>Insert</h2>
          <span className="hint-text">Click to add</span>
        </div>
        <div className="insert-grid" id="insertGrid" ref={refs.insertGridRef}>
          <button className="insert-card" type="button" data-insert="rect" title="Insert rectangle" aria-label="Insert rectangle"><InsertIconRect /></button>
          <button className="insert-card" type="button" data-insert="circle" title="Insert circle" aria-label="Insert circle"><InsertIconCircle /></button>
          <button className="insert-card" type="button" data-insert="ellipse" title="Insert ellipse" aria-label="Insert ellipse"><InsertIconEllipse /></button>
          <button className="insert-card" type="button" data-insert="line" title="Insert line" aria-label="Insert line"><InsertIconLine /></button>
          <button className="insert-card" type="button" data-insert="text" title="Insert text" aria-label="Insert text"><InsertIconText /></button>
          <button className="insert-card" type="button" data-insert="polyline" title="Insert polyline" aria-label="Insert polyline"><InsertIconPolyline /></button>
          <button className="insert-card" type="button" data-insert="polygon" title="Insert polygon" aria-label="Insert polygon"><InsertIconPolygon /></button>
          <button className="insert-card" type="button" data-insert="path" title="Insert path" aria-label="Insert path"><InsertIconPath /></button>
          <button className="insert-card" id="insertImageButton" type="button" title="Insert image" aria-label="Insert image" ref={refs.insertImageButtonRef}><InsertIconImage /></button>
        </div>
        <input id="imageInput" type="file" accept="image/*,.svg" hidden ref={refs.imageInputRef} />
      </section>

      <section className="panel-section left-panel-view hidden" id="leftPanelLayersSection" ref={refs.leftPanelLayersSectionRef}>
        <div className="panel-heading">
          <h2>Layers</h2>
          <span className="count-badge" id="nodeCountBadge" ref={refs.nodeCountBadgeRef}>0 nodes</span>
        </div>
        <p className="hint-text">Collapse groups, hide layers, or lock them before editing.</p>
        <div className="tree-panel" id="treePanel" ref={refs.treePanelRef}></div>
      </section>
    </aside>
  );
}

function Workspace({ refs, workspaceSurfaceProps }: ShellProps) {
  return (
    <main className="workspace-panel">
      <section className="workspace-content" id="workspaceContent" ref={refs.workspaceContentRef}>
        <section
          className="workspace-surface"
          id="workspaceSurface"
          ref={refs.workspaceSurfaceRef}
          {...workspaceSurfaceProps}
        >
          <div className="surface-grid" ref={refs.surfaceGridRef}></div>
          <div className="surface-inner" id="surfaceInner" ref={refs.surfaceInnerRef}>
            <div className="svg-host" id="svgHost" ref={refs.svgHostRef}></div>
          </div>
          <div className="drop-overlay hidden" id="dropOverlay" ref={refs.dropOverlayRef}>Drop to insert file</div>
        </section>

        <section className="source-pane hidden" id="sourcePane" ref={refs.sourcePaneRef}>
          <div className="source-pane-header">
            <div>
              <p className="eyebrow">Editor</p>
              <h2>SVG Source</h2>
            </div>
            <button className="tool-button" id="applySourceButton" type="button" ref={refs.applySourceButtonRef}>
              <ToolButtonLabel icon="✓" label="Apply" />
            </button>
          </div>
          <p className="source-pane-hint">Edit raw SVG and apply your changes when you are ready.</p>
          <textarea className="source-editor source-pane-editor" id="sourceEditor" spellCheck={false} ref={refs.sourceEditorRef}></textarea>
        </section>
      </section>

      <section className="sanitize-warnings hidden" id="sanitizeWarningsPanel" ref={refs.sanitizeWarningsPanelRef} aria-live="polite">
        <div className="sanitize-warnings-header">
          <strong>Import safety cleanup</strong>
          <span className="sanitize-warnings-count" id="sanitizeWarningsCount" ref={refs.sanitizeWarningsCountRef}>0 changes</span>
        </div>
        <ul className="sanitize-warnings-list" id="sanitizeWarningsList" ref={refs.sanitizeWarningsListRef}></ul>
        <button
          className="tool-button compact sanitize-warnings-dismiss"
          id="sanitizeWarningsDismissButton"
          type="button"
          ref={refs.sanitizeWarningsDismissButtonRef}
        >
          Dismiss
        </button>
      </section>

      <div className="context-menu hidden" id="contextMenu" role="menu" aria-label="Canvas actions" ref={refs.contextMenuRef}>
        <button className="context-menu-item" id="bringToFrontButton" type="button" role="menuitem" ref={refs.bringToFrontButtonRef}>Bring To Front</button>
        <button className="context-menu-item" id="sendToBackButton" type="button" role="menuitem" ref={refs.sendToBackButtonRef}>Send To Back</button>
      </div>
    </main>
  );
}

function FeedbackLayer({ refs }: ShellProps) {
  return (
    <>
      <div className="feedback-stack" id="feedbackStack" ref={refs.feedbackStackRef} aria-live="polite" aria-atomic="false"></div>
      <div className="confirm-dialog-backdrop hidden" id="confirmDialogBackdrop" ref={refs.confirmDialogBackdropRef}>
        <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirmDialogTitle">
          <h3 id="confirmDialogTitle" ref={refs.confirmDialogTitleRef}>Confirm action</h3>
          <p id="confirmDialogMessage" ref={refs.confirmDialogMessageRef}></p>
          <div className="confirm-dialog-actions">
            <button className="tool-button" id="confirmDialogCancelButton" type="button" ref={refs.confirmDialogCancelButtonRef}>Cancel</button>
            <button className="tool-button is-accent" id="confirmDialogConfirmButton" type="button" ref={refs.confirmDialogConfirmButtonRef}>Confirm</button>
          </div>
        </section>
      </div>
    </>
  );
}

function Inspector({ refs }: ShellProps) {
  return (
    <aside className="panel inspector-panel" id="rightPanel" ref={refs.rightPanelRef}>
      <div className="floating-panel-header">
        <div>
          <h2>Inspector</h2>
        </div>
        <button className="tool-button compact" id="hideRightPanelButton" type="button" title="Hide right panel" aria-label="Hide right panel" ref={refs.hideRightPanelButtonRef}>×</button>
      </div>
      <section className="panel-section">
        <div className="inspector-empty" id="inspectorEmpty" ref={refs.inspectorEmptyRef}>Select an element from the canvas or layer tree.</div>
        <form className="property-form hidden" id="propertyForm" ref={refs.propertyFormRef}></form>
      </section>
    </aside>
  );
}

export function SvgStudioShell({ refs, workspaceSurfaceProps }: ShellProps) {
  return (
    <div className="app-shell svg-studio-app-host" id="appShell" ref={refs.appShellRef}>
      <Topbar refs={refs} />
      <FloatingDock refs={refs} />
      <LeftPanel refs={refs} />
      <Workspace refs={refs} workspaceSurfaceProps={workspaceSurfaceProps} />
      <Inspector refs={refs} />
      <FeedbackLayer refs={refs} />
    </div>
  );
}
