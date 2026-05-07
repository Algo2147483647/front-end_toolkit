import assert from "assert/strict";
import { performance } from "perf_hooks";
import { parseConsoleSource } from "../console/dsl";
import { executeConsoleInstructions } from "../console/executor";
import { applyGraphCommand } from "../graph/commands";
import { createInitialCanvasDag, INITIAL_CANVAS_FILE_NAME, INITIAL_CANVAS_NODE_KEY } from "../graph/initialCanvas";
import { normalizeDagInput } from "../graph/normalize";
import { getRelationKeys } from "../graph/relations";
import { serializeDag } from "../graph/serialize";
import { getInitialSelection } from "../graph/selectors";
import { buildRawNodeEditorValue, parseRawNodeEditorValue } from "../components/nodeDetailRawJson";
import { buildStageData } from "../layout/stage-layout";
import { repairSelectionAfterCommand } from "../state/derived";
import { graphReducer, repairHistoryAfterCommand } from "../state/graphReducer";
import { initialGraphAppState, type EditTransaction } from "../state/initialState";
import { loadGraphPagePreferences, parseGraphPagePreferences } from "../state/preferences";
import { arrayFixture, keyedFixture, wrappedFixture } from "./fixtures";

function test(name: string, run: () => void) {
  run();
  console.log(`ok - ${name}`);
}

test("normalizes keyed object input and preserves unknown fields", () => {
  const dag = normalizeDagInput(keyedFixture);
  assert.equal(dag.A.key, "A");
  assert.deepEqual(getRelationKeys(dag.A.children), ["B", "C"]);
  assert.deepEqual(getRelationKeys(dag.C.parents), ["A"]);
  assert.deepEqual(dag.A.extra, { kept: true });
});

test("normalizes array input and removes duplicate relation keys", () => {
  const dag = normalizeDagInput(arrayFixture);
  assert.deepEqual(dag.A.children, ["B"]);
  assert.deepEqual(getRelationKeys(dag.B.parents), ["A"]);
});

test("normalizes wrapper input", () => {
  const dag = normalizeDagInput(wrappedFixture);
  assert.deepEqual(Object.keys(dag), ["A", "B"]);
});

test("page preference parsing restores valid cached config only", () => {
  assert.deepEqual(
    parseGraphPagePreferences(JSON.stringify({ mode: "edit", layoutMode: "dagre" })),
    { mode: "edit", layoutMode: "dagre" },
  );
  assert.deepEqual(
    parseGraphPagePreferences(JSON.stringify({ mode: "invalid", layoutMode: "bfs" })),
    { layoutMode: "bfs" },
  );
  assert.equal(parseGraphPagePreferences("{"), null);
});

test("page preference loading falls back safely when storage data is missing", () => {
  const storage = {
    getItem: () => JSON.stringify({ mode: "edit", layoutMode: "sugiyama" }),
    setItem: () => undefined,
  };
  assert.deepEqual(loadGraphPagePreferences(storage), {
    mode: "edit",
    layoutMode: "sugiyama",
    consoleSidebarOpen: false,
    consoleSidebarWidth: 360,
  });
  assert.deepEqual(loadGraphPagePreferences(null), {
    mode: "preview",
    layoutMode: "bfs",
    consoleSidebarOpen: false,
    consoleSidebarWidth: 360,
  });
});

test("raw node JSON parser supports wrapped node objects and bare node objects", () => {
  assert.deepEqual(
    parseRawNodeEditorValue(JSON.stringify({ Beta: { define: "Updated", extra: true } }), "A"),
    { ok: true, nextKey: "Beta", fields: { define: "Updated", extra: true } },
  );
  assert.deepEqual(
    parseRawNodeEditorValue(JSON.stringify({ key: "Gamma", define: "Inline" }), "A"),
    { ok: true, nextKey: "Gamma", fields: { define: "Inline" } },
  );
});

