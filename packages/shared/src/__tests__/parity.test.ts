import { describe, expect, it } from "vitest";
import { COLLECTIONS, schemasByCollection } from "../collections";

// Mirrors apps/web/src/core/persistence/adapter.ts COLLECTIONS (19 collections).
const EXPECTED_COLLECTION_COUNT = 21;

describe("collection parity", () => {
  it("registers exactly the expected number of collections", () => {
    expect(COLLECTIONS).toHaveLength(EXPECTED_COLLECTION_COUNT);
  });

  it("has a schema for every collection name", () => {
    for (const name of COLLECTIONS) {
      expect(schemasByCollection[name]).toBeDefined();
    }
  });

  it("has no schema without a matching collection", () => {
    expect(Object.keys(schemasByCollection).sort()).toEqual([...COLLECTIONS].sort());
  });
});
