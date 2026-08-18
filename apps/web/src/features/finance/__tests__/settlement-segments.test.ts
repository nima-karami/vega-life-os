import { describe, expect, it } from "vitest";
import { buildReconciliationSegments, computeSettlementFigures } from "../settlement";
import { makeBook, row } from "./fixtures";

const MONTH = "2026-03";

const shared = (txnDate: string, amountCents: number, patch = {}) =>
  row(txnDate, amountCents, { isHousehold: true, myShareBps: 5000, ...patch });

describe("the exclusion set the settlement figures carry", () => {
  it("counts a household row with an unresolved flag as excluded, without touching the balance", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-03-02", -22000),
        shared("2026-03-05", -21447, { categoryId: null }),
      ],
    });
    const figures = computeSettlementFigures(book, MONTH);
    expect(figures.excludedCount).toBe(1);
    expect(figures.excludedCents).toBe(21447);
    // The non-negotiable invariant: settlement math counts every household row at full amount —
    // the exclusion set is informational, it never removes a row from the real balance.
    expect(figures.householdTotalCents).toBe(43447);
  });

  it("reads a month with nothing waiting on review as no exclusions", () => {
    const book = makeBook({ financeTransactions: [shared("2026-03-02", -22000)] });
    const figures = computeSettlementFigures(book, MONTH);
    expect(figures.excludedCount).toBe(0);
    expect(figures.excludedCents).toBe(0);
  });
});

describe("reconciliation bar segments", () => {
  it("places the fill at the owner's paid share and the marker at their true share", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-03-02", -80000),
        shared("2026-03-05", -20000, { payer: "partner", accountId: null }),
      ],
    });
    const figures = computeSettlementFigures(book, MONTH);
    const segments = buildReconciliationSegments(figures);
    expect(segments.ownerPaidPercent).toBeCloseTo(80, 5);
    expect(segments.partnerPaidPercent).toBeCloseTo(20, 5);
    expect(segments.trueShareMarkerPercent).toBeCloseTo(50, 5);
  });

  it("never draws a negative segment when a partner refund outruns what she paid", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-03-02", -10000),
        shared("2026-03-03", 4000, { payer: "partner", accountId: null }),
      ],
    });
    const segments = buildReconciliationSegments(computeSettlementFigures(book, MONTH));
    expect(segments.ownerPaidPercent).toBeGreaterThanOrEqual(0);
    expect(segments.partnerPaidPercent).toBeGreaterThanOrEqual(0);
    expect(segments.ownerPaidPercent + segments.partnerPaidPercent).toBeCloseTo(100, 5);
  });

  it("is safe on a month with no household rows at all", () => {
    const figures = computeSettlementFigures(makeBook(), MONTH);
    expect(buildReconciliationSegments(figures)).toEqual({
      ownerPaidPercent: 0,
      partnerPaidPercent: 0,
      trueShareMarkerPercent: 0,
    });
  });
});
