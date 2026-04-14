import type { RawGraphInput } from "../graph/types";

export const keyedFixture: RawGraphInput = {
  A: {
    define: "Root node",
    children: {
      B: "depends_on",
      C: "depends_on",
    },
    extra: { kept: true },
  },
  B: {
    parents: {
      A: "depends_on",
    },
  },
  C: {},
};

export const arrayFixture: RawGraphInput = [
  { key: "A", children: ["B", "B"] },
  { key: "B" },
];

export const wrappedFixture: RawGraphInput = {
  nodes: [
    { key: "A", children: ["B"] },
    { key: "B" },
  ],
};
