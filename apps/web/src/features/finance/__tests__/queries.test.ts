import type { FinanceSettlement } from "@vega/shared";
import { addMonths, format } from "date-fns";
import { describe, expect, it } from "vitest";
import {
  computeBorneSpend,
  computeCashIn,
  computeHouseholdTotal,
  computeMyTrueShare,
  computePaidOut,
  computeSettlementBalance,
  projectMonthEnd,
  resolveEffectiveBudget,
} from "../queries";
import {
  BUSINESS,
  budget,
  GROCERIES,
  makeBook,
  row,
  SALARY,
  SOFTWARE,
  settlement,
} from "./fixtures";

const MONTH = "2026-03";
const NEXT_MONTH = "2026-04";

describe("an empty book", () => {
  const book = makeBook();

  it("returns zero for every figure and no budget", () => {
    expect(computeBorneSpend(book, MONTH, GROCERIES)).toBe(0);
    expect(computePaidOut(book, MONTH)).toBe(0);
    expect(computeCashIn(book, MONTH)).toBe(0);
    expect(computeHouseholdTotal(book, MONTH)).toBe(0);
    expect(computeMyTrueShare(book, MONTH)).toBe(0);
    expect(computeSettlementBalance(book, MONTH)).toBe(0);
    expect(projectMonthEnd(book, MONTH, GROCERIES, new Date("2026-03-10"))).toBe(0);
    expect(resolveEffectiveBudget(book, GROCERIES, MONTH)).toBeNull();
  });

  it("returns zero for a month whose rows all sit elsewhere", () => {
    const elsewhere = makeBook({ financeTransactions: [row("2026-02-14", -12345)] });
    expect(computeBorneSpend(elsewhere, MONTH, GROCERIES)).toBe(0);
    expect(computePaidOut(elsewhere, MONTH)).toBe(0);
    expect(computeHouseholdTotal(elsewhere, MONTH)).toBe(0);
  });
});

describe("a partner-paid household row", () => {
  const book = makeBook({
    financeTransactions: [
      row("2026-03-05", -10000, {
        accountId: null,
        payer: "partner",
        isHousehold: true,
        myShareBps: 5000,
        enteredBy: "partner-reported",
      }),
    ],
  });

  it("consumes the owner's budget at their share", () => {
    expect(computeBorneSpend(book, MONTH, GROCERIES)).toBe(5000);
  });

  it("never appears in the owner's cash out", () => {
    expect(computePaidOut(book, MONTH)).toBe(0);
    expect(computeCashIn(book, MONTH)).toBe(0);
  });

  it("leaves the owner owing the partner", () => {
    expect(computeHouseholdTotal(book, MONTH)).toBe(10000);
    expect(computeMyTrueShare(book, MONTH)).toBe(5000);
    expect(computeSettlementBalance(book, MONTH)).toBe(-5000);
  });
});

describe("an annual charge spread over twelve months", () => {
  const book = makeBook({
    financeTransactions: [
      row("2026-03-10", -120000, {
        categoryId: SOFTWARE,
        spreadMonths: 12,
        isHousehold: true,
        myShareBps: 5000,
      }),
    ],
  });
  const monthAfter = (steps: number) => format(addMonths(new Date("2026-03-01"), steps), "yyyy-MM");

  it("recognises an equal fraction in each of the twelve months and nothing after", () => {
    const recognised = Array.from({ length: 12 }, (_, step) =>
      computeBorneSpend(book, monthAfter(step), SOFTWARE),
    );
    expect(recognised).toEqual(Array.from({ length: 12 }, () => 5000));
    expect(computeBorneSpend(book, monthAfter(12), SOFTWARE)).toBe(0);
    expect(computeBorneSpend(book, monthAfter(-1), SOFTWARE)).toBe(0);
  });

  it("recognises exactly the owner's share in total, no more", () => {
    const recognised = Array.from({ length: 12 }, (_, step) =>
      computeBorneSpend(book, monthAfter(step), SOFTWARE),
    ).reduce((sum, cents) => sum + cents, 0);
    expect(recognised).toBe(computeMyTrueShare(book, MONTH));
  });

  it("moves the whole amount of cash in month one and none later", () => {
    expect(computePaidOut(book, MONTH)).toBe(120000);
    expect(computePaidOut(book, NEXT_MONTH)).toBe(0);
  });

  it("settles in full in month one — spreading is a budget lens, not a debt lens", () => {
    expect(computeHouseholdTotal(book, MONTH)).toBe(120000);
    expect(computeSettlementBalance(book, MONTH)).toBe(60000);
    expect(computeHouseholdTotal(book, NEXT_MONTH)).toBe(0);
    expect(computeSettlementBalance(book, NEXT_MONTH)).toBe(0);
  });

  it("puts the remainder of an uneven split on the first month, losing nothing", () => {
    const uneven = makeBook({
      financeTransactions: [row("2026-03-10", -100000, { categoryId: SOFTWARE, spreadMonths: 12 })],
    });
    const recognised = Array.from({ length: 12 }, (_, step) =>
      computeBorneSpend(uneven, monthAfter(step), SOFTWARE),
    );
    expect(recognised).toEqual([8337, ...Array.from({ length: 11 }, () => 8333)]);
    expect(recognised.reduce((sum, cents) => sum + cents, 0)).toBe(100000);
  });
});

