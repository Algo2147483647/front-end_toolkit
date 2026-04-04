# Front-End Toolkit

Front-End Toolkit is a browser-based collection of front-end utilities for form design, JSON processing, DAG visualization, timeline exploration, SVG editing, and clock/calendar/globe experiences. Each major subdirectory in this repository is effectively an independent static web tool that can be run locally, used for prototyping, or deployed as static assets.

## Overview

- Pure front-end implementation built primarily with `HTML + CSS + JavaScript`.
- Each tool is isolated by directory; there is no single app shell or unified build pipeline.
- Most pages can be opened directly in a browser, but using a local static server is recommended for better compatibility.
- This repository is best understood as a toolkit, not a monolithic application.

## Included Tools

| Directory | Tool | Purpose | Status |
| --- | --- | --- | --- |
| `form/` | Visual Schema Studio | Visual form design and schema editing | Usable |
| `json/` | JSON Toolbox | JSON formatting, validation, escaping, and diffing | Usable |
| `graph/` | DAG Studio | DAG import, focused graph exploration, SVG export | Usable |
| `timeline/` | Timeline Atlas | Time-aware DAG and event timeline visualization | Usable |
| `svg/` | SVG Studio | In-browser SVG editor | Usable |
| `time/` | Geometric Clock and Calendar | Clock, calendar, and globe with timezone interaction | Usable |

## Recommended Ways to Run

The repository currently does not include a `package.json` and does not depend on a build step. The simplest and most reliable way to run it is with a local static server.

### Option 1: Use Python

```powershell
cd D:\Algo\Projects\front-end_toolkit
python -m http.server 8080
```

Then open:

- `http://localhost:8080/form/`
- `http://localhost:8080/json/`
- `http://localhost:8080/graph/`
- `http://localhost:8080/timeline/`
- `http://localhost:8080/svg/`
- `http://localhost:8080/time/`

### Option 2: Open HTML Files Directly

For tools such as `json/`, `form/`, `graph/`, and `time/`, opening `index.html` directly will often work.

Using `http://localhost` is still recommended for these modules:

- `timeline/`: the default sample dataset is loaded with `fetch`, which may be blocked under the `file://` protocol.
- `svg/`: uses ES Modules, and its overwrite-save flow depends on the Chromium File System Access API, which behaves more reliably in a local-server context.

## Tool Details

### 1. `form/` Visual Schema Studio

This is one of the most complete tools in the repository and is designed for quickly assembling structured forms and exporting schema data.

Key capabilities:

- Drag components from the left panel into the central canvas.
- Supports basic fields such as `Input`, `Textarea`, `InputNumber`, `Switch`, `Radio`, `Checkbox`, `Select`, and `Cascader`.
- Supports layout components such as `Card`, `Divider`, `Grid`, and `Collapse`.
- Supports additional fields such as `DatePicker`, `TimePicker`, `ColorPicker`, and `Slider`.
- A property inspector lets you configure title, description, default value, required state, disabled state, read-only state, options, and layout parameters.
- Includes a component tree for hierarchical inspection and selection.
- Supports conditional visibility rules that are applied in preview mode.
- Supports schema import, export, and direct JSON editing in code mode.
- Includes form preview and submission result preview.
- Property panel width and collapsed state are persisted in `localStorage`.

Good fit for:

- Back-office form prototyping.
- Structured schema generation and inspection.
- Demonstrating nested containers, layout composition, and conditional field visibility.

### 2. `json/` JSON Toolbox

This is a practical day-to-day JSON utility page for common development workflows.

Key capabilities:

- Format JSON.
- Minify JSON.
- Validate JSON.
- Sort object keys.
- Configure indentation width with spaces or tabs.
- Escape and unescape JSON text.
- Copy results to the clipboard.
- Download processed JSON output.
- Compare two JSON payloads side by side.
- Show character counts for input and output areas.

Good fit for:

- Cleaning API responses.
- Preparing configuration payloads.
- Comparing two JSON documents quickly in the browser.

### 3. `graph/` DAG Studio

This tool imports DAG data and renders a focused graph view intended for exploring a root or subtree interactively.

Key capabilities:

- Import a local JSON file.
- Detect root nodes automatically.
- Create a synthetic aggregate root when multiple roots exist.
- Click a node to refocus the view on that node's subtree.
- Navigate backward through focus history.
- Highlight local relationships on hover.
- Export the current graph view as SVG.

The accepted input structure is flexible. These shapes are supported:

```json
{
  "A": { "kids": ["B", "C"] },
  "B": { "kids": ["D"] },
  "C": { "kids": [] },
  "D": { "kids": [] }
}
```

```json
[
  { "key": "A", "kids": ["B", "C"] },
  { "key": "B", "kids": ["D"] },
  { "key": "C", "kids": [] },
  { "key": "D", "kids": [] }
]
```

```json
{
  "nodes": [
    { "key": "A", "kids": ["B", "C"] },
    { "key": "B", "kids": ["D"] }
  ]
}
```

