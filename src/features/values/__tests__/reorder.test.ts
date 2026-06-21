import { describe, expect, it } from "vitest";
import { reorderedOrders } from "../reorder";

const items = [
  { id: "a", order: 0 },
  { id: "b", order: 1 },
  { id: "c", order: 2 },
];

describe("reorderedOrders", () => {
  it("moves an item up, swapping order with its predecessor", () => {
    // move "b" up → expect b before a
    expect(reorderedOrders(items, "b", "up")).toEqual([
      { id: "b", order: 0 },
      { id: "a", order: 1 },
    ]);
  });

  it("moves an item down, swapping order with its successor", () => {
    // move "b" down → expect c before b
    expect(reorderedOrders(items, "b", "down")).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
  });

  it("is a no-op moving the first item up", () => {
    expect(reorderedOrders(items, "a", "up")).toEqual([]);
  });

  it("is a no-op moving the last item down", () => {
    expect(reorderedOrders(items, "c", "down")).toEqual([]);
  });

  it("is a no-op for an unknown id", () => {
    expect(reorderedOrders(items, "zzz", "up")).toEqual([]);
  });

  it("sorts by order before resolving neighbours (tolerates unsorted input)", () => {
    const messy = [
      { id: "c", order: 2 },
      { id: "a", order: 0 },
      { id: "b", order: 1 },
    ];
    expect(reorderedOrders(messy, "c", "up")).toEqual([
      { id: "c", order: 1 },
      { id: "b", order: 2 },
    ]);
  });
});