test("raw node JSON builder omits duplicate key field and parser rejects invalid payloads", () => {
  const built = buildRawNodeEditorValue("A", { key: "A", define: "Root" });
  assert.equal(built.includes('"key"'), false);
  assert.equal(parseRawNodeEditorValue("{", "A").ok, false);
  assert.equal(parseRawNodeEditorValue(JSON.stringify(["A"]), "A").ok, false);
});

test("console parser supports context alias, modifiers, and quoted operands", () => {
  const parsed = parseConsoleSource(`
    # comment
    use "Binary Tree"
    add AVL -p .
    children . = AVL,"Red Black"
    set AVL define "Self-balanced BST"
  `);

  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }
  assert.equal(parsed.instructions.length, 4);
  assert.equal(parsed.instructions[0].type, "use");
  assert.equal(parsed.instructions[1].type, "add");
  assert.equal(parsed.instructions[2].type, "setChildren");
  assert.equal(parsed.instructions[3].type, "setField");
});

test("console execution batches mutations and keeps context in sync with rename", () => {
  const parsed = parseConsoleSource(`
    use A
    mv . Root
    add Child -p .
    children . = Child
  `);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }

  const dag = normalizeDagInput({ A: {} });
  const result = executeConsoleInstructions(dag, parsed.instructions, null);
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.contextNodeKey, "Root");
  assert.ok(result.dag.Root);
  assert.ok(result.dag.Child);
  assert.deepEqual(getRelationKeys(result.dag.Root.children), ["Child"]);
  assert.equal(result.mutationCount, 3);
});

test("console execution reports line-specific failures", () => {
  const parsed = parseConsoleSource(`
    use Missing
    add Child -p .
  `);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) {
    return;
  }

  const dag = normalizeDagInput({ A: {} });
  const result = executeConsoleInstructions(dag, parsed.instructions, null);
  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }
  assert.equal(result.line, 2);
  assert.match(result.message, /does not exist/i);
});

test("initial canvas factory creates a single starting node", () => {
  const dag = createInitialCanvasDag();
  assert.deepEqual(Object.keys(dag), [INITIAL_CANVAS_NODE_KEY]);
  assert.equal(dag[INITIAL_CANVAS_NODE_KEY].label, "Initial Node");
  assert.deepEqual(getRelationKeys(dag[INITIAL_CANVAS_NODE_KEY].children), []);
});

test("commands keep parent child symmetry after setParents and setChildren", () => {
  const dag = normalizeDagInput({ A: {}, B: {}, C: {} });
  const first = applyGraphCommand(dag, { type: "setParents", key: "C", parents: ["A"] }).dag;
  assert.deepEqual(getRelationKeys(first.A.children), ["C"]);
  const second = applyGraphCommand(first, { type: "setChildren", key: "B", children: ["C"] }).dag;
  assert.deepEqual(getRelationKeys(second.C.parents).sort(), ["A", "B"]);
});

test("rename node updates all references", () => {
  const dag = normalizeDagInput(keyedFixture);
  const next = applyGraphCommand(dag, { type: "renameNode", oldKey: "B", newKey: "Beta" }).dag;
  assert.ok(!next.B);
  assert.deepEqual(getRelationKeys(next.A.children).sort(), ["Beta", "C"]);
  assert.deepEqual(getRelationKeys(next.Beta.parents), ["A"]);
});

test("copy node duplicates fields but resets relations to the selected parent only", () => {
  const dag = normalizeDagInput({
    A: { label: "Source", type: "service", define: "Shared config", children: ["B", "C"] },
    B: { foo: { bar: true } },
    C: {},
  });
  const next = applyGraphCommand(dag, { type: "copyNode", sourceKey: "A", key: "A_Copy", parentKey: "A" }).dag;

  assert.equal(next.A_Copy.label, "Source");
  assert.equal(next.A_Copy.type, "service");
  assert.equal(next.A_Copy.define, "Shared config");
  assert.deepEqual(next.A_Copy.foo, undefined);
  assert.deepEqual(getRelationKeys(next.A_Copy.parents), ["A"]);
  assert.deepEqual(getRelationKeys(next.A_Copy.children), []);
  assert.deepEqual(getRelationKeys(next.A.children).sort(), ["A_Copy", "B", "C"]);
});

