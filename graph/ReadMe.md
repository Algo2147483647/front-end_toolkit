# DAG Studio

`graph/` is a browser-based graph viewer and lightweight JSON editor for directed graph data.

It is designed for:

- loading a JSON graph file and rendering it immediately
- navigating large graphs by subtree or parent level
- editing node relationships directly in the UI
- undoing and redoing graph edits in edit mode
- inspecting all node fields in a generic viewer
- saving the updated graph back to JSON

## Run

DAG Studio is now a Vite React and TypeScript app:

```powershell
cd D:\Algo\Projects\front-end_toolkit\graph
npm install
npm run dev
```

Then open:

```text
http://localhost:5173/graph/index.html
```

When the page loads, it automatically reads [`public/example.json`](D:\Algo\Projects\front-end_toolkit\graph\public\example.json).

Build and run the graph core tests with:

```powershell
npm test
npm run build
```

## Main Features

- `Preview / Edit` mode switch
- remembers page preferences such as `Preview / Edit` mode and layout selection across refreshes
- auto-load default sample data from `example.json`
- initialize a fresh canvas with one starting node for blank-slate editing
- edit-mode console sidebar with command history, suggestions, and batch graph edits
- forest rendering for multiple root nodes
- optional node color grouping by `type`
- click a node to focus on that node or subtree
- `Back` to return to the previous selection
- `Up` to move to the parent level
- right-click a node to open the node menu
- `help` command in the console prints the available command reference in-place
- generic `View Node` page for all node fields
- edit-mode node details support both field-by-field editing and direct raw JSON editing
- edit relationships and rerender immediately
- `Undo / Redo` for graph edits in edit mode
- export current view as SVG
- save graph JSON as overwrite or as a new timestamped file

## Initialize Canvas

Use `Initialize Canvas` from the empty state or the `Controls` panel to start from a blank graph.

- the app creates a single centered root node named `Initial_Node`
- the canvas switches into `Edit` mode automatically
- the new graph is treated as unsaved until you export or save it as JSON

## Layout Modes

- `BFS`: keeps the selected root traversal close to breadth-first discovery order.
- `Sugiyama layered`: ranks nodes by directed dependency depth, breaks visible cycles for layout, inserts virtual route points for long edges, and applies crossing-reduction sweeps before rendering.
- `Dagre layered`: uses the Dagre layered engine with `network-simplex` ranking and absolute routed points for a more industrial, library-backed dependency layout.

## Graph Console

In `Edit` mode, use `Show Console Sidebar` from the controls panel to open the left-side console.

The console is designed for fast text-based graph edits:

- one line is one instruction
- multiple lines run as one batch
- successful mutation batches commit as a single undo step
- parse or execution errors stop at the first failing line
- command history is available with the arrow keys when suggestions are not open
- `clear` or `cls` clears the console output
- `help` prints the current command reference directly in the console

Common commands:

- `help`
- `use <node>`
- `show <node>`
- `json <node>`
- `mv <old-key> <new-key>`
- `rm <node>` / `rm -r <node>`
- `add <new-key>` / `add <new-key> -p <parent>`
- `cp <source> <new-key>` / `cp <source> <new-key> -p <parent>`
- `parents <node> = A,B`
- `children <node> = A,B`
- `set <node> <field> "value"`

The full console reference lives in [`GraphConsoleDSL.md`](D:\Algo\Projects\front-end_toolkit\graph\GraphConsoleDSL.md).

## How Navigation Works

After loading JSON, the renderer first looks for nodes with no parents.

- if there is one such node, it becomes the focused root
- if there are multiple such nodes, they are rendered as a forest
- clicking a node focuses that node
- clicking `Up` renders that node's parent level
- if multiple parents exist, the parent level is rendered as a forest

## Recommended JSON Shape

The recommended and easiest format is an object keyed by node key:

```json
{
  "Graph": {
    "define": "A graph is a set of vertices and edges.",
    "children": {
      "Tree": "subtype_of",
      "DAG": "subtype_of"
    }
  },
  "Tree": {
    "define": "A tree is a connected acyclic graph.",
    "parents": {
      "Graph": "subtype_of"
    },
    "children": {
      "Binary_Tree": "subtype_of"
    }
  },
  "Binary_Tree": {
    "define": "A tree where each node has at most two children.",
    "parents": {
      "Tree": "subtype_of"
    }
  },
  "DAG": {
    "define": "A directed acyclic graph.",
    "parents": {
      "Graph": "subtype_of"
    }
  }
}
```

## Field Rules

Each node is just a JSON object. The viewer is generic and preserves extra fields.

Only a small set of fields has built-in graph meaning:

- `children`: downstream node references
- `parents`: upstream node references
- `define`: main description text shown in the node card and in the viewer
- `label`, `title`, `name`: optional display text fallback for the node title
- `type`: optional node category used for color grouping

All other fields are kept as-is and can still be viewed in `View Node`.

Example:

```json
{
  "Linear_Space": {
    "label": "Linear Space",
    "define": "A vector space over a field.",
    "parents": {},
    "children": {
      "Affine_Space": "defined_on"
    },
    "aliases": ["vector space"],
    "tags": ["algebra", "geometry"],
    "metadata": {
      "difficulty": "medium",
      "domain": "mathematics"
    }
  }
}
```

## Node Color Grouping

If a node includes a `type` field, DAG Studio groups nodes by unique `type` value and assigns each category its own accent color.

- nodes with the same `type` share the same visual accent
- accents are applied through the node border, pin, and active states
- card backgrounds stay in the default white style for readability
- if no nodes define `type`, the graph uses the original default coloring

Example:

