import { describe, expect, it } from "vitest";
import { createSyncCursor, readSyncReceipt } from "../sync";

describe("sync cursor", () => {
  it("refetches until it has seen a version", () => {
    const cursor = createSyncCursor();
    expect(cursor.shouldRefetch(4)).toBe(true);
    expect(cursor.shouldRefetch(4)).toBe(false);
  });

  it("does not refetch for the version its own write produced", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    cursor.recordOwnWrite(6);
    expect(cursor.shouldRefetch(6)).toBe(false);
  });

  it("refetches when another writer took a version between its own", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    cursor.recordOwnWrite(7);
    expect(cursor.shouldRefetch(7)).toBe(true);
  });

  it("advances across its own concurrent writes whatever order they settle in", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    cursor.recordOwnWrite(8);
    cursor.recordOwnWrite(6);
    cursor.recordOwnWrite(7);
    expect(cursor.shouldRefetch(8)).toBe(false);
  });

  it("refetches when a foreign write lands after its own", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    cursor.recordOwnWrite(6);
    expect(cursor.shouldRefetch(7)).toBe(true);
    expect(cursor.shouldRefetch(7)).toBe(false);
  });

  it("never moves backwards on a stale poll", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    cursor.recordOwnWrite(6);
    expect(cursor.shouldRefetch(5)).toBe(false);
    expect(cursor.shouldRefetch(6)).toBe(false);
  });

  it("ignores an own write that a refetch already covered", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    expect(cursor.shouldRefetch(7)).toBe(true);
    cursor.recordOwnWrite(6);
    cursor.recordOwnWrite(8);
    expect(cursor.shouldRefetch(8)).toBe(false);
  });

  it("trusts no own write before it knows where it stands", () => {
    const cursor = createSyncCursor();
    cursor.reset(null);
    cursor.recordOwnWrite(1);
    expect(cursor.shouldRefetch(1)).toBe(true);
  });

  it("refetches on the next poll after an incomplete refetch, whatever its own writes say", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    expect(cursor.shouldRefetch(6)).toBe(true);
    cursor.invalidate();
    cursor.recordOwnWrite(7);
    expect(cursor.shouldRefetch(7)).toBe(true);
    expect(cursor.shouldRefetch(7)).toBe(false);
  });

  it("forgets pending own writes on reset", () => {
    const cursor = createSyncCursor();
    cursor.reset(5);
    cursor.recordOwnWrite(7);
    cursor.reset(10);
    cursor.recordOwnWrite(6);
    expect(cursor.shouldRefetch(10)).toBe(false);
  });
});

describe("readSyncReceipt", () => {
  it("reads the version a new server reports", () => {
    expect(readSyncReceipt({ id: "t1", syncVersion: 9 })).toBe(9);
  });

  it("reads nothing from an old server's response or a write that changed nothing", () => {
    expect(readSyncReceipt({ id: "t1" })).toBeNull();
    expect(readSyncReceipt({ syncVersion: null })).toBeNull();
    expect(readSyncReceipt(undefined)).toBeNull();
    expect(readSyncReceipt({ syncVersion: "9" })).toBeNull();
  });
});
