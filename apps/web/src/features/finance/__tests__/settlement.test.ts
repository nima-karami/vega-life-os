import { describe, expect, it } from "vitest";
import { formatCents } from "../money";
import {
  computeHouseholdTotal,
  computeMyTrueShare,
  computeSettlementBalance,
  type FinanceBook,
} from "../queries";
import {
  buildCarryForwardWrites,
  buildSettlePatch,
  computeSettlementFigures,
  describeBalance,
  describeDirection,
  findNextOpenMonth,
  isMonthKey,
  listSettlementMonths,
  monthLabel,
  shiftMonth,
} from "../settlement";
import { makeBook, row, settlement } from "./fixtures";

const MONTH = "2026-03";
const NEXT_MONTH = "2026-04";

const shared = (txnDate: string, amountCents: number, patch = {}) =>
  row(txnDate, amountCents, { isHousehold: true, myShareBps: 5000, ...patch });

const partnerPaid = (txnDate: string, amountCents: number, myShareBps = 5000) =>
  row(txnDate, amountCents, {
    accountId: null,
    payer: "partner" as const,
    isHousehold: true,
    myShareBps,
    enteredBy: "partner-reported" as const,
  });

/** The one property the screen lives or dies on: every line comes from the query it claims to. */
function expectStripReconciles(book: FinanceBook, month: string) {
  const figures = computeSettlementFigures(book, month);
  expect(figures.householdTotalCents).toBe(computeHouseholdTotal(book, month));
  expect(figures.myShareCents).toBe(computeMyTrueShare(book, month));
  expect(figures.outstandingCents).toBe(computeSettlementBalance(book, month));
  expect(figures.ownerPaidCents + figures.partnerPaidCents).toBe(figures.householdTotalCents);
  expect(
    figures.ownerPaidCents -
      figures.myShareCents +
      figures.carriedDeltaCents -
      figures.paymentCents,
  ).toBe(figures.outstandingCents);
  return figures;
}

describe("an open month with both sides paying", () => {
  const book = makeBook({
    financeTransactions: [shared("2026-03-02", -200000), partnerPaid("2026-03-12", -8600)],
  });

  it("splits the two sides and reconciles line by line", () => {
    const figures = expectStripReconciles(book, MONTH);
    expect(figures.householdTotalCents).toBe(208600);
    expect(figures.ownerPaidCents).toBe(200000);
    expect(figures.partnerPaidCents).toBe(8600);
    expect(figures.myShareCents).toBe(104300);
    expect(figures.outstandingCents).toBe(95700);
  });

  it("is open, with no frozen figure to lead with", () => {
    const figures = computeSettlementFigures(book, MONTH);
    expect(figures.phase).toBe("open");
    expect(figures.frozenBalanceCents).toBeNull();
    expect(figures.headlineBalanceCents).toBe(figures.currentBalanceCents);
    expect(figures.differenceCents).toBe(0);
  });
});

describe("a month the partner carried", () => {
  const book = makeBook({ financeTransactions: [partnerPaid("2026-03-08", -11200, 0)] });

  it("owes the other way round and says so in words", () => {
    const figures = expectStripReconciles(book, MONTH);
    expect(figures.ownerPaidCents).toBe(0);
    expect(figures.partnerPaidCents).toBe(11200);
    expect(figures.myShareCents).toBe(0);
    expect(figures.outstandingCents).toBe(0);
  });

  it("owes the partner once the owner's share is non-zero", () => {
    const half = makeBook({ financeTransactions: [partnerPaid("2026-03-08", -11200)] });
    const figures = expectStripReconciles(half, MONTH);
    expect(figures.outstandingCents).toBe(-5600);
    expect(describeBalance(figures.outstandingCents, "now")).toBe(
      `You owe your partner ${formatCents(5600)}`,
    );
  });
});

