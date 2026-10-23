import { describe, expect, it } from "vitest";
import { findById } from "../id-index";

describe("findById", () => {
  it("matches find, including the first row when an id repeats", () => {
    const rows = [
      { id: "a", n: 1 },
      { id: "b", n: 2 },
      { id: "a", n: 3 },
    ];
    expect(findById(rows, "a")).toBe(rows[0]);
    expect(findById(rows, "b")).toBe(rows[1]);
    expect(findById(rows, "missing")).toBeUndefined();
    expect(findById(rows, null)).toBeUndefined();
  });

  it("sees a replaced array, not the index of the one before it", () => {
    const before = [{ id: "a", n: 1 }];
    expect(findById(before, "a")?.n).toBe(1);
    const after = [
      { id: "a", n: 2 },
      { id: "b", n: 3 },
    ];
    expect(findById(after, "a")?.n).toBe(2);
    expect(findById(after, "b")?.n).toBe(3);
    expect(findById(before, "b")).toBeUndefined();
  });
});
