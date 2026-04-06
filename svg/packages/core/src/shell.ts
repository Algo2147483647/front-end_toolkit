export const svgStudioShellHtml = `
  <div class="app-shell" id="appShell">
    <header class="topbar" id="topbar">
      <div class="brand-block">
        <div class="brand-row">
          <h1 class="brand-title">SVG Studio</h1>
          <span class="status-pill" id="statusPill">No selection</span>
        </div>
      </div>

      <div class="toolbar">
        <div class="toolbar-group">
          <button class="tool-button" id="newDocumentButton" type="button" title="New document" aria-label="New document">
            <span class="tool-icon" aria-hidden="true">+</span>
            <span class="tool-label">New</span>
          </button>
          <button class="tool-button" id="importButton" type="button" title="Import SVG" aria-label="Import SVG">
            <span class="tool-icon" aria-hidden="true">In</span>
            <span class="tool-label">Import</span>
          </button>
          <input id="fileInput" type="file" accept=".svg,image/svg+xml" hidden>
          <button class="tool-button" id="saveButton" type="button" title="Save over original file" aria-label="Save over original file">
            <span class="tool-icon" aria-hidden="true">S</span>
            <span class="tool-label">Save</span>
          </button>
          <button class="tool-button" id="exportButton" type="button" title="Export SVG" aria-label="Export SVG">
            <span class="tool-icon" aria-hidden="true">Out</span>
            <span class="tool-label">Export</span>
          </button>
        </div>

        <div class="toolbar-group">
          <button class="tool-button" id="undoButton" type="button" title="Undo" aria-label="Undo">
            <span class="tool-icon" aria-hidden="true">U</span>
            <span class="tool-label">Undo</span>
          </button>
          <button class="tool-button" id="redoButton" type="button" title="Redo" aria-label="Redo">
            <span class="tool-icon" aria-hidden="true">R</span>
            <span class="tool-label">Redo</span>
          </button>
          <button class="tool-button" id="duplicateButton" type="button" title="Duplicate" aria-label="Duplicate">
            <span class="tool-icon" aria-hidden="true">C</span>
            <span class="tool-label">Copy</span>
          </button>
          <button class="tool-button" id="deleteButton" type="button" title="Delete" aria-label="Delete">
            <span class="tool-icon" aria-hidden="true">X</span>
            <span class="tool-label">Delete</span>
          </button>
        </div>

        <div class="toolbar-group">
          <button class="tool-button" id="gridSnapButton" type="button" title="Enable grid snap" aria-label="Enable grid snap" aria-pressed="false">
            <span class="tool-icon" aria-hidden="true">#</span>
            <span class="tool-label">Snap</span>
          </button>
          <div class="tool-input-group" id="gridSnapSizeGroup">
            <input class="tool-input" id="gridSnapSizeInput" type="number" min="1" step="1" aria-label="Grid size" title="Grid size (px)">
            <select class="tool-select" id="gridSnapSizeSelect" aria-label="Quick grid size presets" title="Quick grid size presets">
              <option value=""></option>
            </select>
          </div>
          <button class="tool-button" id="sourceToggleButton" type="button" title="Show source" aria-label="Show source" aria-expanded="false">
            <span class="tool-icon" aria-hidden="true">&lt;/&gt;</span>
            <span class="tool-label">Code</span>
          </button>
        </div>
      </div>

      <div class="zoom-controls">
        <button class="tool-button compact" id="zoomOutButton" type="button" title="Zoom out" aria-label="Zoom out">-</button>
        <span id="zoomLabel">100%</span>
        <button class="tool-button compact" id="zoomInButton" type="button" title="Zoom in" aria-label="Zoom in">+</button>
        <button class="tool-button" id="zoomResetButton" type="button" title="Fit to view" aria-label="Fit to view">
          <span class="tool-icon" aria-hidden="true">Fit</span>
          <span class="tool-label">Fit</span>
        </button>
        <button class="tool-button" id="collapseTopbarButton" type="button" title="Hide toolbar" aria-label="Hide toolbar">
          <span class="tool-icon" aria-hidden="true">-</span>
          <span class="tool-label">Hide</span>
        </button>
      </div>
    </header>

    <div class="floating-dock" id="floatingDock">
      <button class="dock-button hidden" id="showTopbarButton" type="button">Toolbar</button>
      <button class="dock-button" id="floatingLeftButton" type="button">Left</button>
      <button class="dock-button" id="floatingRightButton" type="button">Right</button>
    </div>

    <aside class="panel left-panel" id="leftPanel">
      <div class="floating-panel-header">
        <div>
          <h2>Library</h2>
          <div class="panel-segment-toggle" role="tablist" aria-label="Library sections">
            <button class="panel-segment-button is-active" id="leftPanelInsertTab" type="button" role="tab" aria-selected="true" aria-controls="leftPanelInsertSection">Insert</button>
            <button class="panel-segment-button" id="leftPanelLayersTab" type="button" role="tab" aria-selected="false" aria-controls="leftPanelLayersSection">Layers</button>
          </div>
        </div>
        <button class="tool-button compact" id="hideLeftPanelButton" type="button" title="Hide left panel" aria-label="Hide left panel">X</button>
      </div>

      <section class="panel-section left-panel-view" id="leftPanelInsertSection">
        <div class="panel-heading">
          <h2>Insert</h2>
          <span class="hint-text">Click to add</span>
        </div>
        <div class="insert-grid" id="insertGrid">
          <button class="insert-card" type="button" data-insert="rect" title="Insert rectangle" aria-label="Insert rectangle">rect</button>
          <button class="insert-card" type="button" data-insert="circle" title="Insert circle" aria-label="Insert circle">circle</button>
          <button class="insert-card" type="button" data-insert="ellipse" title="Insert ellipse" aria-label="Insert ellipse">ellipse</button>
          <button class="insert-card" type="button" data-insert="line" title="Insert line" aria-label="Insert line">line</button>
          <button class="insert-card" type="button" data-insert="text" title="Insert text" aria-label="Insert text">text</button>
          <button class="insert-card" type="button" data-insert="polyline" title="Insert polyline" aria-label="Insert polyline">polyline</button>
          <button class="insert-card" type="button" data-insert="polygon" title="Insert polygon" aria-label="Insert polygon">polygon</button>
          <button class="insert-card" type="button" data-insert="path" title="Insert path" aria-label="Insert path">path</button>
          <button class="insert-card" id="insertImageButton" type="button" title="Insert image" aria-label="Insert image">image</button>
        </div>
        <input id="imageInput" type="file" accept="image/*,.svg" hidden>
      </section>

      <section class="panel-section left-panel-view hidden" id="leftPanelLayersSection">
        <div class="panel-heading">
          <h2>Layers</h2>
          <span class="count-badge" id="nodeCountBadge">0 nodes</span>
        </div>
        <p class="hint-text">Collapse groups, hide layers, or lock them before editing.</p>
        <div class="tree-panel" id="treePanel"></div>
      </section>
    </aside>

    <main class="workspace-panel">
      <section class="workspace-content" id="workspaceContent">
        <section class="workspace-surface" id="workspaceSurface">
          <div class="surface-grid"></div>
          <div class="surface-inner" id="surfaceInner">
            <div class="svg-host" id="svgHost">
              <svg class="selection-overlay" id="selectionOverlay" aria-hidden="true"></svg>
            </div>
          </div>
          <div class="drop-overlay hidden" id="dropOverlay">Drop to insert file</div>
        </section>

        <section class="source-pane hidden" id="sourcePane">
          <div class="source-pane-header">
            <div>
              <p class="eyebrow">Editor</p>
              <h2>SVG Source</h2>
            </div>
            <button class="tool-button" id="applySourceButton" type="button">
              <span class="tool-icon" aria-hidden="true">OK</span>
              <span class="tool-label">Apply</span>
            </button>
          </div>
          <p class="source-pane-hint">Edit raw SVG and apply your changes when you are ready.</p>
          <textarea class="source-editor source-pane-editor" id="sourceEditor" spellcheck="false"></textarea>
        </section>
      </section>

      <div class="context-menu hidden" id="contextMenu" role="menu" aria-label="Canvas actions">
        <button class="context-menu-item" id="bringToFrontButton" type="button" role="menuitem">Bring To Front</button>
        <button class="context-menu-item" id="sendToBackButton" type="button" role="menuitem">Send To Back</button>
      </div>
    </main>

    <aside class="panel inspector-panel" id="rightPanel">
      <div class="floating-panel-header">
        <div>
          <h2>Inspector</h2>
        </div>
        <button class="tool-button compact" id="hideRightPanelButton" type="button" title="Hide right panel" aria-label="Hide right panel">X</button>
      </div>
      <section class="panel-section">
        <div class="inspector-empty" id="inspectorEmpty">Select an element from the canvas or layer tree.</div>
        <form class="property-form hidden" id="propertyForm"></form>
      </section>
    </aside>
  </div>

  <template id="propertyFieldTemplate">
    <label class="field-row">
      <span class="field-label"></span>
      <input class="field-input">
    </label>
  </template>
`;
