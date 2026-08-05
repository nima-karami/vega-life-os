import { describe, expect, it } from "vitest";
import { groupForReview, needsReview, unresolvedFlags, withFlagResolved } from "../review-queue";
import { row } from "./fixtures";

describe("review queue", () => {
  it("derives no-category from the row rather than reading a stored flag", () => {
    const uncategorised = row("2026-07-10", -3840, { categoryId: null });
    expect(unresolvedFlags(uncategorised)).toEqual(["no-category"]);

    const filed = row("2026-07-10", -3840, { categoryId: "cat_groceries" });
    expect(needsReview(filed)).toBe(false);
  });

  it("never asks an internal transfer for a category", () => {
    const transfer = row("2026-07-10", -50000, {
      categoryId: null,
      isInternal: true,
      reviewFlags: ["auto-internal"],
      resolvedFlags: ["auto-internal"],
    });
    expect(needsReview(transfer)).toBe(false);
  });

  it("asks for a category again once a false-positive transfer is un-flagged", () => {
    const restored = row("2026-07-10", -3840, {
      categoryId: null,
      isInternal: false,
      reviewFlags: ["auto-internal"],
      resolvedFlags: ["auto-internal"],
    });
    expect(unresolvedFlags(restored)).toEqual(["no-category"]);
  });

  it("keeps a stored flag until it is explicitly resolved", () => {
    const flagged = row("2026-07-10", -3840, { reviewFlags: ["auto-internal"] });
    expect(unresolvedFlags(flagged)).toEqual(["auto-internal"]);

    const cleared = row("2026-07-10", -3840, {
      reviewFlags: ["auto-internal"],
      resolvedFlags: ["auto-internal"],
    });
    expect(needsReview(cleared)).toBe(false);
  });

  it("stands a row under every flag it still carries", () => {
    const both = row("2026-07-10", -3840, {
      categoryId: null,
      reviewFlags: ["near-duplicate"],
    });
    const groups = groupForReview([both]);

    expect(groups.map((group) => group.flag)).toEqual(["no-category", "near-duplicate"]);
    expect(groups.every((group) => group.rows[0].id === both.id)).toBe(true);
  });

  it("drops a group once nothing is left in it", () => {
    expect(groupForReview([row("2026-07-10", -3840, { categoryId: "cat_groceries" })])).toEqual([]);
  });

  it("resolves a flag once and stays idempotent", () => {
    const flagged = row("2026-07-10", -3840, {
      reviewFlags: ["possible-duplicate"],
      resolvedFlags: ["possible-duplicate"],
    });
    expect(withFlagResolved(flagged, "possible-duplicate")).toEqual(["possible-duplicate"]);
  });
});
