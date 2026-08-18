import { describe, expect, it } from "vitest";
import { computeSettlementFigures } from "../settlement";
import {
  buildSettlementHistory,
  buildSettlementRowViews,
  computeRowsNetCents,
  filterSettlementRows,
  partitionSettlementSplits,
} from "../settlement-rows";
import { makeBook, row, settlement } from "./fixtures";

const MONTH = "2026-03";

const shared = (txnDate: string, amountCents: number, patch = {}) =>
  row(txnDate, amountCents, { isHousehold: true, myShareBps: 5000, ...patch });

const partnerPaid = { payer: "partner", accountId: null } as const;

describe("the contributing rows of a period", () => {
  it("reads the owner's own row as the partner owing them the rest of the charge", () => {
    const book = makeBook({
      financeTransactions: [shared("2026-03-11", -12999, { myShareBps: 8000, title: "Desk lamp" })],
    });
    const [view] = buildSettlementRowViews(book, MONTH);

    expect(view.title).toBe("Desk lamp");
    expect(view.isOwnerPaid).toBe(true);
    expect(view.fullCents).toBe(12999);
    expect(view.shareCents).toBe(10399);
    expect(view.owedCents).toBe(2600);
    expect(view.isWaiting).toBe(false);
  });

  it("reads a partner-paid row as the owner owing their own share", () => {
    const book = makeBook({
      financeTransactions: [shared("2026-03-06", -10020, { ...partnerPaid, title: "Dinner" })],
    });
    const [view] = buildSettlementRowViews(book, MONTH);

    expect(view.isOwnerPaid).toBe(false);
    expect(view.shareCents).toBe(5010);
    expect(view.owedCents).toBe(-5010);
  });

  it("states a row waiting on a split rather than guessing its share", () => {
    const book = makeBook({
      financeTransactions: [shared("2026-03-09", -12999, { categoryId: null })],
    });
    const [view] = buildSettlementRowViews(book, MONTH);

    expect(view.isWaiting).toBe(true);
    expect(view.shareCents).toBeNull();
    expect(view.owedCents).toBeNull();
    // The charge itself is never hidden — only the share nobody has agreed to.
    expect(view.fullCents).toBe(12999);
  });

  it("carries a refund's sign through the share and the owed figure", () => {
    const book = makeBook({ financeTransactions: [shared("2026-03-04", 4000)] });
    const [view] = buildSettlementRowViews(book, MONTH);

    expect(view.fullCents).toBe(-4000);
    expect(view.shareCents).toBe(-2000);
    expect(view.owedCents).toBe(-2000);
  });

  it("lists the period newest first", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-03-02", -1000, { title: "older" }),
        shared("2026-03-20", -1000, { title: "newer" }),
      ],
    });
    expect(buildSettlementRowViews(book, MONTH).map((view) => view.title)).toEqual([
      "newer",
      "older",
    ]);
  });

  it("leaves rows from another period out entirely", () => {
    const book = makeBook({
      financeTransactions: [shared("2026-02-27", -1000), shared("2026-03-02", -1000)],
    });
    expect(buildSettlementRowViews(book, MONTH)).toHaveLength(1);
  });
});

describe("the rows-card filters", () => {
  const book = makeBook({
    financeTransactions: [
      shared("2026-03-02", -1000, { title: "mine" }),
      shared("2026-03-03", -2000, { ...partnerPaid, title: "theirs" }),
      shared("2026-03-04", -3000, { categoryId: null, title: "waiting" }),
    ],
  });
  const views = buildSettlementRowViews(book, MONTH);

  it("keeps every row on `all`", () => {
    expect(filterSettlementRows(views, "all")).toHaveLength(3);
  });

  it("splits the two payers", () => {
    expect(filterSettlementRows(views, "owner").map((view) => view.title)).toEqual([
      "waiting",
      "mine",
    ]);
    expect(filterSettlementRows(views, "partner").map((view) => view.title)).toEqual(["theirs"]);
  });

  it("selects exactly the rows missing a split", () => {
    expect(filterSettlementRows(views, "waiting").map((view) => view.title)).toEqual(["waiting"]);
  });
});