describe("a settled month whose rows then change", () => {
  const settled = settlement(MONTH, {
    status: "settled",
    settledBalanceCents: 95700,
    settledAt: "2026-04-01",
    paidCents: 95700,
    paidAt: "2026-04-02",
  });
  const before = makeBook({
    financeTransactions: [shared("2026-03-02", -200000), partnerPaid("2026-03-12", -8600)],
    financeSettlements: [settled],
  });
  const after = makeBook({
    financeTransactions: [
      shared("2026-03-02", -200000),
      partnerPaid("2026-03-12", -8600),
      shared("2026-03-20", -5000),
    ],
    financeSettlements: [settled],
  });

  it("leads with the frozen figure while nothing has moved", () => {
    const figures = computeSettlementFigures(before, MONTH);
    expect(figures.phase).toBe("settled");
    expect(figures.headlineBalanceCents).toBe(95700);
    expect(figures.differenceCents).toBe(0);
  });

  it("keeps showing the frozen figure, flags the month amended, and shows the difference", () => {
    const figures = expectStripReconciles(after, MONTH);
    expect(figures.phase).toBe("amended");
    expect(figures.frozenBalanceCents).toBe(95700);
    expect(figures.headlineBalanceCents).toBe(95700);
    expect(figures.currentBalanceCents).toBe(98200);
    expect(figures.differenceCents).toBe(2500);
    // The query never reads `status` or `settledBalanceCents`, so only the page keeps the freeze.
    expect(computeSettlementBalance(after, MONTH)).not.toBe(figures.headlineBalanceCents);
  });

  it("returns to settled at the original figure once the difference is carried forward", () => {
    const figures = computeSettlementFigures(after, MONTH);
    const writes = buildCarryForwardWrites(after, figures);
    expect(writes).toEqual([
      { month: MONTH, patch: { status: "settled", carriedDeltaCents: -2500 } },
      { month: NEXT_MONTH, patch: { carriedDeltaCents: 2500 } },
    ]);

    const carried = makeBook({
      financeTransactions: after.financeTransactions,
      financeSettlements: [
        { ...settled, carriedDeltaCents: -2500 },
        settlement(NEXT_MONTH, { carriedDeltaCents: 2500 }),
      ],
    });
    const closed = computeSettlementFigures(carried, MONTH);
    expect(closed.phase).toBe("settled");
    expect(closed.headlineBalanceCents).toBe(95700);
    expect(closed.outstandingCents).toBe(0);
    expect(computeSettlementFigures(carried, NEXT_MONTH).outstandingCents).toBe(2500);
  });

  it("reopens to the live figure while keeping the figure it was settled at on record", () => {
    const reopened = makeBook({
      financeTransactions: after.financeTransactions,
      financeSettlements: [{ ...settled, status: "open" as const }],
    });
    const figures = computeSettlementFigures(reopened, MONTH);
    expect(figures.phase).toBe("open");
    expect(figures.headlineBalanceCents).toBe(figures.currentBalanceCents);
    expect(figures.frozenBalanceCents).toBe(95700);
  });

  it("re-settles at the current figure without touching the payment", () => {
    const figures = computeSettlementFigures(after, MONTH);
    expect(buildSettlePatch(figures, "2026-04-09")).toEqual({
      status: "settled",
      settledBalanceCents: 98200,
      settledAt: "2026-04-09",
    });
  });
});

describe("a payment that arrives short", () => {
  const book = makeBook({
    financeTransactions: [shared("2026-03-02", -200000), partnerPaid("2026-03-12", -8600)],
    financeSettlements: [
      settlement(MONTH, {
        status: "settled",
        settledBalanceCents: 95700,
        settledAt: "2026-04-01",
        paidCents: 90000,
        paidAt: "2026-04-02",
      }),
    ],
  });

  it("stays settled — a shortfall is not an amendment", () => {
    const figures = expectStripReconciles(book, MONTH);
    expect(figures.phase).toBe("settled");
    expect(figures.paymentCents).toBe(90000);
    expect(figures.headlineBalanceCents).toBe(95700);
    expect(figures.outstandingCents).toBe(5700);
    expect(figures.differenceCents).toBe(0);
  });

  it("carries the residual forward and closes the month out", () => {
    const figures = computeSettlementFigures(book, MONTH);
    const writes = buildCarryForwardWrites(book, figures);
    expect(writes[0]).toEqual({
      month: MONTH,
      patch: { status: "settled", carriedDeltaCents: -5700 },
    });
    expect(writes[1]).toEqual({ month: NEXT_MONTH, patch: { carriedDeltaCents: 5700 } });
  });
});

describe("the month a delta carries into", () => {
  it("skips months that are already settled", () => {
    const book = makeBook({
      financeSettlements: [
        settlement(NEXT_MONTH, { status: "settled", settledBalanceCents: 100 }),
        settlement("2026-05", { status: "amended", settledBalanceCents: 100 }),
      ],
    });
    expect(findNextOpenMonth(book, MONTH)).toBe("2026-06");
  });

  it("is simply the next month when nothing after it exists", () => {
    expect(findNextOpenMonth(makeBook(), "2026-12")).toBe("2027-01");
  });
});

describe("month keys and labels", () => {
  it("accepts only a real YYYY-MM", () => {
    expect(isMonthKey("2026-03")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-3")).toBe(false);
    expect(isMonthKey("nonsense")).toBe(false);
  });

  it("steps and labels months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(monthLabel("2026-03")).toBe("March 2026");
  });

  it("offers every month with a household row or a record, newest first", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-01-05", -1000),
        row("2026-02-05", -1000),
        shared("2026-03-05", -1000, { isInternal: true }),
      ],
      financeSettlements: [settlement("2025-12")],
    });
    expect(listSettlementMonths(book, "2026-04")).toEqual(["2026-04", "2026-01", "2025-12"]);
  });
});

describe("direction copy", () => {
  it("never leaves the direction to a sign", () => {
    expect(describeDirection(500, "now")).toBe("Your partner owes you");
    expect(describeDirection(-500, "now")).toBe("You owe your partner");
    expect(describeDirection(-500, "still")).toBe("You still owe your partner");
    expect(describeDirection(0, "now")).toBe("Square — nothing owed either way");
    expect(describeDirection(0, "still")).toBe("Nothing left to settle");
  });
});
