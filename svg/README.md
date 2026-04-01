# SVG Editor Design Document

## 1. Product Overview

This tool will be a browser-based SVG editor focused on editing complex vector graphics with many layers, reusable definitions, and precise geometry controls.

It is intended to fit the current repository style: a standalone front-end tool that can run by opening `index.html` directly in a browser, without requiring a build step.

## 2. Goals

### Core Goals

1. Support editing complex SVG documents instead of only simple icon-like shapes.
2. Provide both visual editing and structure-aware editing.
3. Keep the original SVG as editable as possible after import.
4. Maintain good interaction performance on large documents.
5. Make advanced SVG concepts visible and operable for front-end developers and designers.

### Non-Goals for V1

1. Do not aim to replace Illustrator, Figma, or Inkscape completely.
2. Do not implement raster painting features.
3. Do not support every SVG spec feature in the first version.
4. Do not add real-time multi-user collaboration in the first phase.

## 3. Target Users

### Primary Users

1. Front-end developers who need to inspect and modify complex SVG assets.
2. Designers or PMs who need lightweight browser-side structure edits.
3. Engineers who need to optimize, annotate, or parameterize SVG for product use.

### Representative Scenarios

1. Open a large SVG illustration and adjust group hierarchy, colors, gradients, and transforms.
2. Edit icon sets or technical diagrams containing nested `<g>`, `<path>`, `<defs>`, `<clipPath>`, `<mask>`, and text.
3. Clean up exported SVG from design tools by removing redundant nodes and normalizing attributes.
4. Select one object visually while still being able to edit its exact attributes and path data.

## 4. Product Principles

1. Visual first, source aware: canvas editing and DOM-level editing must stay in sync.
2. Precise and reversible: every operation should be undoable.
3. Large-document friendly: the UI should remain usable for hundreds or thousands of nodes.
4. Progressive complexity: basic actions should be easy, advanced SVG features should stay discoverable.

## 5. Information Architecture

Recommended page layout:

1. Top toolbar
   - File actions: new, import, export, save snapshot
   - Edit actions: undo, redo, duplicate, delete
   - View actions: zoom, fit to screen, grid, outline mode
   - Mode switch: select, pan, shape, path, text
2. Left sidebar
   - Document tree
   - Layers and visibility
   - Reusable resources (`defs`, gradients, symbols, masks, filters)
3. Center workspace
   - Infinite-like canvas viewport
   - Selection box, control handles, guides, rulers, alignment helpers
4. Right sidebar
   - Properties panel
   - Geometry
   - Appearance
   - Transform
   - Text
   - Advanced attributes
5. Bottom panel
   - Source view
   - Console / validation messages
   - Path editor or node inspector when needed

## 6. Functional Scope

### V1 Must-Have

1. Import SVG from file upload, paste, or raw text.
2. Render SVG accurately in the canvas area.
3. Show a hierarchical document tree with expand/collapse, rename, visibility, and lock state.
4. Single and multi-selection.
5. Drag, resize, rotate, and reorder elements.
6. Edit common attributes:
   - `fill`, `stroke`, `stroke-width`, `opacity`
   - `x`, `y`, `width`, `height`, `rx`, `ry`
   - `cx`, `cy`, `r`
   - `transform`
   - text content and font-related attributes
7. Support group operations:
   - group
   - ungroup
   - move into / out of parent groups
8. Support source editing with two-way sync.
9. Undo / redo history.
10. Export edited SVG.

### V1 Important Advanced Features

1. `defs` resource browser.
2. Gradient editing for linear and radial gradients.
3. Symbol and `<use>` instance management.
4. Basic clip-path and mask binding.
5. Path data editing:
   - inspect `d`
   - move anchor points
   - edit control points for curves
6. Alignment and distribution tools.
7. Snap system:
   - grid snap
   - guide snap
   - bounding-box snap
8. Basic validation:
   - duplicate ids
   - invalid references
   - unsupported or risky attributes

### Later Phases

1. Boolean operations for paths.
2. Filter editor.
3. Variable-driven templates for themeable SVG.
4. Plugin system for custom processors.
5. Collaboration and comments.

## 7. Interaction Design

### Selection Model

1. Click to select a node on canvas.
2. Shift-click to extend selection.
3. Tree selection and canvas selection remain synchronized.
4. Locked nodes are visible but not editable.
5. Isolation mode can focus on a deep group when the hierarchy is large.

### Editing Modes

1. Select mode for general element selection and transformation.
2. Pan mode for navigating large artboards.
3. Shape creation mode for rectangle, ellipse, line, polygon, and text.
4. Path edit mode for anchor-point manipulation.
5. Source mode for direct SVG text editing.

### Property Editing