describe("the split partition behind the stat boxes", () => {
  it("separates even splits from every other split and leaves waiting rows out of both", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-03-02", -22000),
        shared("2026-03-03", -20000),
        shared("2026-03-04", -10000, { myShareBps: 8000 }),
        shared("2026-03-05", -21447, { categoryId: null }),
      ],
    });
    const partition = partitionSettlementSplits(buildSettlementRowViews(book, MONTH));

    expect(partition).toEqual({
      evenCount: 2,
      evenCents: 42000,
      otherCount: 1,
      otherCents: 10000,
    });
  });

  it("is empty on a period with no household row at all", () => {
    const partition = partitionSettlementSplits(buildSettlementRowViews(makeBook(), MONTH));
    expect(partition).toEqual({ evenCount: 0, evenCents: 0, otherCount: 0, otherCents: 0 });
  });
});

describe("the footer net", () => {
  it("equals what the owner laid out less their own true share", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-03-02", -80000),
        shared("2026-03-05", -20000, partnerPaid),
      ],
    });
    const figures = computeSettlementFigures(book, MONTH);

    expect(computeRowsNetCents(figures)).toBe(30000);
    // And it is the sum of the column the rows print.
    const rowsTotal = buildSettlementRowViews(book, MONTH).reduce(
      (sum, view) => sum + (view.owedCents ?? 0),
      0,
    );
    expect(rowsTotal).toBe(30000);
  });

  it("leaves a delta carried in from an earlier period out — no row on the table carries it", () => {
    const book = makeBook({
      financeTransactions: [shared("2026-03-02", -80000)],
      financeSettlements: [settlement(MONTH, { carriedDeltaCents: 5000 })],
    });
    const figures = computeSettlementFigures(book, MONTH);

    expect(computeRowsNetCents(figures)).toBe(40000);
    expect(figures.currentBalanceCents).toBe(45000);
  });
});

describe("the settled-period history", () => {
  const settledPeriod = (patch = {}) =>
    settlement("2026-02", {
      status: "settled",
      settledBalanceCents: 31420,
      settledAt: "2026-03-01",
      ...patch,
    });

  it("names the direction in words and reports the frozen figure", () => {
    const book = makeBook({
      financeTransactions: [
        shared("2026-02-02", -62840),
        shared("2026-02-05", -20000, { ...partnerPaid, myShareBps: 0 }),
      ],
      financeSettlements: [settledPeriod()],
    });
    const [entry] = buildSettlementHistory(book, "Robin");

    expect(entry.periodLabel).toBe("February 2026");
    expect(entry.outcome).toEqual({ lead: "Robin sent you", amount: "$314.20" });
    expect(entry.rowCount).toBe(2);
    expect(entry.settledLabel).toBe("Mar 1");
    expect(entry.isAmended).toBe(false);
  });

  it("falls back to `Partner` when Settings carries no name", () => {
    const book = makeBook({ financeSettlements: [settledPeriod({ settledBalanceCents: -8845 })] });
    expect(buildSettlementHistory(book, "")[0].outcome).toEqual({
      lead: "You sent Partner",
      amount: "$88.45",
    });
  });

  it("marks a period whose rows moved after it settled as amended", () => {
    const book = makeBook({
      financeTransactions: [shared("2026-02-02", -80000)],
      financeSettlements: [settledPeriod({ settledBalanceCents: 1000 })],
    });
    expect(buildSettlementHistory(book, "Robin")[0].isAmended).toBe(true);
  });

  it("leaves an open period out of the history entirely", () => {
    const book = makeBook({ financeSettlements: [settlement(MONTH)] });
    expect(buildSettlementHistory(book, "Robin")).toEqual([]);
  });
});
