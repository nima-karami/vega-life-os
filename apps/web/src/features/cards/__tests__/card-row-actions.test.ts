import { CARD_TYPE_IDS, CARD_TYPES } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { buildLearningOptions, buildTypeOptions } from "../manager/card-row-actions";
import { buildCard } from "./fixtures";

describe("buildTypeOptions", () => {
  it("offers every registered type, in registry order", () => {
    expect(buildTypeOptions().map((option) => option.id)).toEqual([
      "note",
      "quote",
      "excerpt",
      "fact",
      "prompt",
      "vocabulary",
    ]);
  });

  // Spec §12: registering a type must reach the Type filter group with no other file touched.
  // The filter panel and the row chip both render from this one function, so proving it here
  // proves the group — a hard-coded list in the panel would make the claim untrue.
  it("carries a newly registered type into the Type group", () => {
    const withFixture = {
      ...CARD_TYPES,
      koan: { ...CARD_TYPES.note, label: "Koan" },
    };
    expect(buildTypeOptions(withFixture).map((option) => option.id)).toEqual([
      ...CARD_TYPE_IDS,
      "koan",
    ]);
    expect(buildTypeOptions(withFixture).at(-1)?.label).toBe("Koan");
  });
});

describe("buildLearningOptions", () => {
  it("offers both states on a card that folds by default", () => {
    const options = buildLearningOptions(buildCard({ type: "note" }));
    expect(options.map((option) => option.id)).toEqual(["learning", "not-learning"]);
    expect(options.every((option) => option.isDisabled !== true)).toBe(true);
  });

  it("disables learning on a prompt", () => {
    const options = buildLearningOptions(buildCard({ type: "prompt" }));
    expect(options.find((option) => option.id === "learning")?.isDisabled).toBe(true);
  });

  it("disables learning on a card with nothing withheld", () => {
    const options = buildLearningOptions(buildCard({ type: "quote", hasRecall: false }));
    expect(options.find((option) => option.id === "learning")?.isDisabled).toBe(true);
  });
});
