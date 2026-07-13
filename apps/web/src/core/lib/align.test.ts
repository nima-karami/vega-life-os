import { describe, expect, it } from "vitest";
import { ALIGN_LABEL, getAlignment } from "./align";

describe("getAlignment", () => {
  it("treats a goal as aspirational (goal wins over value)", () => {
    expect(getAlignment({ goalId: "g1", valueId: "v1" })).toBe("aspirational");
    expect(getAlignment({ goalId: "g1" })).toBe("aspirational");
  });

  it("treats a value-only item as maintenance", () => {
    expect(getAlignment({ valueId: "v1" })).toBe("maintenance");
    expect(getAlignment({ goalId: null, valueId: "v1" })).toBe("maintenance");
  });

  it("treats an unattached item as logistical", () => {
    expect(getAlignment({})).toBe("logistical");
    expect(getAlignment({ goalId: null, valueId: null })).toBe("logistical");
  });

  it("maps each alignment to its human label", () => {
    expect(ALIGN_LABEL.aspirational).toBe("Goal work");
    expect(ALIGN_LABEL.maintenance).toBe("Upkeep");
    expect(ALIGN_LABEL.logistical).toBe("Errand");
  });
});
