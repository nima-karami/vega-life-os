import { describe, expect, it } from "vitest";
import {
  describeBudgetStatus,
  describeBurnCaption,
  describeExclusions,
  describePaceNote,
  describeTrendCaption,
} from "../overview/overview-copy";

const LABELS = { monthEnd: "Aug 31", breachedOn: null };

describe("describeBudgetStatus", () => {
  it("names the overage and the day it was crossed", () => {
    const line = describeBudgetStatus(
      { spentCents: 19630, budgetCents: 18000, projectedCents: 40000 },
      { monthEnd: "Aug 31", breachedOn: "Aug 9" },
    );
    expect(line).toEqual({ text: "over by $16.30 · breached Aug 9", isOver: true });
  });

  it("states the overage alone when nothing on file says which row crossed it", () => {
    const line = describeBudgetStatus(
      { spentCents: 19630, budgetCents: 18000, projectedCents: null },
      LABELS,
    );
    expect(line.text).toBe("over by $16.30");
  });

  it("reads the run rate against the budget while the month is still running", () => {
    expect(
      describeBudgetStatus({ spentCents: 24010, budgetCents: 70000, projectedCents: 67700 }, LABELS)
        .text,
    ).toBe("on pace · tracking $677 by Aug 31");
    expect(
      describeBudgetStatus({ spentCents: 24010, budgetCents: 70000, projectedCents: 90000 }, LABELS)
        .text,
    ).toBe("over at this pace · tracking $900 by Aug 31");
  });

  it("says nothing has landed rather than claiming a category is on pace", () => {
    expect(
      describeBudgetStatus({ spentCents: 0, budgetCents: 24000, projectedCents: 0 }, LABELS).text,
    ).toBe("nothing yet this month");
  });

  it("reports the finished month's slack once there is no run rate left", () => {
    expect(
      describeBudgetStatus({ spentCents: 7064, budgetCents: 25000, projectedCents: null }, LABELS)
        .text,
    ).toBe("under by $179.36");
  });
});

describe("describeTrendCaption", () => {
  const month = (cents: number, isBreach: boolean, isOpen = false) => ({ cents, isBreach, isOpen });

  it("counts breaches and averages completed months only", () => {
    expect(
      describeTrendCaption([
        month(80000, true),
        month(55000, false),
        month(70000, true),
        month(24010, false, true),
      ]),
    ).toBe("Red dots are breaches — 2 in 3 months · average $683/mo");
  });

  it("leads with the clean record when no month breached", () => {
    expect(describeTrendCaption([month(55000, false), month(55000, false)])).toBe(
      "No month breached its budget · average $550/mo",
    );
  });

  it("refuses to average a window with nothing completed in it", () => {
    expect(describeTrendCaption([month(1000, false, true)])).toBe(
      "No completed month on file yet — nothing to average against.",
    );
  });

  it("rounds a negative half-cent average away from zero, like every other money figure", () => {
    // -50 + -49 over 2 months = -49.5¢ average — half-up away from zero rounds to -50¢, not -49¢.
    expect(describeTrendCaption([month(-50, false), month(-49, false)])).toBe(
      "No month breached its budget · average -$1/mo",
    );
  });
});

describe("describeBurnCaption", () => {
  it("warns and names the drift when the run rate clears the plan", () => {
    const caption = describeBurnCaption(
      { projectedCents: 184700, planEndCents: 150000 },
      { monthEnd: "Aug 31", driftCategory: "Dining out" },
    );
    expect(caption).toEqual({
      text: "Tracking $1,847 by Aug 31 — $347 over the $1,500 plan. Dining out is the drift.",
      isWarning: true,
    });
  });

  it("stays muted when the month is tracking under the plan", () => {
    const caption = describeBurnCaption(
      { projectedCents: 140000, planEndCents: 150000 },
      { monthEnd: "Aug 31", driftCategory: null },
    );
    expect(caption.isWarning).toBe(false);
    expect(caption.text).toBe("Tracking $1,400 by Aug 31 — $100 under the $1,500 plan.");
  });

  it("says there is no plan rather than dividing by one that does not exist", () => {
    expect(
      describeBurnCaption(
        { projectedCents: 5000, planEndCents: 0 },
        { monthEnd: "Aug 31", driftCategory: null },
      ).text,
    ).toBe("No budget is in force this month, so there is no plan to track against.");
  });
});

describe("describePaceNote", () => {
  it("reads the gap in whole dollars, either way", () => {
    expect(describePaceNote({ projectedCents: 184700, planEndCents: 150000 })).toEqual({
      text: "$347 over pace",
      isWarning: true,
    });
    expect(describePaceNote({ projectedCents: 140000, planEndCents: 150000 }).text).toBe(
      "$100 under pace",
    );
  });
});

describe("describeExclusions", () => {
  it("states the rows left out beside the figure they would have changed", () => {
    expect(describeExclusions(0, 0)).toBe("");
    expect(describeExclusions(1, 4499)).toBe(
      "1 row left out — $44.99 still needs a category or a split.",
    );
    expect(describeExclusions(3, 12000)).toBe(
      "3 rows left out — $120.00 still needs a category or a split.",
    );
  });
});
