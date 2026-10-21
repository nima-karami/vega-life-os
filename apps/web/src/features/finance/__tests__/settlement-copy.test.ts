import type { FinanceSettlement, FinanceTransaction } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { computeSettlementFigures } from "../settlement";
import {
  describeFixRowsLabel,
  describePeriodStatus,
  describeRowsFooter,
  describeSettlementConfirmCopy,
  describeSettlementOutcome,
  describeSettlementScope,
  describeSettlementSubLine,
  listSettlementNotes,
  resolvePartnerName,
  SPREAD_RULE,
} from "../settlement-copy";
import { makeBook, row, settlement } from "./fixtures";

const MONTH = "2026-03";

const shared = (txnDate: string, amountCents: number, patch = {}) =>
  row(txnDate, amountCents, { isHousehold: true, myShareBps: 5000, ...patch });

const figuresOf = (
  transactions: FinanceTransaction[] = [shared("2026-03-02", -100000)],
  settlements: FinanceSettlement[] = [],
) =>
  computeSettlementFigures(
    makeBook({ financeTransactions: transactions, financeSettlements: settlements }),
    MONTH,
  );

describe("the partner name", () => {
  it("falls back to `Partner` when Settings has none, and trims what it has", () => {
    expect(resolvePartnerName("")).toBe("Partner");
    expect(resolvePartnerName("   ")).toBe("Partner");
    expect(resolvePartnerName("  Robin ")).toBe("Robin");
  });
});

describe("the header sub-line", () => {
  it("names one open period in words", () => {
    expect(describeSettlementSubLine(1, 31, MONTH)).toBe(
      "One open period · 31 shared rows in March",
    );
  });

  it("counts more than one, and says so when there are none", () => {
    expect(describeSettlementSubLine(2, 4, MONTH)).toBe("2 open periods · 4 shared rows in March");
    expect(describeSettlementSubLine(0, 1, MONTH)).toBe("No open period · 1 shared row in March");
  });
});

describe("the period status line", () => {
  it("states the day an open period closes", () => {
    expect(describePeriodStatus(figuresOf())).toBe("March 2026 · open until Mar 31");
  });

  it("states the day a settled period was frozen", () => {
    const figures = figuresOf(
      [shared("2026-03-02", -100000)],
      [
        settlement(MONTH, {
          status: "settled",
          settledBalanceCents: 50000,
          settledAt: "2026-04-01",
        }),
      ],
    );
    expect(describePeriodStatus(figures)).toBe("March 2026 · settled Apr 1");
  });

  it("says when a settled period has been amended since", () => {
    const figures = figuresOf(
      [shared("2026-03-02", -100000)],
      [settlement(MONTH, { status: "settled", settledBalanceCents: 1, settledAt: "2026-04-01" })],
    );
    expect(describePeriodStatus(figures)).toBe("March 2026 · amended since it settled Apr 1");
  });
});

describe("the scope sentence", () => {
  it("states what was netted when nothing waits on a split", () => {
    expect(describeSettlementScope(figuresOf())).toBe(
      "$1,000.00 of shared purchases netted across 1 row.",
    );
  });

  it("names the waiting rows rather than deducting them", () => {
    const figures = figuresOf([
      shared("2026-03-02", -100000),
      shared("2026-03-05", -21447, { categoryId: null }),
    ]);
    expect(describeSettlementScope(figures)).toBe(
      "$1,214.47 of shared purchases netted across 2 rows · 1 of them, worth $214.47, still waits on a split.",
    );
  });
});

describe("the rows footer sentence", () => {
  it("counts every row, and the waiting ones alongside", () => {
    expect(describeRowsFooter(figuresOf())).toBe("1 row counted");
    const figures = figuresOf([
      shared("2026-03-02", -100000),
      shared("2026-03-05", -21447, { categoryId: null }),
      shared("2026-03-06", -1000, { categoryId: null }),
    ]);
    expect(describeRowsFooter(figures)).toBe(
      "3 rows counted · 2 waiting on a split, counted in this net",
    );
  });
});

describe("the fix-rows button label", () => {
  it("agrees with the count it is fixing", () => {
    expect(describeFixRowsLabel(1)).toBe("Fix the row");
    expect(describeFixRowsLabel(3)).toBe("Fix the 3 rows");
  });
});

