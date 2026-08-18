import { describe, expect, it } from "vitest";
import {
  describeCarryForward,
  describeCategoriesSubLine,
  describeCategoryCaption,
  describeCategoryHeadline,
  describeCategoryMonthFooter,
  describeCategoryOverflow,
  describeCategoryRowCount,
  describeTablePace,
  describeUncategorised,
} from "../category-copy";

describe("the categories sub-line", () => {
  it("spells a small count and states whose share the budget total is", () => {
    expect(describeCategoriesSubLine(6, 150000)).toBe(
      "Six categories · $1,500.00 budgeted a month, your share",
    );
  });

  it("keeps the digits once the count stops reading as a word", () => {
    expect(describeCategoriesSubLine(14, 0)).toBe(
      "14 categories · $0.00 budgeted a month, your share",
    );
  });
});

describe("the per-row count", () => {
  it("names the spread rows only when there are any", () => {
    expect(describeCategoryRowCount(28, 0)).toBe("28 rows");
    expect(describeCategoryRowCount(11, 4)).toBe("11 rows · 4 spread");
    expect(describeCategoryRowCount(1, 0)).toBe("1 row");
  });
});

describe("the total row's pace read", () => {
  it("states both percentages as a sentence, not a bar", () => {
    expect(describeTablePace(60672, 150000, 12 / 31)).toBe("40% spent, 39% through the month");
  });

  it("says there is no budget rather than dividing by zero", () => {
    expect(describeTablePace(1000, 0, 0.5)).toBe("no budget set, 50% through the month");
  });
});

describe("the carry-forward explainer", () => {
  it("names this month and the one it inherited from", () => {
    expect(describeCarryForward("2026-08")).toBe(
      "August's numbers are the July numbers until you change one. Editing a budget writes a row for this month only — earlier months keep what they were judged against.",
    );
  });
});

describe("the uncategorised block", () => {
  it("carries the count and the value, and says they sit outside every budget", () => {
    expect(describeUncategorised({ rowCount: 9, chargedCents: 61240 })).toBe(
      "9 rows have no category yet, worth $612.40. They sit outside every budget until you place them.",
    );
  });

  it("says so plainly when nothing is waiting", () => {
    expect(describeUncategorised({ rowCount: 0, chargedCents: 0 })).toBe(
      "Every row this month is filed under a category.",
    );
  });
});

describe("the category headline", () => {
  it("names the overspend and the day it crossed", () => {
    expect(
      describeCategoryHeadline({ spentCents: 19630, budgetCents: 18000, breachedOn: "Aug 9" }),
    ).toEqual({
      text: "$196.30 of $180.00 this month — over by $16.30 since Aug 9",
      isOver: true,
    });
  });

  it("states what is left when the month is still inside its budget", () => {
    expect(
      describeCategoryHeadline({ spentCents: 8450, budgetCents: 16000, breachedOn: null }),
    ).toEqual({ text: "$84.50 of $160.00 this month — under by $75.50", isOver: false });
  });

  it("says no budget is set rather than judging spend against zero", () => {
    expect(
      describeCategoryHeadline({ spentCents: 8450, budgetCents: null, breachedOn: null }),
    ).toEqual({ text: "$84.50 this month — no budget set", isOver: false });
  });
});

describe("the chart caption", () => {
  it("counts breaches over completed months and names the worst", () => {
    expect(
      describeCategoryCaption({
        breachedCount: 2,
        completedCount: 11,
        averageCents: 15300,
        worstMonth: "2026-05",
        worstCents: 20000,
      }),
    ).toBe("Over budget in 2 of 11 completed months · average $153/mo · worst May at $200");
  });

  it("refuses to average a history that has no completed month in it", () => {
    expect(
      describeCategoryCaption({
        breachedCount: 0,
        completedCount: 0,
        averageCents: 0,
        worstMonth: null,
        worstCents: 0,
      }),
    ).toBe("No completed month on file yet — nothing to average against.");
  });
});

describe("the month card footer", () => {
  it("drops the clauses that would read as zero", () => {
    expect(
      describeCategoryMonthFooter({ rowCount: 14, sharedCount: 9, comesBackCents: 5640 }),
    ).toBe("14 rows · 9 shared · $56.40 comes back at settle-up");
    expect(describeCategoryMonthFooter({ rowCount: 2, sharedCount: 0, comesBackCents: 0 })).toBe(
      "2 rows",
    );
  });
});

describe("the overflow strip", () => {
  it("states how many rows are not on screen, and in which month", () => {
    expect(describeCategoryOverflow(11, "2026-08")).toBe("11 more in August");
  });
});
