import { describe, expect, it } from "vitest";
import { ALIGN_LABEL, alignOf } from "./align";

describe("alignOf", () => {
  it("treats a goal as aspirational (goal wins over value)", () => {
    expect(alignOf({ goalId: "g1", valueId: "v1" })).toBe("aspirational");
    expect(alignOf({ goalId: "g1" })).toBe("aspirational");
  });

  it("treats a value-only item as maintenance", () => {
    expect(alignOf({ valueId: "v1" })).toBe("maintenance");
    expect(alignOf({ goalId: null, valueId: "v1" })).toBe("maintenance");
  });

  it("treats an unattached item as logistical", () => {
    expect(alignOf({})).toBe("logistical");
    expect(alignOf({ goalId: null, valueId: null })).toBe("logistical");
  });

  it("maps each alignment to its human label", () => {
    expect(ALIGN_LABEL.aspirational).toBe("Goal work");
    expect(ALIGN_LABEL.maintenance).toBe("Upkeep");
    expect(ALIGN_LABEL.logistical).toBe("Errand");
  });
});
