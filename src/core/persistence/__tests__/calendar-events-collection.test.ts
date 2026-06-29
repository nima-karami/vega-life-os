import { describe, expect, it } from "vitest";
import { COLLECTIONS, emptyDataset } from "@/core/persistence";

describe("calendarEvents collection registration", () => {
  it("is a known collection with an empty default", () => {
    expect(COLLECTIONS).toContain("calendarEvents");
    expect(emptyDataset().calendarEvents).toEqual([]);
  });
});
