import { describe, expect, it } from "vitest";
import { COLLECTIONS, createEmptyDataset } from "@/core/persistence";

describe("cards collection registration", () => {
  it("registers cards and cardPrefs with empty defaults", () => {
    expect(COLLECTIONS).toContain("cards");
    expect(COLLECTIONS).toContain("cardPrefs");
    expect(createEmptyDataset().cards).toEqual([]);
    expect(createEmptyDataset().cardPrefs).toEqual([]);
  });

  it("keeps the three retired sources registered so the migration can read them", () => {
    expect(COLLECTIONS).toContain("mindCards");
    expect(COLLECTIONS).toContain("mindMeta");
    expect(COLLECTIONS).toContain("vocab");
  });
});
