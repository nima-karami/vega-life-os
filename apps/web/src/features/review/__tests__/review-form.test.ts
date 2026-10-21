import { describe, expect, it } from "vitest";
import type { Value } from "@/features/values/model";
import { REVIEW_PROMPTS, type Review } from "../model";
import {
  haveCheckInsChanged,
  listCheckInValues,
  mergePromptsForSave,
  setCheckIn,
  splitReviewPrompts,
  toggleCheckIn,
} from "../review-form";

const review = (prompts: Review["prompts"]): Review => ({
  id: "r",
  periodKey: "2026-06-08",
  prompts,
  checkIns: [],
  createdAt: "2026-06-14T10:00:00",
});

const valueWith = (id: string, archivedAt: string | null = null, restingAt: string | null = null) =>
  ({ id, name: id, archivedAt, restingAt }) as Value;

describe("splitReviewPrompts", () => {
  it("separates legacy prompts from the current ones", () => {
    const shared = REVIEW_PROMPTS[3];
    const { answers, legacy } = splitReviewPrompts(
      review([
        { q: "What went well this week?", a: "walks" },
        { q: "What slipped, and why?", a: "admin" },
        { q: "Which value got too little of you?", a: "rest" },
        { q: shared, a: "taxes" },
      ]),
    );
    expect(answers).toEqual(["", "", "", "taxes"]);
    expect(legacy.map((p) => p.q)).toEqual([
      "What went well this week?",
      "What slipped, and why?",
      "Which value got too little of you?",
    ]);
  });

  it("returns empty answers without a stored review", () => {
    expect(splitReviewPrompts(undefined)).toEqual({ answers: ["", "", "", ""], legacy: [] });
  });
});

describe("mergePromptsForSave", () => {
  it("writes the current prompts then the legacy ones verbatim", () => {
    const legacy = [{ q: "Old?", a: "kept" }];
    const merged = mergePromptsForSave(["a", "b", "c", "d"], legacy);
    expect(merged.map((p) => p.a)).toEqual(["a", "b", "c", "d", "kept"]);
    expect(merged[4]).toEqual(legacy[0]);
  });
});

describe("setCheckIn", () => {
  it("places, moves and clears a value without toggling", () => {
    const placed = setCheckIn([], "v1", 5);
    expect(placed).toEqual([{ valueId: "v1", rating: 5 }]);
    expect(setCheckIn(placed, "v1", 5)).toEqual(placed);
    expect(setCheckIn(placed, "v1", 2)).toEqual([{ valueId: "v1", rating: 2 }]);
    expect(setCheckIn(placed, "v1", null)).toEqual([]);
  });

  it("keeps the other values and their order", () => {
    const both = setCheckIn(setCheckIn([], "v1", 1), "v2", 3);
    expect(setCheckIn(both, "v1", 4)).toEqual([
      { valueId: "v1", rating: 4 },
      { valueId: "v2", rating: 3 },
    ]);
    expect(setCheckIn(both, "v3", null)).toEqual(both);
  });
});

describe("toggleCheckIn", () => {
  it("adds, replaces and clears a rating", () => {
    const first = toggleCheckIn([], "v1", 4);
    expect(first).toEqual([{ valueId: "v1", rating: 4 }]);
    const replaced = toggleCheckIn(first, "v1", 2);
    expect(replaced).toEqual([{ valueId: "v1", rating: 2 }]);
    expect(toggleCheckIn(replaced, "v1", 2)).toEqual([]);
  });

  it("keeps one entry per value and a stable order", () => {
    const next = toggleCheckIn(toggleCheckIn([], "v1", 1), "v2", 5);
    expect(toggleCheckIn(next, "v1", 3).map((c) => c.valueId)).toEqual(["v1", "v2"]);
  });
});

describe("listCheckInValues", () => {
  it("hides a resting value that has no check-in", () => {
    const values = [valueWith("v1"), valueWith("v2", null, "2026-10-01")];
    expect(listCheckInValues(values, [], []).map((v) => v.id)).toEqual(["v1"]);
  });

  it("keeps a resting value that already has a check-in", () => {
    const values = [valueWith("v1"), valueWith("v2", null, "2026-10-01")];
    const listed = listCheckInValues(values, [{ valueId: "v2", rating: 4 }], []);
    expect(listed.map((v) => v.id)).toEqual(["v1", "v2"]);
  });

  it("keeps an archived value that already has a check-in", () => {
    const values = [valueWith("v1", "2026-01-01", "2026-10-01")];
    expect(listCheckInValues(values, [{ valueId: "v1", rating: 2 }], [])).toHaveLength(1);
  });

  it("hides an archived value unless it has a check-in", () => {
    const values = [valueWith("v1"), valueWith("v2", "2026-01-01"), valueWith("v3", "2026-01-01")];
    const listed = listCheckInValues(values, [{ valueId: "v3", rating: 3 }], []);
    expect(listed.map((v) => v.id)).toEqual(["v1", "v3"]);
  });

  it("keeps a saved resting value listed after its rating is cleared", () => {
    const values = [valueWith("v1"), valueWith("v2", null, "2026-10-01")];
    const listed = listCheckInValues(values, [], [{ valueId: "v2", rating: 4 }]);
    expect(listed.map((v) => v.id)).toEqual(["v1", "v2"]);
  });
});

describe("haveCheckInsChanged", () => {
  it("ignores order", () => {
    const a = [
      { valueId: "v1", rating: 1 },
      { valueId: "v2", rating: 2 },
    ];
    expect(haveCheckInsChanged(a, [...a].reverse())).toBe(false);
  });

  it("detects a changed, added or removed rating", () => {
    const a = [{ valueId: "v1", rating: 1 }];
    expect(haveCheckInsChanged(a, [{ valueId: "v1", rating: 2 }])).toBe(true);
    expect(haveCheckInsChanged(a, [])).toBe(true);
    expect(haveCheckInsChanged([], a)).toBe(true);
  });
});