1. Common properties use visual controls.
2. Complex or uncommon attributes stay editable in raw key-value form.
3. Changes should apply immediately and create history entries.
4. Multi-selection should expose shared editable attributes.

## 8. Data Model

The editor should keep multiple synchronized representations:

1. Original source text
2. Parsed SVG DOM
3. Internal editor node tree
4. Derived render metadata
5. History snapshots or patches

Suggested editor node structure:

```js
{
  id: "node-123",
  tag: "path",
  attrs: {
    fill: "#0f766e",
    stroke: "#0f172a",
    d: "M10 10 L100 40"
  },
  children: [],
  meta: {
    name: "Hero line",
    locked: false,
    hidden: false,
    selected: false
  }
}
```

### Key State Domains

1. `documentState`
2. `selectionState`
3. `viewportState`
4. `historyState`
5. `resourceState`
6. `uiState`

## 9. Technical Architecture

To match the current repository conventions, the tool should be organized as a static modular app:

```text
svg/
  index.html
  README.md
  styles.css
  scripts/
    app.js
    state.js
    parser.js
    renderer.js
    treePanel.js
    selection.js
    transformControls.js
    propertiesPanel.js
    sourcePanel.js
    history.js
    resources.js
    pathEditor.js
```

### Module Responsibilities

1. `app.js`
   - bootstrap application
   - wire modules and global events
2. `state.js`
   - central editor state
   - subscriptions and actions
3. `parser.js`
   - import SVG text
   - sanitize and normalize structure
4. `renderer.js`
   - mount SVG into viewport
   - manage overlays for handles and guides
5. `treePanel.js`
   - render hierarchy
   - manage reorder and visibility
6. `selection.js`
   - hit testing
   - selection logic
7. `transformControls.js`
   - move / resize / rotate interaction
8. `propertiesPanel.js`
   - attribute forms
   - section-based editing
9. `sourcePanel.js`
   - code view
   - diff or error hints
10. `history.js`
   - undo / redo
11. `resources.js`
   - defs, gradient, mask, symbol registry
12. `pathEditor.js`
   - anchor-point editing

## 10. Performance Strategy

Complex SVG is the hard part of this project, so performance must be part of the design from the start.

### Rendering

1. Keep the actual SVG rendering native in the browser whenever possible.
2. Render selection handles and guides in a separate overlay layer.
3. Avoid full document rerender for small attribute updates.

### Tree and Panel Performance

1. Use incremental DOM updates for the layer tree.
2. Collapse deep branches by default when importing large files.
3. Defer expensive derived calculations until the node is selected or visible.

### Interaction Performance

1. Use requestAnimationFrame for drag and transform feedback.
2. Separate preview updates from commit updates for history.
3. Cache bounding boxes where valid, and invalidate selectively.

### Large File Safeguards

1. Warn when node count exceeds thresholds.
2. Provide outline mode to reduce visual cost.
3. Provide an option to suspend filters or masks during editing preview.

## 11. Import / Export Rules

### Import

1. Preserve tags and attributes whenever possible.
2. Normalize missing ids for editor targeting, but do not overwrite existing ids silently.
3. Detect unsupported features and show non-blocking warnings.

### Export

1. Export clean valid SVG text.
2. Preserve user edits and original structure as much as possible.
3. Optionally provide optimization passes:
   - remove editor-only metadata
   - normalize transforms
   - collapse redundant groups

## 12. Error Handling and Safety

1. Invalid source input should never crash the page.
2. Parse failures should point to approximate line or node context.
3. Potentially unsafe external references should be flagged.
4. Autosave snapshots should protect against accidental refresh or browser crash.

## 13. Accessibility

1. Toolbar, tree, and property controls should be keyboard reachable.
2. Selected node and focused panel should have clear visual state.
3. Important actions should expose shortcuts and visible labels.
4. Color-only state differences should be avoided in critical controls.

## 14. Milestone Plan

### Milestone 1: Foundation

1. Static layout
2. SVG import and render
3. Tree panel
4. Selection model
5. Property editing for basic shapes

### Milestone 2: Core Editing

1. Transform controls
2. Undo / redo
3. Reorder and grouping
4. Source panel with sync

### Milestone 3: Advanced SVG

1. Defs browser
2. Gradient editor
3. Use / symbol support
4. Path editing

### Milestone 4: Usability and Scale

1. Snap system
2. Alignment tools
3. Validation and warnings
4. Large-document performance improvements

## 15. Recommended Next Step

The best next implementation step is to create a clickable V1 skeleton with:

1. Three-column layout and toolbar
2. SVG import textarea or file picker
3. Canvas render area
4. Tree panel with selection sync
5. Right-side property editor for common attributes

That scope is small enough to ship quickly, while still proving the key architecture for complex SVG editing.
