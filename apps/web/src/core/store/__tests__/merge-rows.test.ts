import { describe, expect, it } from "vitest";
import { mergeRows } from "../merge-rows";

const row = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  title: id,
  updatedAt: "2026-10-01T00:00:00.000Z",
  tags: ["a"],
  ...over,
});

describe("mergeRows", () => {
  it("keeps the previous array when no row changed", () => {
    const prev = [row("a"), row("b")];
    expect(mergeRows(prev, [row("a"), row("b")])).toBe(prev);
  });

  it("keeps unchanged rows by reference and takes the changed one", () => {
    const prev = [row("a"), row("b")];
    const changed = row("b", { title: "B", updatedAt: "2026-10-02T00:00:00.000Z" });
    const merged = mergeRows(prev, [row("a"), changed]);

    expect(merged).not.toBe(prev);
    expect(merged[0]).toBe(prev[0]);
    expect(merged[1]).toBe(changed);
  });

  it("takes a row whose nested content changed under the same stamp", () => {
    const prev = [row("a")];
    const next = [row("a", { tags: ["a", "b"] })];
    expect(mergeRows(prev, next)[0]).toBe(next[0]);
  });

  it("follows the next order, additions and removals", () => {
    const prev = [row("a"), row("b"), row("c")];
    const added = row("d");
    const merged = mergeRows(prev, [row("c"), added, row("a")]);

    expect(merged.map((r) => r.id)).toEqual(["c", "d", "a"]);
    expect(merged[0]).toBe(prev[2]);
    expect(merged[1]).toBe(added);
    expect(merged[2]).toBe(prev[0]);
  });

  it("treats a missing field as a change", () => {
    const prev = [row("a", { note: "x" })];
    const next = [row("a")];
    expect(mergeRows(prev, next)[0]).toBe(next[0]);
  });
});
