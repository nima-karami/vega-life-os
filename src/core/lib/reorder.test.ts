import { describe, expect, it } from "vitest";
import { arrayMove, reorderByIds } from "./reorder";

const items = [
  { id: "a", order: 0 },
  { id: "b", order: 1 },
  { id: "c", order: 2 },
];

describe("arrayMove", () => {
  it("moves an item forward", () => {
    expect(arrayMove(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves an item backward", () => {
    expect(arrayMove(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("does not mutate the input", () => {
    const src = ["a", "b", "c"];
    arrayMove(src, 0, 2);
    expect(src).toEqual(["a", "b", "c"]);
  });
});

describe("reorderByIds", () => {
  it("renumbers only the rows whose order changed (drag forward)", () => {
    // a → c slot: new order b, c, a
    expect(reorderByIds(items, "a", "c")).toEqual([
      { id: "b", order: 0 },
      { id: "c", order: 1 },
      { id: "a", order: 2 },
    ]);
  });

  it("renumbers correctly when dragging backward", () => {
    // c → a slot: new order c, a, b
    expect(reorderByIds(items, "c", "a")).toEqual([
      { id: "c", order: 0 },
      { id: "a", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("emits the minimal set for an adjacent swap", () => {
    // a → b slot only swaps a and b; c is unchanged so it is omitted
    expect(reorderByIds(items, "a", "b")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
    ]);
  });

  it("is a no-op dropping an item on itself", () => {
    expect(reorderByIds(items, "b", "b")).toEqual([]);
  });

  it("is a no-op for an unknown active id", () => {
    expect(reorderByIds(items, "zzz", "a")).toEqual([]);
  });

  it("is a no-op for an unknown over id", () => {
    expect(reorderByIds(items, "a", "zzz")).toEqual([]);
  });

  it("operates on the given display order, not a re-sort by order", () => {
    // displayed order differs from the `order` field (e.g. tasks sorted by time):
    const displayed = [
      { id: "x", order: 5 },
      { id: "y", order: 2 },
      { id: "z", order: 9 },
    ];
    // drag y onto x → new sequence y, x, z renumbered 0,1,2
    expect(reorderByIds(displayed, "y", "x")).toEqual([
      { id: "y", order: 0 },
      { id: "x", order: 1 },
      { id: "z", order: 2 },
    ]);
  });
});
