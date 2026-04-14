import assert from "assert/strict";
import { applyGraphCommand } from "../graph/commands";
import { normalizeDagInput } from "../graph/normalize";
import { getRelationKeys } from "../graph/relations";
import { serializeDag } from "../graph/serialize";
import { getInitialSelection } from "../graph/selectors";
import { buildStageData } from "../layout/stage-layout";
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
