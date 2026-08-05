import { describe, expect, it } from "vitest";
import { groupForReview } from "../review-queue";
import { row } from "./fixtures";

describe("review queue", () => {
  it("stands a row under every flag it still carries", () => {
    const both = row("2026-07-10", -3840, {
      categoryId: null,
      reviewFlags: ["near-duplicate"],
    });
    const groups = groupForReview([both]);

    expect(groups.map((group) => group.flag)).toEqual(["no-category", "near-duplicate"]);
    expect(groups.every((group) => group.rows[0].id === both.id)).toBe(true);
  });

  it("surfaces a flag the backfill raises, not just the ones the importer knows", () => {
    const backfilled = row("2026-07-10", -3840, {
      categoryId: "cat_groceries",
      reviewFlags: ["unmatched-ledger-row"],
    });
    const groups = groupForReview([backfilled]);

    expect(groups.map((group) => group.flag)).toEqual(["unmatched-ledger-row"]);
    expect(groups[0].label).toBe("Unmatched ledger row");
  });

  it("drops a group once nothing is left in it", () => {
    expect(groupForReview([row("2026-07-10", -3840, { categoryId: "cat_groceries" })])).toEqual([]);
  });
});