test("delete node removes inbound and outbound references", () => {
  const dag = normalizeDagInput(keyedFixture);
  const next = applyGraphCommand(dag, { type: "deleteNode", key: "B" }).dag;
  assert.ok(!next.B);
  assert.deepEqual(getRelationKeys(next.A.children), ["C"]);
});

test("serialize removes redundant key field", () => {
  const dag = normalizeDagInput(keyedFixture);
  const serialized = serializeDag(dag);
  assert.equal(serialized.A.key, undefined);
  assert.equal(serialized.A.define, "Root node");
});

test("layout does not mutate input graph", () => {
  const dag = normalizeDagInput(keyedFixture);
  const before = JSON.stringify(dag);
  const stage = buildStageData({ dag, selection: getInitialSelection(dag) });
  assert.ok(stage);
  assert.equal(JSON.stringify(dag), before);
  assert.ok(!("coordinate" in dag.A));
});

test("layout assigns the same color tokens to nodes with the same type", () => {
  const dag = normalizeDagInput({
    A: { type: "service", children: ["B", "C"] },
    B: { type: "database" },
    C: { type: "service" },
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" } });

  assert.ok(stage);
  assert.equal(stage.nodeMap.A.typeLabel, "service");
  assert.equal(stage.nodeMap.B.typeLabel, "database");
  assert.deepEqual(stage.nodeMap.A.colorTokens, stage.nodeMap.C.colorTokens);
  assert.notDeepEqual(stage.nodeMap.A.colorTokens, stage.nodeMap.B.colorTokens);
});

test("layout keeps default node colors when no type field is present", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: {},
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" } });

  assert.ok(stage);
  assert.equal(stage.nodeMap.A.typeLabel, undefined);
  assert.equal(stage.nodeMap.A.colorTokens, undefined);
  assert.equal(stage.nodeMap.B.colorTokens, undefined);
});

test("undo and redo restore graph edits independently from navigation history", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: {},
  });
  const selection = getInitialSelection(dag);
  let state = graphReducer(initialGraphAppState, {
    type: "graphLoaded",
    dag,
    fileName: "undo-redo.json",
    selection,
    status: "Loaded",
  });

  const result = applyGraphCommand(state.dag!, { type: "addNode", key: "C", parentKey: "A" });
  const nextSelection = repairSelectionAfterCommand(result.dag, state.selection, state.selection, result);
  const nextHistory = repairHistoryAfterCommand(state, result);
  const transaction: EditTransaction = {
    label: result.message || "Added node C.",
    beforeDag: state.dag!,
    afterDag: result.dag,
    beforeSelection: state.selection,
    afterSelection: nextSelection,
    beforeNavigationHistory: state.history,
    afterNavigationHistory: nextHistory,
    revisionBefore: state.editHistory.revision,
    revisionAfter: state.editHistory.revision + 1,
  };

  state = graphReducer(state, { type: "graphCommandCommitted", result, transaction });
  assert.ok(state.dag?.C);
  assert.deepEqual(getRelationKeys(state.dag!.A.children), ["B", "C"]);
  assert.equal(state.editHistory.undoStack.length, 1);
  assert.equal(state.editHistory.redoStack.length, 0);
  assert.equal(state.source.dirty, true);

  state = graphReducer(state, { type: "undoRequested" });
  assert.equal(state.dag?.C, undefined);
  assert.deepEqual(getRelationKeys(state.dag!.A.children), ["B"]);
  assert.equal(state.editHistory.undoStack.length, 0);
  assert.equal(state.editHistory.redoStack.length, 1);
  assert.equal(state.source.dirty, false);

  state = graphReducer(state, { type: "redoRequested" });
  assert.ok(state.dag?.C);
  assert.deepEqual(getRelationKeys(state.dag!.A.children), ["B", "C"]);
  assert.equal(state.editHistory.undoStack.length, 1);
  assert.equal(state.editHistory.redoStack.length, 0);
  assert.equal(state.source.dirty, true);
});

