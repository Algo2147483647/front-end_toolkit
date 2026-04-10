# DAG Studio

`graph/` is a browser-based graph viewer and lightweight JSON editor for directed graph data.

It is designed for:

- loading a JSON graph file and rendering it immediately
- navigating large graphs by subtree or parent level
- editing node relationships directly in the UI
- inspecting all node fields in a generic viewer
- saving the updated graph back to JSON

## Run

The simplest way to use the tool is to serve the repository with a local static server:

```powershell
cd D:\Algo\Projects\front-end_toolkit
python -m http.server 8080
```

Then open:

```text
http://localhost:8080/graph/
```

When the page loads, it automatically reads [`example.json`](D:\Algo\Projects\front-end_toolkit\graph\example.json).

## Main Features

- `Preview / Edit` mode switch
- auto-load default sample data from `example.json`
- forest rendering for multiple root nodes
- click a node to focus on that node or subtree
- `Back` to return to the previous selection
- `Up` to move to the parent level
- right-click a node to open the node menu
- generic `View Node` page for all node fields
- edit relationships and rerender immediately
- export current view as SVG
- save graph JSON as overwrite or as a new timestamped file

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
- `Rename Node Key`
- `Delete Node`
- `Delete Subtree`
- `Edit Parents`
- `Edit Children`
- `Add Node`

Behavior notes:

- `Rename Node Key` checks for duplicate keys
- `Delete Node` removes that node and clears references from other nodes
- `Delete Subtree` removes the selected node and all descendants
- `Edit Parents` and `Edit Children` update JSON and rerender immediately
- `Add Node` creates a node and can optionally link it to the selected node

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

- `OK`: save as a new file
- `Cancel`: save using the original file name

Default new-file naming:

```text
original-name-YYYYMMDD-HHMMSS.json
```

In browser environments, overwrite is implemented as a same-name download.

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
- styles: [`styles.css`](D:\Algo\Projects\front-end_toolkit\graph\styles.css)
- sample data: [`example.json`](D:\Algo\Projects\front-end_toolkit\graph\example.json)
- scripts: `graph/scripts/`
