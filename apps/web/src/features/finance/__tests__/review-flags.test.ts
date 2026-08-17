import type { FinanceImportBatch } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  buildResolvedFlags,
  countRowsNeedingReview,
  describeFlag,
  describeReviewPrompt,
  hasUnresolvedFlags,
  NO_CATEGORY_FLAG,
  REVIEW_FLAGS,
  unresolvedFlags,
} from "../review-flags";
import { row } from "./fixtures";

describe("no-category is derived, never stored", () => {
  it("raises the flag from an empty category, with nothing stored on the row", () => {
    expect(unresolvedFlags(row("2026-07-10", -3840, { categoryId: null }))).toEqual([
      NO_CATEGORY_FLAG,
    ]);
    expect(hasUnresolvedFlags(row("2026-07-10", -3840, { categoryId: "cat_groceries" }))).toBe(
      false,
    );
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
    expect(hasUnresolvedFlags(transfer)).toBe(false);
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
    expect(hasUnresolvedFlags(cleared)).toBe(false);
  });

  it("resolves a flag once and stays idempotent", () => {
    const flagged = row("2026-07-10", -3840, {
      reviewFlags: ["possible-duplicate"],
      resolvedFlags: ["possible-duplicate"],
    });
    expect(buildResolvedFlags(flagged, "possible-duplicate")).toEqual(["possible-duplicate"]);
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

const batch = (id: string, committedAt: string | null): FinanceImportBatch => ({
  id,
  status: "committed",
  fileNames: [`${id}.csv`],
  fileHashes: [],
  accountId: "acc_chequing",
  detectedFormat: null,
  rowsParsed: 0,
  rowsInserted: 0,
  rowsSkipped: 0,
  startedAt: committedAt ?? "",
  committedAt,
  writtenChunks: 0,
  updatedAt: "",
  fieldUpdatedAt: {},
});

describe("the review prompt", () => {
  const flagged = (importBatchId: string | null) =>
    row("2026-08-07", -3840, { categoryId: null, importBatchId });

  it("counts only the rows that still need the owner", () => {
    const rows = [flagged(null), row("2026-08-07", -1200), flagged(null)];
    expect(countRowsNeedingReview(rows)).toBe(2);
  });

  it("says nothing at all when nothing is flagged", () => {
    expect(describeReviewPrompt([row("2026-08-07", -1200)], [])).toBe("");
  });

  it("names the day of the newest import the flagged rows came from", () => {
    const rows = [flagged("fib_mon"), flagged("fib_wed")];
    const batches = [batch("fib_mon", "2026-08-10T09:00:00.000Z"), batch("fib_wed", "2026-08-12T09:00:00.000Z")];
    expect(describeReviewPrompt(rows, batches)).toBe(
      "2 rows from Wednesday's import need a category or a split",
    );
  });

  it("drops the import clause rather than inventing a day for hand-typed rows", () => {
    expect(describeReviewPrompt([flagged(null)], [])).toBe("1 row needs a category or a split");
  });
});