test("saved revision keeps dirty state accurate across undo and redo", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: {},
  });
  const selection = getInitialSelection(dag);
  let state = graphReducer(initialGraphAppState, {
    type: "graphLoaded",
    dag,
    fileName: "saved-revision.json",
    selection,
    status: "Loaded",
  });

  const result = applyGraphCommand(state.dag!, { type: "renameNode", oldKey: "B", newKey: "Beta" });
  const nextSelection = repairSelectionAfterCommand(result.dag, state.selection, state.selection, result);
  const nextHistory = repairHistoryAfterCommand(state, result);
  const transaction: EditTransaction = {
    label: result.message || "Renamed node B.",
    beforeDag: state.dag!,
    afterDag: result.dag,
    beforeSelection: state.selection,
    afterSelection: nextSelection,
    beforeNavigationHistory: state.history,
    afterNavigationHistory: nextHistory,
    revisionBefore: state.editHistory.revision,
    revisionAfter: state.editHistory.revision + 1,
  };

  state = graphReducer(state, { type: "graphCommandCommitted", result, transaction });
  assert.equal(state.source.dirty, true);

  state = graphReducer(state, { type: "saved", status: "Saved." });
  assert.equal(state.source.dirty, false);
  assert.equal(state.editHistory.savedRevision, state.editHistory.revision);

  state = graphReducer(state, { type: "undoRequested" });
  assert.equal(state.source.dirty, true);
  assert.ok(state.dag?.B);
  assert.equal(state.dag?.Beta, undefined);

  state = graphReducer(state, { type: "redoRequested" });
  assert.equal(state.source.dirty, false);
  assert.ok(state.dag?.Beta);
  assert.equal(state.dag?.B, undefined);
});

test("new edits clear redo history after an undo", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: {},
  });
  const selection = getInitialSelection(dag);
  let state = graphReducer(initialGraphAppState, {
    type: "graphLoaded",
    dag,
    fileName: "redo-reset.json",
    selection,
    status: "Loaded",
  });

  const firstResult = applyGraphCommand(state.dag!, { type: "addNode", key: "C", parentKey: "A" });
  const firstTransaction: EditTransaction = {
    label: firstResult.message || "Added node C.",
    beforeDag: state.dag!,
    afterDag: firstResult.dag,
    beforeSelection: state.selection,
    afterSelection: repairSelectionAfterCommand(firstResult.dag, state.selection, state.selection, firstResult),
    beforeNavigationHistory: state.history,
    afterNavigationHistory: repairHistoryAfterCommand(state, firstResult),
    revisionBefore: state.editHistory.revision,
    revisionAfter: state.editHistory.revision + 1,
  };
  state = graphReducer(state, { type: "graphCommandCommitted", result: firstResult, transaction: firstTransaction });
  state = graphReducer(state, { type: "undoRequested" });
  assert.equal(state.editHistory.redoStack.length, 1);

  const secondResult = applyGraphCommand(state.dag!, { type: "addNode", key: "D", parentKey: "A" });
  const secondTransaction: EditTransaction = {
    label: secondResult.message || "Added node D.",
    beforeDag: state.dag!,
    afterDag: secondResult.dag,
    beforeSelection: state.selection,
    afterSelection: repairSelectionAfterCommand(secondResult.dag, state.selection, state.selection, secondResult),
    beforeNavigationHistory: state.history,
    afterNavigationHistory: repairHistoryAfterCommand(state, secondResult),
    revisionBefore: state.editHistory.revision,
    revisionAfter: state.editHistory.revision + 1,
  };
  state = graphReducer(state, { type: "graphCommandCommitted", result: secondResult, transaction: secondTransaction });

  assert.equal(state.editHistory.redoStack.length, 0);
  assert.ok(state.dag?.D);
  assert.equal(state.dag?.C, undefined);
});

