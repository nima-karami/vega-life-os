import { describe, expect, it } from "vitest";
import { cascadeCounts, cascadeMessage } from "../cascade";

describe("cascadeCounts", () => {
  const goals = [
    { id: "g1", valueId: "v1" },
    { id: "g2", valueId: "v1" },
    { id: "g3", valueId: "v2" },
  ];
  const habits = [
    { id: "h1", valueId: "v1" },
    { id: "h2", valueId: "v2" },
  ];

  it("counts goals and habits tied to a value", () => {
    expect(cascadeCounts("v1", { goals, habits })).toEqual({ goals: 2, habits: 1 });
  });

  it("returns zeroes for a value with no dependents", () => {
    expect(cascadeCounts("v3", { goals, habits })).toEqual({ goals: 0, habits: 0 });
  });
});

describe("cascadeMessage", () => {
  it("returns null when nothing cascades (no extra warning needed)", () => {
    expect(cascadeMessage({ goals: 0, habits: 0 })).toBeNull();
  });

  it("uses singular nouns for a count of one", () => {
    expect(cascadeMessage({ goals: 1, habits: 1 })).toBe(
      "This also removes 1 goal and 1 habit tied to it, plus their scheduled tasks. This can't be undone.",
    );
  });

  it("uses plural nouns for counts above one", () => {
    expect(cascadeMessage({ goals: 2, habits: 3 })).toBe(
      "This also removes 2 goals and 3 habits tied to it, plus their scheduled tasks. This can't be undone.",
    );
  });

  it("handles a mix of zero and non-zero counts", () => {
    expect(cascadeMessage({ goals: 0, habits: 2 })).toBe(
      "This also removes 0 goals and 2 habits tied to it, plus their scheduled tasks. This can't be undone.",
    );
  });
});