```json
{
  "Model_Registry": {
    "type": "data",
    "children": {
      "Online_Inference": "deploys_to"
    }
  },
  "Online_Inference": {
    "type": "service"
  }
}
```

## `children` and `parents`

Both `children` and `parents` support two forms.

### 1. Array form

Use this when you only care about structure:

```json
{
  "A": {
    "children": ["B", "C"]
  },
  "B": {
    "parents": ["A"]
  },
  "C": {
    "parents": ["A"]
  }
}
```

### 2. Object form

Use this when you also want edge labels:

```json
{
  "A": {
    "children": {
      "B": "subtype_of",
      "C": "depends_on"
    }
  },
  "B": {
    "parents": {
      "A": "subtype_of"
    }
  },
  "C": {
    "parents": {
      "A": "depends_on"
    }
  }
}
```

Object form is usually better because edge labels can be displayed in the graph.

## Relationship Normalization

The app normalizes and synchronizes graph relationships.

That means:

- missing referenced nodes are created automatically
- if `children` points to another node, that node gets the matching `parents` link
- if `parents` points to another node, that node gets the matching `children` link
- duplicate relation keys are removed

You do not need to maintain both directions perfectly by hand, but keeping both sides explicit is still recommended for clarity.

## Supported Top-Level Inputs

The recommended format is the keyed object above, but these are also supported:

### Array of nodes

```json
[
  {
    "key": "A",
    "define": "Node A",
    "children": ["B"]
  },
  {
    "key": "B",
    "define": "Node B"
  }
]
```

### Wrapper object with `nodes`

```json
{
  "nodes": [
    {
      "key": "A",
      "children": ["B"]
    },
    {
      "key": "B"
    }
  ]
}
```

If you are creating data from scratch, prefer the keyed-object format.

## Editing in the UI

Switch to `Edit` mode to enable graph editing.

Right-click a node to access:

- `View Node`
- `Copy Key`
- `Copy Node`
- `Add Child Node`
- `Edit Children`
- `Edit Parents`
- `Rename Node Key`
- `Delete Node`
- `Delete Subtree`

Behavior notes:

- `Copy Key` copies the node key to the clipboard
- `Copy Node` creates a new node by copying the selected node's non-relation fields
- `Add Child Node` creates a node and links it as a child of the selected node
- `Rename Node Key` checks for duplicate keys
- `Delete Node` removes that node and clears references from other nodes
- `Delete Subtree` removes the selected node and all descendants
- `Edit Parents` and `Edit Children` update JSON and rerender immediately
- `View Node` in edit mode also lets you edit the node's raw JSON directly, including adding or removing custom fields
- delete actions run immediately without an extra confirm dialog

In `Preview` mode, the node menu keeps the non-destructive actions such as `View Node` and `Copy Key`, while edit-only actions stay disabled.

## Undo and Redo

Edit mode keeps a separate graph-edit history that is independent from focus navigation.

- `Back` still returns to the previous focused selection
- `Undo / Redo` only apply to graph data edits
- supported edit actions include add, delete, rename, field edits, and parent/child relation edits
- making a new edit after `Undo` clears the redo stack
- edit history is capped internally to avoid unbounded memory growth

Keyboard shortcuts:

- `Ctrl+Z` / `Cmd+Z`: undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: redo
- `Ctrl+Y`: redo

The shortcuts are ignored while typing in inputs, textareas, selects, or other editable fields.

## View Node

`View Node` opens a generic node detail page.

It shows:

- every key-value pair inside the node
- `define` as text
- `parents` and `children` as relation sets
- the raw JSON for the node

This viewer does not assume a fixed business schema, so it works well for custom node fields.

## Saving JSON

The top bar includes `Save JSON`.

When clicked:

- `Overwrite Original`: write the edited JSON back to the source file
- `Save New Copy`: download a timestamped JSON copy
- `Cancel`: close the save dialog

Default new-file naming:

```text
original-name-YYYYMMDD-HHMMSS.json
```

Direct overwrite uses the browser File System Access API. When available, choosing a JSON file through the workspace picker binds the file handle so `Overwrite Original` can write back to disk. If file access is unavailable, save a new copy instead.

Dirty-state tracking is revision-based, so undoing back to the last saved version automatically clears the unsaved state, and redoing away from it marks the graph dirty again.

## Rendering Notes

- node title is chosen from `label`, `title`, `name`, or the node key
- node subtitle is derived from `define`
- subtitle shows up to two lines with ellipsis
- card height stays fixed
- edge labels come from relation values in `children` or `parents`

## Minimal Example

If you want the smallest useful file, start here:

```json
{
  "A": {
    "define": "Root node",
    "children": {
      "B": "related_to",
      "C": "related_to"
    }
  },
  "B": {
    "define": "Child node B"
  },
  "C": {
    "define": "Child node C"
  }
}
```

## Recommendations for Data Authors

- use stable, unique keys
- prefer the keyed-object top-level format
- prefer `children` object form if edge labels matter
- use `define` for the main readable description
- keep additional metadata in extra fields instead of overloading relation fields
- use English field names for shared datasets when possible

## Files

- main page: [`index.html`](D:\Algo\Projects\front-end_toolkit\graph\index.html)
- React source: `graph/src/`
- styles: [`styles.css`](D:\Algo\Projects\front-end_toolkit\graph\styles.css) plus `graph/src/styles.css`
- sample data: [`public/example.json`](D:\Algo\Projects\front-end_toolkit\graph\public\example.json)
- console reference: [`GraphConsoleDSL.md`](D:\Algo\Projects\front-end_toolkit\graph\GraphConsoleDSL.md)
