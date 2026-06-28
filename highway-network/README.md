# Procedural 3D Highway Network Generator

This folder implements a React + TypeScript browser prototype for the system design plan in:

`C:\Users\29753\Desktop\System Design Plan Procedural 3D Highway Network and Full-Flow Interchange Generator.md`

It is a standalone static tool that turns a geographic graph into:

- directional half-edges
- interchange portals
- all non-U-turn movements
- connector ramps
- a lane graph
- plan-view conflict detection
- DSATUR-style vertical layer assignment
- vertical profiles
- structures
- validation warnings
- a Three.js 3D visualization

## Run

From this folder:

```powershell
npm install
npm run dev
```

Open the Vite URL printed by the dev server, for example:

```text
http://127.0.0.1:5177/
```

For a production build:

```powershell
npm run build
```

## Input Shape

```json
{
  "nodes": [
    { "id": "N", "lat": 40.0, "lon": -74.0, "elevation": 0 }
  ],
  "edges": [
    {
      "id": "A_N",
      "from": "A",
      "to": "N",
      "designSpeed": 100,
      "lanesForward": 3,
      "lanesBackward": 3,
      "roadClass": "motorway"
    }
  ]
}
```

## Implementation Notes

The prototype follows the staged compiler model from the plan:

```text
geo graph -> half-edges -> portals -> movements -> connectors -> conflicts -> layers -> profiles -> structures -> lane graph -> validation -> meshes
```

The lane graph and generated geometric samples are kept separate from render meshes. React owns controls, inspector state, and selected-connector state; the Three.js scene is a typed renderer over generated stores.

This is the first universal fallback implementation. It does not yet include specialized trumpet, turbine, or clover-stack templates, terrain-aware earthworks, real clothoid sampling, swept-volume collision geometry, or corridor-level optimization.