describe("resolveEffectiveBudget", () => {
  const book = makeBook({
    financeBudgets: [
      budget(GROCERIES, "2026-07", 55000),
      budget(GROCERIES, "2026-01", 50000),
      budget(SOFTWARE, "2026-03", 4000),
    ],
  });

  it("resolves a month to the latest row at or before it", () => {
    expect(resolveEffectiveBudget(book, GROCERIES, MONTH)?.cents).toBe(50000);
    expect(resolveEffectiveBudget(book, GROCERIES, "2026-07")?.cents).toBe(55000);
    expect(resolveEffectiveBudget(book, GROCERIES, "2026-12")?.cents).toBe(55000);
  });

  it("returns null before the first row rather than falling back to a later one", () => {
    expect(resolveEffectiveBudget(book, GROCERIES, "2025-12")).toBeNull();
    expect(resolveEffectiveBudget(book, SOFTWARE, "2026-02")).toBeNull();
  });

  it("keeps categories independent", () => {
    expect(resolveEffectiveBudget(book, SOFTWARE, "2026-07")?.cents).toBe(4000);
  });
});

describe("a refund in a spend category", () => {
  const book = makeBook({
    financeTransactions: [
      row("2026-03-04", -20000),
      row("2026-03-20", 5000, { refundOfTransactionId: "ftxn_refunded" }),
      row("2026-03-15", 500000, { categoryId: SALARY }),
    ],
  });

  it("nets against the category it came from", () => {
    expect(computeBorneSpend(book, MONTH, GROCERIES)).toBe(15000);
  });

  it("stays out of cash in, which counts income only", () => {
    expect(computeCashIn(book, MONTH)).toBe(500000);
    expect(computePaidOut(book, MONTH)).toBe(20000);
  });

  it("can turn a category negative when the rebate outweighs the spend", () => {
    const rebated = makeBook({
      financeTransactions: [row("2026-03-04", -2000), row("2026-03-20", 5000)],
    });
    expect(computeBorneSpend(rebated, MONTH, GROCERIES)).toBe(-3000);
  });
});

describe("rounding", () => {
  const odd = (day: string) =>
    row(day, -725, { isHousehold: true, myShareBps: 5000, payer: "me" as const });
  const book = makeBook({
    financeTransactions: [odd("2026-03-02"), odd("2026-03-09"), odd("2026-03-16")],
  });

  it("rounds once on the final figure — three half-cents round down, not up", () => {
    // Per-row: 362.5 → 363 each → 1089. Round-once: 1087.5 → 1088.
    expect(computeMyTrueShare(book, MONTH)).toBe(1088);
    expect(computeBorneSpend(book, MONTH, GROCERIES)).toBe(1088);
  });

  it("keeps the untouched sums exact", () => {
    expect(computeHouseholdTotal(book, MONTH)).toBe(2175);
    expect(computePaidOut(book, MONTH)).toBe(2175);
  });

  it("derives the balance from the rounded share so the strip adds up on screen", () => {
    // The owner reads 2175 paid and 1088 borne, and 2175 − 1088 must be the figure shown.
    expect(computeSettlementBalance(book, MONTH)).toBe(1087);
  });
});

