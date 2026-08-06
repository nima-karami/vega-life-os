import { describe, expect, it } from "vitest";
import { buildFinance } from "@/core/persistence/seed/finance";
import {
  computeCashIn,
  computeHouseholdTotal,
  computeMyTrueShare,
  computePaidOut,
  computeSettlementBalance,
  type FinanceBook,
} from "../queries";
import { borneSpend } from "./fixtures";

const REF = new Date("2026-08-04T12:00:00Z");
const SETTLED_MONTH = "2026-06";
const OPEN_MONTH = "2026-07";
const CURRENT_MONTH = "2026-08";

const seed = buildFinance(REF);
const book: FinanceBook = seed;
const categoryId = (name: string) =>
  seed.financeCategories.find((category) => category.name === name)?.id ?? "";

describe("the synthetic seed's settled month", () => {
  it("reproduces the figure the seed records as settled", () => {
    const unpaid: FinanceBook = {
      ...book,
      financeSettlements: seed.financeSettlements.map((entry) => ({ ...entry, paidCents: null })),
    };
    expect(computeSettlementBalance(unpaid, SETTLED_MONTH)).toBe(102825);
    const settled = seed.financeSettlements.find((entry) => entry.month === SETTLED_MONTH);
    expect(settled?.settledBalanceCents).toBe(102825);
  });

  it("reads as square once the payment is booked", () => {
    expect(computeSettlementBalance(book, SETTLED_MONTH)).toBe(0);
  });

  it("splits the household month down the middle", () => {
    expect(computeHouseholdTotal(book, SETTLED_MONTH)).toBe(222850);
    expect(computeMyTrueShare(book, SETTLED_MONTH)).toBe(111425);
    expect(computePaidOut(book, SETTLED_MONTH)).toBe(214250);
    expect(computeCashIn(book, SETTLED_MONTH)).toBe(0);
    expect(borneSpend(book, SETTLED_MONTH, categoryId("Home & rent"))).toBe(100000);
  });
});

describe("the synthetic seed's open months", () => {
  it("counts salary as cash in and leaves the internal transfer pair out", () => {
    expect(computeCashIn(book, OPEN_MONTH)).toBe(480000);
    expect(computePaidOut(book, OPEN_MONTH)).toBe(50374);
  });

  it("amortizes the annual licence across the months that follow it", () => {
    const software = categoryId("Software");
    expect(borneSpend(book, OPEN_MONTH, software)).toBe(3000);
    expect(borneSpend(book, CURRENT_MONTH, software)).toBe(3000);
    expect(borneSpend(book, SETTLED_MONTH, software)).toBe(0);
  });

  it("leaves the owner owing the partner for her grocery run", () => {
    expect(computeHouseholdTotal(book, CURRENT_MONTH)).toBe(11200);
    expect(computeSettlementBalance(book, CURRENT_MONTH)).toBe(-5600);
  });
});