test("graph reload preserves the active mode and layout configuration", () => {
  const firstDag = normalizeDagInput({ A: { children: ["B"] }, B: {} });
  let state = graphReducer(initialGraphAppState, {
    type: "graphLoaded",
    dag: firstDag,
    fileName: "first.json",
    selection: getInitialSelection(firstDag),
    status: "Loaded first",
  });

  state = graphReducer(state, { type: "modeChanged", mode: "edit" });
  state = graphReducer(state, { type: "layoutModeChanged", mode: "dagre" });

  const secondDag = normalizeDagInput({ Root: { children: ["Leaf"] }, Leaf: {} });
  state = graphReducer(state, {
    type: "graphLoaded",
    dag: secondDag,
    fileName: "second.json",
    selection: getInitialSelection(secondDag),
    status: "Loaded second",
  });

  assert.equal(state.mode, "edit");
  assert.equal(state.layout.mode, "dagre");
});

test("canvas initialization enters edit mode with a single unsaved root node", () => {
  const dag = createInitialCanvasDag();
  const state = graphReducer(initialGraphAppState, {
    type: "canvasInitialized",
    dag,
    fileName: INITIAL_CANVAS_FILE_NAME,
    selection: getInitialSelection(dag),
    status: "Initialized",
  });

  assert.equal(state.mode, "edit");
  assert.equal(state.source.fileName, INITIAL_CANVAS_FILE_NAME);
  assert.equal(state.source.dirty, true);
  assert.equal(state.editHistory.savedRevision, -1);
  assert.deepEqual(Object.keys(state.dag || {}), [INITIAL_CANVAS_NODE_KEY]);
  assert.deepEqual(state.selection, { type: "node", key: INITIAL_CANVAS_NODE_KEY });
});

test("BFS layout remains the default layout mode", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C"] },
    B: { children: ["D"] },
    C: { children: ["E"] },
    D: { children: ["E"] },
    E: {},
  });
  const implicitStage = buildStageData({ dag, selection: { type: "node", key: "A" } });
  const bfsStage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "bfs" });

  assert.ok(implicitStage);
  assert.ok(bfsStage);
  assert.equal(implicitStage.nodeMap.E.layer, bfsStage.nodeMap.E.layer);
  assert.equal(bfsStage.nodeMap.E.layer, 2);
});

test("Dagre layout ranks simple chains left to right", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: { children: ["C"] },
    C: {},
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "dagre" });

  assert.ok(stage);
  assert.equal(stage.nodeMap.A.layer, 0);
  assert.equal(stage.nodeMap.B.layer, 1);
  assert.equal(stage.nodeMap.C.layer, 2);
  assert.ok(stage.nodeMap.A.x < stage.nodeMap.B.x);
  assert.ok(stage.nodeMap.B.x < stage.nodeMap.C.x);
});

test("Dagre layout keeps deterministic node and edge routes", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C"] },
    B: { children: ["D"] },
    C: { children: ["D"] },
    D: {},
  });
  const first = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "dagre" });
  const second = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "dagre" });

  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(
    first.nodes.map((node) => [node.key, node.layer, node.order, node.x, node.y]),
    second.nodes.map((node) => [node.key, node.layer, node.order, node.x, node.y]),
  );
  assert.deepEqual(first.edges, second.edges);
});

test("Dagre layout emits absolute route points for long edges", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C"] },
    B: { children: ["C"] },
    C: {},
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "dagre" });

  assert.ok(stage);
  const longEdge = stage.edges.find((edge) => edge.id === "A-->C");
  assert.ok(longEdge);
  assert.ok(longEdge.points && longEdge.points.length > 0);
  assert.ok(longEdge.points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y)));
});

