import { describe, expect, it } from "vitest";
import { queryRecords } from "../record-query";

const schemaKeys = ["id", "order", "name"];
const rows = [
  { id: "b", order: 1, name: "Groceries" },
  { id: "a", order: 2, name: "Gym" },
  { id: "c", order: 1, name: "Library" },
];

describe("queryRecords", () => {
  it("pages in order then id order without repeating rows", () => {
    const first = queryRecords(rows, { schemaKeys, limit: 1 });
    expect(first.rows.map(({ id }) => id)).toEqual(["b"]);
    expect(first.nextCursor).toBeTruthy();
    const second = queryRecords(rows, { schemaKeys, limit: 2, cursor: first.nextCursor ?? "" });
    expect(second.rows.map(({ id }) => id)).toEqual(["c", "a"]);
    expect(second.nextCursor).toBeNull();
  });

  it("rejects unknown filter keys", () => {
    expect(() => queryRecords(rows, { schemaKeys, where: { typo: true } })).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });

  it("replaces a 300 KB row and resumes after it", () => {
    const large = [{ id: "a", name: "x".repeat(300_000) }, { id: "b" }];
    const first = queryRecords(large, { schemaKeys, limit: 1 });
    expect(first.rows).toEqual([{ id: "a", oversized: true }]);
    const second = queryRecords(large, { schemaKeys, cursor: first.nextCursor ?? "" });
    expect(second.rows).toEqual([{ id: "b" }]);
    expect(second.nextCursor).toBeNull();
  });

  it("resumes at the first row dropped due to the page byte cap", () => {
    const large = [
      { id: "a", name: "é".repeat(90_000) },
      { id: "b", name: "x".repeat(100_000) },
    ];
    const first = queryRecords(large, { schemaKeys });
    expect(first.rows.map(({ id }) => id)).toEqual(["a"]);
    expect(queryRecords(large, { schemaKeys, cursor: first.nextCursor ?? "" }).rows).toEqual([
      large[1],
    ]);
  });

  it("matches case-insensitive search terms and scalar filters", () => {
    expect(queryRecords(rows, { schemaKeys, search: "ROC", where: { order: 1 } }).rows).toEqual([
      rows[0],
    ]);
    expect(queryRecords(rows, { schemaKeys, search: "ROC", where: { order: 2 } }).rows).toEqual([]);
  });

  it("rejects malformed cursors", () => {
    expect(() => queryRecords(rows, { schemaKeys, cursor: "invalid" })).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });
});
