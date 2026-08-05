import { describe, expect, it } from "vitest";
import {
  describeFlag,
  NO_CATEGORY_FLAG,
  needsReview,
  REVIEW_FLAGS,
  unresolvedFlags,
  withFlagResolved,
} from "../review-flags";
import { row } from "./fixtures";

describe("no-category is derived, never stored", () => {
  it("raises the flag from an empty category, with nothing stored on the row", () => {
    expect(unresolvedFlags(row("2026-07-10", -3840, { categoryId: null }))).toEqual([
      NO_CATEGORY_FLAG,
    ]);
    expect(needsReview(row("2026-07-10", -3840, { categoryId: "cat_groceries" }))).toBe(false);
  });

  it("drops a legacy stored copy the moment a category is assigned", () => {
    const stale = row("2026-07-10", -3840, {
      categoryId: "cat_groceries",
      reviewFlags: ["no-category"],
    });
    expect(unresolvedFlags(stale)).toEqual([]);
  });

  it("never doubles a stored copy against the derived one", () => {
    const legacy = row("2026-07-10", -3840, {
      categoryId: null,
      reviewFlags: ["no-category", "near-duplicate"],
    });
    expect(unresolvedFlags(legacy)).toEqual(["no-category", "near-duplicate"]);
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

  it("still surfaces an internal transfer while its auto-flag is unresolved", () => {
    const unconfirmed = row("2026-07-10", -50000, {
      categoryId: null,
      isInternal: true,
      reviewFlags: ["auto-internal"],
    });
    expect(unresolvedFlags(unconfirmed)).toEqual(["auto-internal"]);
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
});

describe("stored flags", () => {
  it("keeps a stored flag until it is explicitly resolved", () => {
    const flagged = row("2026-07-10", -3840, { reviewFlags: ["auto-internal"] });
    expect(unresolvedFlags(flagged)).toEqual(["auto-internal"]);

    const cleared = row("2026-07-10", -3840, {
      reviewFlags: ["auto-internal"],
      resolvedFlags: ["auto-internal"],
    });
    expect(needsReview(cleared)).toBe(false);
  });

  it("resolves a flag once and stays idempotent", () => {
    const flagged = row("2026-07-10", -3840, {
      reviewFlags: ["possible-duplicate"],
      resolvedFlags: ["possible-duplicate"],
    });
    expect(withFlagResolved(flagged, "possible-duplicate")).toEqual(["possible-duplicate"]);
  });
});

describe("flag labels", () => {
  it("names every flag the ledger can raise, the same way on every screen", () => {
    expect(REVIEW_FLAGS).toContain("unmatched-ledger-row");
    for (const flag of REVIEW_FLAGS) expect(describeFlag(flag)).not.toBe(flag);
  });

  it("falls back to the raw flag rather than rendering nothing", () => {
    expect(describeFlag("something-from-the-future")).toBe("something-from-the-future");
  });
});
