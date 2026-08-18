import { describe, expect, it } from "vitest";
import {
  computeBorneShareCents,
  computeRecognisedInstalment,
  describeShareSentence,
  describeSpreadRecognition,
} from "../transaction-detail-figures";
import { row } from "./fixtures";

describe("the owner's borne share of a magnitude", () => {
  it("rounds the share once, matching the share sentence's own half", () => {
    expect(computeBorneShareCents(12999, 8000)).toBe(10399);
    expect(computeBorneShareCents(12999, 8000)).toBe(
      describeShareSentence(-12999, 8000, "me").youBearCents,
    );
  });
});

describe("the share sentence", () => {
  it("bears the owner's share and sends the rest back, when the owner paid", () => {
    const figures = describeShareSentence(-12999, 8000, "me");
    expect(figures.youBearCents).toBe(10399);
    expect(figures.counterpartyCents).toBe(2600);
    expect(figures.direction).toBe("comes-back");
  });

  it("still bears the owner's share, but now owes it, when the partner paid", () => {
    const figures = describeShareSentence(-12999, 8000, "partner");
    expect(figures.youBearCents).toBe(10399);
    expect(figures.counterpartyCents).toBe(2600);
    expect(figures.direction).toBe("owed");
  });

  it("makes the pair sum to the full charge exactly, whatever the rounding", () => {
    const figures = describeShareSentence(-725, 6832, "me");
    expect(figures.youBearCents + figures.counterpartyCents).toBe(725);
  });

  it("reads a full share as nothing coming back", () => {
    const figures = describeShareSentence(-5000, 10000, "me");
    expect(figures.youBearCents).toBe(5000);
    expect(figures.counterpartyCents).toBe(0);
  });

  it("halves a single cent without losing it", () => {
    const figures = describeShareSentence(-1, 5000, "me");
    expect(figures.youBearCents).toBe(1);
    expect(figures.counterpartyCents).toBe(0);
  });

  it("bears nothing at a zero share, and the whole charge goes the other way", () => {
    expect(describeShareSentence(-999, 0, "partner")).toMatchObject({
      youBearCents: 0,
      counterpartyCents: 999,
    });
  });

  it("keeps a money-in row's halves summing to its magnitude", () => {
    const figures = describeShareSentence(4501, 3333, "me");
    expect(figures.youBearCents).toBe(1500);
    expect(figures.youBearCents + figures.counterpartyCents).toBe(4501);
  });
});

describe("the instalment a row being typed would be recognised at", () => {
  it("applies the share before the spread, never the gross charge", () => {
    // $1,200 shared evenly over twelve months: budgets see $50, not $100.
    expect(computeRecognisedInstalment(120000, 5000, 12)).toBe(5000);
  });

  it("agrees with the stored row's own recognition, remainder aside", () => {
    const txn = row("2026-03-10", -100000, { spreadMonths: 12 });
    const entries = describeSpreadRecognition(txn);
    expect(computeRecognisedInstalment(-100000, 10000, 12)).toBe(entries[1].cents);
  });

  it("reads an unspread row as the whole borne share", () => {
    expect(computeRecognisedInstalment(-12999, 8000, 1)).toBe(10399);
  });
});

describe("spread recognition", () => {
  it("lists every recognised month with the remainder on the first", () => {
    const txn = row("2026-03-10", -100000, { spreadMonths: 12 });
    const entries = describeSpreadRecognition(txn);
    expect(entries).toHaveLength(12);
    expect(entries[0]).toEqual({ month: "2026-03", cents: 8337 });
    expect(entries[1]).toEqual({ month: "2026-04", cents: 8333 });
    expect(entries.reduce((sum, entry) => sum + entry.cents, 0)).toBe(100000);
  });

  it("reads an unspread row as one month at the full share", () => {
    const txn = row("2026-03-10", -12000, { isHousehold: true, myShareBps: 5000 });
    expect(describeSpreadRecognition(txn)).toEqual([{ month: "2026-03", cents: 6000 }]);
  });
});
