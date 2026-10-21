import type { FinanceCategory, FinanceMerchant } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  buildLedgerLookups,
  buildLedgerRowView,
  indexAnnualRepeats,
  type LedgerLookups,
  NO_FIGURE,
  PICK_CATEGORY_LABEL,
} from "../ledger-row";
import { GROCERIES, row } from "./fixtures";

const DINING = "cat_dining";

const category = (id: string, name: string, colorIndex: number): FinanceCategory => ({
  id,
  name,
  kind: "spend",
  order: colorIndex,
  colorIndex,
  archivedAt: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

const merchant = (id: string, pattern: string, patch: Partial<FinanceMerchant> = {}) =>
  ({
    id,
    pattern,
    displayName: "",
    defaultCategoryId: null,
    defaultSpreadMonths: 1,
    timesSeen: 1,
    timesShared: 0,
    lastSeenAt: null,
    updatedAt: "",
    fieldUpdatedAt: {},
    ...patch,
  }) satisfies FinanceMerchant;

const lookups = (patch: Partial<Parameters<typeof buildLedgerLookups>[0]> = {}): LedgerLookups =>
  buildLedgerLookups({
    categories: [category(GROCERIES, "Groceries", 0), category(DINING, "Dining out", 1)],
    merchants: [],
    transactions: [],
    settledMonths: new Set(),
    partnerName: "",
    ...patch,
  });

describe("a ledger row's title", () => {
  it("prefers the row's own title", () => {
    const txn = row("2026-08-11", -1000, { title: "Weekly shop", description: "GREEN MARKET" });
    expect(buildLedgerRowView(txn, lookups()).title).toBe("Weekly shop");
  });

  it("falls back to the merchant's display name when the row has no title", () => {
    const txn = row("2026-08-11", -1000, {
      merchantId: "fmer_market",
      description: "GREEN MKT #1",
    });
    const view = buildLedgerRowView(
      txn,
      lookups({
        merchants: [merchant("fmer_market", "GREEN MKT", { displayName: "Green Market" })],
      }),
    );
    expect(view.title).toBe("Green Market");
  });

  it("leaves an imported row on its raw descriptor until the merchant is resolved", () => {
    const txn = row("2026-08-09", -12999, { categoryId: null, description: "AMZN Mktp CA REF789" });
    expect(buildLedgerRowView(txn, lookups()).title).toBe("AMZN Mktp CA REF789");
  });
});

describe("a ledger row's category cell", () => {
  it("reads the assigned category with its own palette colour", () => {
    const view = buildLedgerRowView(row("2026-08-11", -1000), lookups());
    expect(view.category.tone).toBe("assigned");
    expect(view.category.label).toBe("Groceries");
    expect(view.category.color).not.toBeNull();
  });

  it("offers the learned merchant's category as a guess, not as an assignment", () => {
    const txn = row("2026-08-09", -4218, { categoryId: null, description: "YUMI *EATS ANYTOWN" });
    const view = buildLedgerRowView(
      txn,
      lookups({
        merchants: [merchant("fmer_yumi", "YUMI *EATS ANYTOWN", { defaultCategoryId: DINING })],
      }),
    );
    expect(view.category.tone).toBe("guess");
    expect(view.category.label).toBe("Dining out");
    expect(view.category.suggestionId).toBe(DINING);
    // A guess never clears the review state — the row still needs the owner.
    expect(view.isUnreviewed).toBe(true);
  });

  it("asks for a category when no merchant has ever been filed", () => {
    const txn = row("2026-08-09", -12999, { categoryId: null, description: "SQ *8231 VENDOR" });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.category.tone).toBe("missing");
    expect(view.category.label).toBe(PICK_CATEGORY_LABEL);
    expect(view.category.suggestionId).toBeNull();
  });

  it("treats a category that no longer exists as unfiled rather than rendering a blank chip", () => {
    const txn = row("2026-08-09", -1000, { categoryId: "cat_deleted" });
    expect(buildLedgerRowView(txn, lookups()).category.tone).toBe("missing");
  });

  it("never asks an internal transfer for a category — a transfer does not earn one", () => {
    const txn = row("2026-08-08", -50000, { categoryId: null, isInternal: true });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.category.tone).toBe("exempt");
    expect(view.isUnreviewed).toBe(false);
  });
});