describe("settlement carry and payment", () => {
  const bookSettling = (entry: FinanceSettlement) =>
    makeBook({
      financeTransactions: [row("2026-03-08", -10000, { isHousehold: true, myShareBps: 5000 })],
      financeSettlements: [entry],
    });

  it("adds the carried delta and subtracts what has already been paid", () => {
    const book = bookSettling(settlement(MONTH, { carriedDeltaCents: 250, paidCents: 1000 }));
    expect(computeSettlementBalance(book, MONTH)).toBe(4250);
  });

  it("goes negative once the partner has overpaid", () => {
    const book = bookSettling(settlement(MONTH, { paidCents: 6000, status: "settled" }));
    expect(computeSettlementBalance(book, MONTH)).toBe(-1000);
  });

  it("ignores a settlement row belonging to another month", () => {
    const book = bookSettling(settlement(NEXT_MONTH, { carriedDeltaCents: 9999 }));
    expect(computeSettlementBalance(book, MONTH)).toBe(5000);
  });
});

describe("rows that must not reach a personal figure", () => {
  const businessBook = makeBook({
    financeTransactions: [
      row("2026-03-06", -10000, { accountId: BUSINESS, isHousehold: true, myShareBps: 5000 }),
    ],
  });

  it("excludes internal transfers from every aggregate", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-03-11", -50000, { isInternal: true, categoryId: null }),
        row("2026-03-12", 50000, { isInternal: true, categoryId: SALARY }),
        row("2026-03-13", -8000, { isInternal: true, isHousehold: true, myShareBps: 5000 }),
      ],
    });
    expect(computeBorneSpend(book, MONTH, GROCERIES)).toBe(0);
    expect(computePaidOut(book, MONTH)).toBe(0);
    expect(computeCashIn(book, MONTH)).toBe(0);
    expect(computeHouseholdTotal(book, MONTH)).toBe(0);
    expect(computeSettlementBalance(book, MONTH)).toBe(0);
  });

  it("keeps a business account out of the personal figures until asked", () => {
    expect(computeBorneSpend(businessBook, MONTH, GROCERIES)).toBe(0);
    expect(computePaidOut(businessBook, MONTH)).toBe(0);
    expect(projectMonthEnd(businessBook, MONTH, GROCERIES, new Date("2026-03-10"))).toBe(0);

    const included = { includeBusiness: true };
    expect(computeBorneSpend(businessBook, MONTH, GROCERIES, included)).toBe(5000);
    expect(computePaidOut(businessBook, MONTH, included)).toBe(10000);
  });

  it("never lets a business account erase a debt", () => {
    expect(computeHouseholdTotal(businessBook, MONTH)).toBe(10000);
    expect(computeMyTrueShare(businessBook, MONTH)).toBe(5000);
    expect(computeSettlementBalance(businessBook, MONTH)).toBe(5000);
  });

  it("counts nothing for a category that is not a spend category", () => {
    const book = makeBook({
      financeTransactions: [row("2026-03-15", 500000, { categoryId: SALARY })],
    });
    expect(computeBorneSpend(book, MONTH, SALARY)).toBe(0);
    expect(computeBorneSpend(book, MONTH, "cat_unknown")).toBe(0);
  });

  it("leaves an uncategorised row out of the budget but in the cash figure", () => {
    const book = makeBook({
      financeTransactions: [row("2026-03-15", -4499, { categoryId: null })],
    });
    expect(computeBorneSpend(book, MONTH, GROCERIES)).toBe(0);
    expect(computePaidOut(book, MONTH)).toBe(4499);
  });
});

describe("projectMonthEnd", () => {
  const book = makeBook({ financeTransactions: [row("2026-03-05", -30000)] });

  it("scales the month to date by the days remaining", () => {
    expect(projectMonthEnd(book, MONTH, GROCERIES, new Date("2026-03-10"))).toBe(93000);
    expect(projectMonthEnd(book, MONTH, GROCERIES, new Date("2026-03-07"))).toBe(132857);
  });

  it("projects nothing once the month is not the one in progress", () => {
    expect(projectMonthEnd(book, MONTH, GROCERIES, new Date("2026-04-02"))).toBe(30000);
    expect(projectMonthEnd(book, MONTH, GROCERIES, new Date("2026-02-20"))).toBe(30000);
  });

  it("rounds once, off the unrounded month to date", () => {
    const half = makeBook({
      financeTransactions: [row("2026-03-01", -725, { isHousehold: true, myShareBps: 5000 })],
    });
    // 362.5 × 31 ÷ 2 = 5618.75 → 5619; rounding the 362.5 first would give 5627.
    expect(projectMonthEnd(half, MONTH, GROCERIES, new Date("2026-03-02"))).toBe(5619);
  });
});