describe("the notes beside the action", () => {
  it("always ends on the spread rule, and says nothing else on a clean open period", () => {
    const notes = listSettlementNotes(figuresOf());
    expect(notes).toEqual([{ icon: "calendar-range", text: SPREAD_RULE, isBlocking: false }]);
  });

  it("leads with the missing-split blocker and states the figure is counted, not dropped", () => {
    const figures = figuresOf([
      shared("2026-03-02", -100000),
      shared("2026-03-05", -21447, { categoryId: null }),
    ]);
    const [blocker] = listSettlementNotes(figures);

    expect(blocker.isBlocking).toBe(true);
    expect(blocker.text).toBe(
      "1 row still has no split. $214.47 counts at its current split until you set one.",
    );
  });

  it("reports the frozen figure and the payment recorded against it", () => {
    const figures = figuresOf(
      [shared("2026-03-02", -100000)],
      [
        settlement(MONTH, {
          status: "settled",
          settledBalanceCents: 50000,
          settledAt: "2026-04-01",
          paidCents: 50000,
          paidAt: "2026-04-02",
        }),
      ],
    );
    const texts = listSettlementNotes(figures).map((note) => note.text);

    expect(texts[0]).toContain("Settled at $500.00 on Apr 1");
    expect(texts[1]).toBe("$500.00 recorded as paid on Apr 2.");
  });

  it("blocks on an amended period with the difference spelled out", () => {
    const figures = figuresOf(
      [shared("2026-03-02", -100000)],
      [settlement(MONTH, { status: "settled", settledBalanceCents: 40000 })],
    );
    const [blocker] = listSettlementNotes(figures);

    expect(blocker.isBlocking).toBe(true);
    expect(blocker.text).toContain("moved to $500.00");
    expect(blocker.text).toContain("difference of $100.00");
  });
});

describe("the confirm-dialog copy", () => {
  const figures = figuresOf([shared("2026-03-02", -100000)]);

  it("states the carried amount and where it lands", () => {
    const copy = describeSettlementConfirmCopy("carry", figures, "2026-04", "Robin");
    expect(copy.title).toBe("Carry the difference forward?");
    expect(copy.body).toContain("$500.00 moves into April 2026");
  });

  it("names the frozen figure being reopened", () => {
    const settled = figuresOf(
      [shared("2026-03-02", -100000)],
      [
        settlement(MONTH, {
          status: "settled",
          settledBalanceCents: 50000,
          settledAt: "2026-04-01",
        }),
      ],
    );
    const copy = describeSettlementConfirmCopy("reopen", settled, "2026-04", "Robin");
    expect(copy.body).toContain("The $500.00 it was settled at is kept on record");
  });

  it("previews what settling now would freeze, in the direction sentence", () => {
    const copy = describeSettlementConfirmCopy("settle", figures, "2026-04", "Robin");
    expect(copy.confirmLabel).toBe("Record settlement");
    expect(copy.body).toContain("settles at $500.00: robin owes you $500.00");
  });

  it("labels a re-settle differently from a first settlement", () => {
    expect(
      describeSettlementConfirmCopy("resettle", figures, "2026-04", "Robin").confirmLabel,
    ).toBe("Re-settle");
  });
});

describe("a closed period's outcome", () => {
  it("says who sent whom, never a bare sign", () => {
    expect(describeSettlementOutcome(31420, "Robin")).toEqual({
      name: "Robin",
      phrase: " sent you",
      amount: "$314.20",
    });
    expect(describeSettlementOutcome(-8845, "Robin")).toEqual({
      name: null,
      phrase: "You sent Robin",
      amount: "$88.45",
    });
  });

  it("keeps the direction out of the half a long name may ellipsise", () => {
    const outcome = describeSettlementOutcome(31420, "Bartholomewfeatherstonehaughsonnenschein");

    expect(outcome.name).toBe("Bartholomewfeatherstonehaughsonnenschein");
    expect(outcome.phrase, "the direction sits in the half that can be cut short").toBe(
      " sent you",
    );
  });

  it("has a sentence for a period that came out square", () => {
    expect(describeSettlementOutcome(0, "Robin")).toEqual({
      name: null,
      phrase: "Square: nothing changed hands",
      amount: "",
    });
  });
});