describe("a ledger row's split, in both registers", () => {
  it("says `mine` on a row the owner bears alone", () => {
    const view = buildLedgerRowView(row("2026-08-11", -4000), lookups());
    expect(view.splitPhrase).toBe("mine");
    expect(view.metaPhrase).toBe("mine");
  });

  it("carries the trailing `mine` on the ledger and drops it on the phone", () => {
    const txn = row("2026-08-11", -8312, { isHousehold: true, myShareBps: 5000 });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.splitPhrase).toBe("shared · 50% mine");
    expect(view.metaPhrase).toBe("shared 50%");
  });

  it("names the payer on the phone when the partner covered a shared row", () => {
    const txn = row("2026-08-06", -10020, {
      isHousehold: true,
      myShareBps: 5000,
      payer: "partner",
    });
    expect(buildLedgerRowView(txn, lookups({ partnerName: "Robin" })).metaPhrase).toBe(
      "Robin paid",
    );
  });

  it("falls back to a generic payer rather than rendering `  paid` with no name", () => {
    const txn = row("2026-08-06", -10020, { isHousehold: true, payer: "partner" });
    expect(buildLedgerRowView(txn, lookups()).metaPhrase).toBe("Partner paid");
  });

  it("lets a spread row say so on the phone, where the split has no room", () => {
    const txn = row("2026-08-07", -12000, { spreadMonths: 12 });
    expect(buildLedgerRowView(txn, lookups()).metaPhrase).toBe("spread ×12");
  });

  it("prints Not set and no share at all while the row is unreviewed", () => {
    const txn = row("2026-08-09", -12999, { categoryId: null });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.splitPhrase).toBe(NO_FIGURE);
    expect(view.metaPhrase).toBe("");
    expect(view.shareCents).toBeNull();
  });
});

describe("a ledger row's money", () => {
  it("reads a charge as a positive magnitude and its share beside it", () => {
    const txn = row("2026-08-11", -12999, { isHousehold: true, myShareBps: 8000 });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.fullCents).toBe(12999);
    expect(view.shareCents).toBe(10399);
    expect(view.isMoneyIn).toBe(false);
  });

  it("gives a spread row the whole charge in full and one month's slice in the share", () => {
    const txn = row("2026-08-07", -12000, { spreadMonths: 12 });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.fullCents).toBe(12000);
    expect(view.shareCents).toBe(1000);
  });

  it("carries a money-in row negative in both columns", () => {
    const txn = row("2026-08-05", 6440, { refundOfTransactionId: "ftxn_monitor" });
    const view = buildLedgerRowView(txn, lookups());
    expect(view.fullCents).toBe(-6440);
    expect(view.shareCents).toBe(-6440);
    expect(view.isMoneyIn).toBe(true);
    expect(view.isRefund).toBe(true);
  });

  it("keeps income out of the refund chip — money in is not a refund", () => {
    const view = buildLedgerRowView(row("2026-08-05", 480000), lookups());
    expect(view.isMoneyIn).toBe(true);
    expect(view.isRefund).toBe(false);
  });
});

describe("a settled month's rows", () => {
  it("locks every row in a settled month", () => {
    const view = buildLedgerRowView(
      row("2026-06-04", -1000),
      lookups({ settledMonths: new Set(["2026-06"]) }),
    );
    expect(view.isLocked).toBe(true);
  });

  it("leaves an open month editable", () => {
    const view = buildLedgerRowView(
      row("2026-08-04", -1000),
      lookups({ settledMonths: new Set(["2026-06"]) }),
    );
    expect(view.isLocked).toBe(false);
  });
});

describe("the annual-charge hint", () => {
  it("flags a charge whose merchant billed the same amount about a year earlier", () => {
    const older = row("2025-08-07", -12000, { description: "STORYBOX.CA MEMBERSHIP" });
    const newer = row("2026-08-07", -12000, { description: "STORYBOX.CA MEMBERSHIP" });
    const repeats = indexAnnualRepeats([older, newer]);
    expect(repeats.has(newer.id)).toBe(true);
    // Only the later row can be told it repeats — the first sighting had nothing to repeat.
    expect(repeats.has(older.id)).toBe(false);
  });

  it("leaves a monthly subscription alone", () => {
    const rows = ["2026-06-07", "2026-07-07", "2026-08-07"].map((date) =>
      row(date, -1299, { description: "NEWSSTAND MONTHLY" }),
    );
    expect(indexAnnualRepeats(rows).size).toBe(0);
  });

  it("does not pair two merchants that merely charged the same amount", () => {
    const rows = [
      row("2025-08-07", -12000, { description: "STORYBOX.CA MEMBERSHIP" }),
      row("2026-08-07", -12000, { description: "TOOLWORKS LICENCE" }),
    ];
    expect(indexAnnualRepeats(rows).size).toBe(0);
  });

  it("reaches the row view", () => {
    const older = row("2025-08-07", -12000, { description: "STORYBOX.CA MEMBERSHIP" });
    const newer = row("2026-08-07", -12000, { description: "STORYBOX.CA MEMBERSHIP" });
    const view = buildLedgerRowView(newer, lookups({ transactions: [older, newer] }));
    expect(view.hasAnnualHint).toBe(true);
  });
});
