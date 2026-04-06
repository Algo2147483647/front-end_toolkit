import type { SvgStudioDomRefs } from "../hooks/useSvgStudio";

interface ShellProps {
  refs: SvgStudioDomRefs;
}

function ToolButtonLabel({ icon, label }: { icon: string; label: string }) {
  return (
    <>
      <span className="tool-icon" aria-hidden="true">{icon}</span>
      <span className="tool-label">{label}</span>
    </>
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
            <ToolButtonLabel icon="In" label="Import" />
          </button>
          <input id="fileInput" type="file" accept=".svg,image/svg+xml" hidden ref={refs.fileInputRef} />
          <button className="tool-button" id="saveButton" type="button" title="Save over original file" aria-label="Save over original file" ref={refs.saveButtonRef}>
            <ToolButtonLabel icon="S" label="Save" />
          </button>
          <button className="tool-button" id="exportButton" type="button" title="Export SVG" aria-label="Export SVG" ref={refs.exportButtonRef}>
            <ToolButtonLabel icon="Out" label="Export" />
          </button>
        </div>

        <div className="toolbar-group">
          <button className="tool-button" id="undoButton" type="button" title="Undo" aria-label="Undo" ref={refs.undoButtonRef}>
            <ToolButtonLabel icon="U" label="Undo" />
          </button>
          <button className="tool-button" id="redoButton" type="button" title="Redo" aria-label="Redo" ref={refs.redoButtonRef}>
            <ToolButtonLabel icon="R" label="Redo" />
          </button>
          <button className="tool-button" id="duplicateButton" type="button" title="Duplicate" aria-label="Duplicate" ref={refs.duplicateButtonRef}>
            <ToolButtonLabel icon="C" label="Copy" />
          </button>
          <button className="tool-button" id="deleteButton" type="button" title="Delete" aria-label="Delete" ref={refs.deleteButtonRef}>
            <ToolButtonLabel icon="X" label="Delete" />
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
          <ToolButtonLabel icon="Fit" label="Fit" />
        </button>
        <button className="tool-button" id="collapseTopbarButton" type="button" title="Hide toolbar" aria-label="Hide toolbar" ref={refs.collapseTopbarButtonRef}>
          <ToolButtonLabel icon="-" label="Hide" />
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
        <button className="tool-button compact" id="hideLeftPanelButton" type="button" title="Hide left panel" aria-label="Hide left panel" ref={refs.hideLeftPanelButtonRef}>X</button>
      </div>

      <section className="panel-section left-panel-view" id="leftPanelInsertSection" ref={refs.leftPanelInsertSectionRef}>
        <div className="panel-heading">
          <h2>Insert</h2>
          <span className="hint-text">Click to add</span>
        </div>
        <div className="insert-grid" id="insertGrid" ref={refs.insertGridRef}>
          <button className="insert-card" type="button" data-insert="rect" title="Insert rectangle" aria-label="Insert rectangle">rect</button>
          <button className="insert-card" type="button" data-insert="circle" title="Insert circle" aria-label="Insert circle">circle</button>
          <button className="insert-card" type="button" data-insert="ellipse" title="Insert ellipse" aria-label="Insert ellipse">ellipse</button>
          <button className="insert-card" type="button" data-insert="line" title="Insert line" aria-label="Insert line">line</button>
          <button className="insert-card" type="button" data-insert="text" title="Insert text" aria-label="Insert text">text</button>
          <button className="insert-card" type="button" data-insert="polyline" title="Insert polyline" aria-label="Insert polyline">polyline</button>
          <button className="insert-card" type="button" data-insert="polygon" title="Insert polygon" aria-label="Insert polygon">polygon</button>
          <button className="insert-card" type="button" data-insert="path" title="Insert path" aria-label="Insert path">path</button>
          <button className="insert-card" id="insertImageButton" type="button" title="Insert image" aria-label="Insert image" ref={refs.insertImageButtonRef}>image</button>
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

function Workspace({ refs }: ShellProps) {
  return (
    <main className="workspace-panel">
      <section className="workspace-content" id="workspaceContent" ref={refs.workspaceContentRef}>
        <section className="workspace-surface" id="workspaceSurface" ref={refs.workspaceSurfaceRef}>
          <div className="surface-grid" ref={refs.surfaceGridRef}></div>
          <div className="surface-inner" id="surfaceInner" ref={refs.surfaceInnerRef}>
            <div className="svg-host" id="svgHost" ref={refs.svgHostRef}>
              <svg className="selection-overlay" id="selectionOverlay" aria-hidden="true" ref={refs.overlayRef}></svg>
            </div>
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
              <ToolButtonLabel icon="OK" label="Apply" />
            </button>
          </div>
          <p className="source-pane-hint">Edit raw SVG and apply your changes when you are ready.</p>
          <textarea className="source-editor source-pane-editor" id="sourceEditor" spellCheck={false} ref={refs.sourceEditorRef}></textarea>
        </section>
      </section>

      <div className="context-menu hidden" id="contextMenu" role="menu" aria-label="Canvas actions" ref={refs.contextMenuRef}>
        <button className="context-menu-item" id="bringToFrontButton" type="button" role="menuitem" ref={refs.bringToFrontButtonRef}>Bring To Front</button>
        <button className="context-menu-item" id="sendToBackButton" type="button" role="menuitem" ref={refs.sendToBackButtonRef}>Send To Back</button>
      </div>
    </main>
  );
}

function Inspector({ refs }: ShellProps) {
  return (
    <aside className="panel inspector-panel" id="rightPanel" ref={refs.rightPanelRef}>
      <div className="floating-panel-header">
        <div>
          <h2>Inspector</h2>
        </div>
        <button className="tool-button compact" id="hideRightPanelButton" type="button" title="Hide right panel" aria-label="Hide right panel" ref={refs.hideRightPanelButtonRef}>X</button>
      </div>
      <section className="panel-section">
        <div className="inspector-empty" id="inspectorEmpty" ref={refs.inspectorEmptyRef}>Select an element from the canvas or layer tree.</div>
        <form className="property-form hidden" id="propertyForm" ref={refs.propertyFormRef}></form>
      </section>
    </aside>
  );
}

function FieldTemplate({ refs }: ShellProps) {
  return (
    <template id="propertyFieldTemplate" ref={refs.fieldTemplateRef}>
      <label className="field-row">
        <span className="field-label"></span>
        <input className="field-input" />
      </label>
    </template>
  );
}

export function SvgStudioShell({ refs }: ShellProps) {
  return (
    <>
      <div className="app-shell svg-studio-app-host" id="appShell" ref={refs.appShellRef}>
        <Topbar refs={refs} />
        <FloatingDock refs={refs} />
        <LeftPanel refs={refs} />
        <Workspace refs={refs} />
        <Inspector refs={refs} />
      </div>
      <FieldTemplate refs={refs} />
    </>
  );
}