test("Sugiyama layout ranks multi-parent nodes after their deepest visible parent", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C"] },
    B: { children: ["D"] },
    C: { children: ["E"] },
    D: { children: ["E"] },
    E: {},
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });

  assert.ok(stage);
  assert.equal(stage.nodeMap.A.layer, 0);
  assert.equal(stage.nodeMap.B.layer, 1);
  assert.equal(stage.nodeMap.D.layer, 2);
  assert.equal(stage.nodeMap.E.layer, 3);
});

test("Sugiyama layout is deterministic for the same graph", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C", "D"] },
    B: { children: ["E"] },
    C: { children: ["E", "F"] },
    D: { children: ["F"] },
    E: {},
    F: {},
  });
  const first = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });
  const second = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });

  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(
    first.nodes.map((node) => [node.key, node.layer, node.order, node.x, node.y]),
    second.nodes.map((node) => [node.key, node.layer, node.order, node.x, node.y]),
  );
});

test("Sugiyama layout warns and continues when a visible cycle is present", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: { children: ["C"] },
    C: { children: ["B"] },
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });

  assert.ok(stage);
  assert.ok(stage.nodeMap.A);
  assert.ok(stage.nodeMap.B);
  assert.ok(stage.nodeMap.C);
  assert.ok(stage.warnings.length > 0);
});

test("Sugiyama layout routes long edges through intermediate layer slots", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C"] },
    B: { children: ["C"] },
    C: {},
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });

  assert.ok(stage);
  const longEdge = stage.edges.find((edge) => edge.id === "A-->C");
  assert.ok(longEdge);
  assert.ok(longEdge.points && longEdge.points.length > 0);
  assert.equal(longEdge.points[0].layer, 1);
});

test("Sugiyama cycle handling marks reversed layout edges without dropping semantic edges", () => {
  const dag = normalizeDagInput({
    A: { children: ["B"] },
    B: { children: ["C"] },
    C: { children: ["B"] },
  });
  const stage = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });

  assert.ok(stage);
  assert.equal(stage.edges.length, 3);
  assert.ok(stage.warnings.some((warning) => warning.includes("cycle")));
});

test("Sugiyama long-edge route points are deterministic", () => {
  const dag = normalizeDagInput({
    A: { children: ["B", "C"] },
    B: { children: ["C"] },
    C: {},
  });
  const first = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });
  const second = buildStageData({ dag, selection: { type: "node", key: "A" }, layoutMode: "sugiyama" });

  assert.ok(first);
  assert.ok(second);
  assert.deepEqual(first.edges, second.edges);
});

test("Sugiyama crossing reduction orders adjacent layer to reduce crossings", () => {
  const dag = normalizeDagInput({
    A: { children: ["D"] },
    B: { children: ["C"] },
    C: {},
    D: {},
  });
  const stage = buildStageData({ dag, selection: { type: "forest", keys: ["A", "B"], label: "Roots" }, layoutMode: "sugiyama" });

  assert.ok(stage);
  assert.ok(stage.nodeMap.C.order < stage.nodeMap.D.order);
});

test("Sugiyama layout handles long root fanout chains within the performance budget", () => {
  const layerCount = 40;
  const input: Record<string, { children?: string[] }> = {
    Root: { children: [] },
  };

  for (let index = 1; index <= layerCount; index += 1) {
    const key = `N${index}`;
    input[key] = index < layerCount ? { children: [`N${index + 1}`] } : {};
    input.Root.children!.push(key);
  }

  const dag = normalizeDagInput(input);
  const startedAt = performance.now();
  const stage = buildStageData({ dag, selection: { type: "node", key: "Root" }, layoutMode: "sugiyama" });
  const elapsedMs = performance.now() - startedAt;

  assert.ok(stage);
  assert.equal(stage.nodeMap.N40.layer, 40);
  assert.ok(elapsedMs < 250, `Expected long-edge fanout layout under 250ms, got ${elapsedMs.toFixed(1)}ms`);
});
