import { describe, expect, it } from "vitest";
import {
  describeDayShare,
  describeDayTotals,
  describeLedgerSummary,
  describeMobileCharge,
  describeMobileMeta,
  formatCompactDayHeading,
  formatDayHeading,
  formatSignedCents,
} from "../ledger-copy";
import { groupTransactionsByDay } from "../ledger-grouping";
import type { LedgerRowView } from "../ledger-row";
import { budget, GROCERIES, makeBook, row } from "./fixtures";

const groupOf = (...rows: Parameters<typeof groupTransactionsByDay>[0]) =>
  groupTransactionsByDay(rows)[0];

describe("money in the ledger's own hand", () => {
  it("prints a true minus, not a hyphen", () => {
    expect(formatSignedCents(-6440)).toBe("−$64.40");
    expect(formatSignedCents(-6440)).not.toContain("-");
  });

  it("leaves a positive figure untouched", () => {
    expect(formatSignedCents(21311)).toBe("$213.11");
  });
});

describe("the day heading", () => {
  it("spells the weekday out on the desktop strip", () => {
    expect(formatDayHeading("2026-08-11")).toBe("Tuesday, Aug 11");
  });

  it("abbreviates it on the phone", () => {
    expect(formatCompactDayHeading("2026-08-09")).toBe("Sun, Aug 9");
  });
});

describe("the day strip's figures", () => {
  it("states both the charge and the share on the desktop strip", () => {
    const group = groupOf(
      row("2026-08-11", -12999, { isHousehold: true, myShareBps: 8000 }),
      row("2026-08-11", -8312, { isHousehold: true, myShareBps: 5000 }),
    );
    expect(describeDayTotals(group)).toBe("$213.11 · your share $145.55");
  });

  it("states the exclusion rather than quietly folding an unreviewed row in", () => {
    const group = groupOf(
      row("2026-08-09", -4218, { isHousehold: true, myShareBps: 5000 }),
      row("2026-08-09", -12999, { categoryId: null }),
    );
    expect(describeDayTotals(group)).toBe("$42.18 · your share $21.09 · 1 unreviewed");
  });

  it("prints a leading minus on both figures when the day nets negative", () => {
    const group = groupOf(row("2026-08-05", 6440));
    expect(describeDayTotals(group)).toBe("−$64.40 · your share −$64.40");
  });

  it("states the exclusion alone when no row in the day can be summed honestly", () => {
    const group = groupOf(row("2026-08-12", -4499, { categoryId: null }));
    expect(describeDayTotals(group)).toBe("1 unreviewed");
    expect(describeDayShare(group)).toBe("1 unreviewed");
  });

  it("drops the charge and names the remaining figure on the phone", () => {
    const group = groupOf(
      row("2026-08-09", -4218, { isHousehold: true, myShareBps: 5000 }),
      row("2026-08-09", -12999, { categoryId: null }),
    );
    expect(describeDayShare(group)).toBe("$21.09 yours · 1 unreviewed");
  });
});

describe("the phone's stacked money and meta lines", () => {
  const view = (patch: Partial<LedgerRowView>): LedgerRowView =>
    ({
      id: "ftxn_1",
      title: "Friday takeout",
      dateLabel: "Aug 9",
      category: { tone: "assigned", label: "Dining out", color: "#B3854D", suggestionId: null },
      splitPhrase: "shared · 50% mine",
      metaPhrase: "shared 50%",
      fullCents: 4218,
      shareCents: 2109,
      isUnreviewed: false,
      isLocked: false,
      isInternal: false,
      isMoneyIn: false,
      isRefund: false,
      spreadMonths: 1,
      hasAnnualHint: false,
      ...patch,
    }) satisfies LedgerRowView;

  it("names the charge the share came out of", () => {
    expect(describeMobileCharge(view({}))).toBe("of $42.18");
  });

  it("says `full` rather than repeating the number on an unshared row", () => {
    expect(describeMobileCharge(view({ shareCents: 4218 }))).toBe("full");
  });

  it("says `full` on an unreviewed row, where the big number is already the whole charge", () => {
    expect(describeMobileCharge(view({ shareCents: null }))).toBe("full");
  });

  it("joins the category and the split into one line", () => {
    expect(describeMobileMeta(view({}))).toBe("Dining out · shared 50%");
  });

  it("names no category on an internal transfer, which never earns one", () => {
    const transfer = view({
      category: { tone: "exempt", label: "—", color: null, suggestionId: null },
      metaPhrase: "mine",
    });
    expect(describeMobileMeta(transfer)).toBe("mine");
  });
});

describe("the ledger's sub-line", () => {
  it("names both money figures and labels each", () => {
    const book = makeBook({
      financeTransactions: [
        row("2026-08-11", -20000, { isHousehold: true, myShareBps: 5000 }),
        row("2026-08-09", -10000),
      ],
      financeBudgets: [budget(GROCERIES, "2026-08", 55000)],
    });
    expect(describeLedgerSummary(book, "2026-08", 2)).toBe(
      "2 rows in August · $300.00 out, $200.00 against budgets",
    );
  });

  it("counts one row in the singular", () => {
    const book = makeBook({ financeTransactions: [row("2026-08-09", -10000)] });
    expect(describeLedgerSummary(book, "2026-08", 1)).toContain("1 row in August");
  });

  it("reads an empty month as zeroes rather than going silent", () => {
    expect(describeLedgerSummary(makeBook(), "2026-08", 0)).toBe(
      "0 rows in August · $0.00 out, $0.00 against budgets",
    );
  });
});