### 4. `timeline/` Timeline Atlas

This module combines event relationships with a timeline layout and is useful for showing historical or causal evolution across branches.

Key capabilities:

- Loads the repository sample dataset from `example.json` by default.
- Supports loading a same-origin JSON path or uploading a local JSON file.
- Renders both point-in-time events and time-range events.
- Draws parent-child links and highlights upstream/downstream lineage on hover.
- Lets you adjust branch width and year spacing.
- Supports zooming and SVG export.
- Hover cards show time, location, relationship counts, and extra metadata.

`timeline/example.json` reflects the recommended data shape. A typical event object looks like this:

```json
[
  {
    "key": "event_a",
    "time": ["1900", "1910"],
    "space": ["Location A"],
    "data": {
      "event": "Example Event",
      "significance": "Why it matters"
    },
    "parents": [],
    "kids": ["event_b"]
  }
]
```

Field notes:

- `key`: unique event identifier.
- `time`: one value usually means a point event; two values usually mean a time range.
- `space`: location metadata, typically an array.
- `data`: extra event metadata shown in the hover card.
- `parents` / `kids`: graph relationships between events.

### 5. `svg/` SVG Studio

`svg/` is not a placeholder directory. It already contains a working browser-based SVG editor with substantially more functionality than the original root README suggested.

Key capabilities:

- Create, import, and export SVG documents.
- Attempt overwrite-save to the original file in supported browsers.
- Insert `rect`, `circle`, `ellipse`, `line`, `text`, `polyline`, `polygon`, `path`, and image elements.
- Show a layer tree with selection, collapsing, locking, and visibility toggles.
- Edit geometry, fill, stroke, opacity, font, and other attributes in the inspector.
- Open a source pane and edit raw SVG text directly.
- Supports undo, redo, duplicate, and delete.
- Supports zoom, fit-to-view, toolbar collapse, and left/right panel toggling.
- Supports grid snapping and stores related preferences in `localStorage`.
- Sanitizes dangerous tags and some unsafe style/reference content during document handling.
- Loads a built-in sample SVG on startup so the editor is immediately explorable.

Usage notes:

- Overwrite-save depends on the browser supporting the File System Access API and is typically best in Chromium-based browsers.
- Saving over the original file is most useful after importing a file through the editor.

### 6. `time/` Geometric Clock and Calendar

This module combines a stylized clock, a calendar, and an interactive globe in one page, with some lightweight cross-feature synchronization.

Key capabilities:

- Shows an analog geometric clock and synchronized digital clock.
- Supports smooth and ticking second-hand modes.
- Lets you resize the clock face.
- Includes month navigation and a jump-to-today action in the calendar.
- Includes an interactive rotating globe view.
- Can center on the user's detected location.
- Lets you adjust globe size, tilt, and rotation speed.
- Supports showing and hiding the day-night terminator.
- Approximates timezone changes from longitude and notifies the clock/calendar views.

Notes:

- Geolocation depends on browser permission.
- Timezone handling is approximate and based on longitude, so this is better treated as a visualization feature than a strict timezone utility.

## Directory Structure

```text
front-end_toolkit/
|-- form/                  # Visual form designer
|-- graph/                 # DAG visualization tool
|-- json/                  # JSON utility tool
|-- svg/                   # SVG editor
|-- time/                  # Clock / calendar / globe tool
|-- timeline/              # Timeline DAG visualization
|-- scripts/               # Repository-level helper scripts
|-- ReadMe.md              # Root documentation
`-- start-codex-proxy.ps1  # Local helper script
```

## Technical Characteristics

- Built mostly with native browser APIs such as `FileReader`, `Blob`, `Canvas`, `SVG`, `localStorage`, and `Geolocation`.
- Some pages pull third-party assets from CDNs, including `Font Awesome`, `Ant Design CSS`, and `Google Fonts`.
- `svg/` is the most modularized tool and uses ES Modules.
- There is no shared framework-level state model or component system across all directories.

## Deployment

This repository is well suited for static hosting, including:

- Nginx
- GitHub Pages
- Vercel static hosting
- Local `python -m http.server`

In most cases, deployment does not require a build step as long as the directory structure is preserved.

## Known Boundaries and Guidance

- This is a multi-tool repository, so code style and maturity vary by directory.
- The root README should be treated as the primary overview, but subdirectory README files may still contain older descriptions.
- Some UI text remains English-only, and a few files show historical encoding artifacts. These do not block the main functionality but are worth cleaning up later.
- If you continue extending the repository, keeping the current "one directory per tool" structure is the safest approach.

## Contribution Guidance

If you plan to continue evolving this toolkit, these conventions are recommended:

1. Keep each new tool in its own directory.
2. Make sure each tool has a clear `index.html`, style entry, and script entry.
3. Update the root README whenever a user-facing module changes materially.
4. Document browser-specific dependencies when a tool requires them.

## License

There is currently no explicit license file at the repository root. If you plan to distribute the project publicly or accept external contributions, adding a `LICENSE` file is recommended.
